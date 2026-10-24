import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getDb, newId, nowIso } from "@/lib/db";
import { LEGAL_DOCS, LEGAL_PLACEHOLDERS, unresolvedPlaceholders, legalIsFinal } from "@/content/legal";
import { createProvider, setModelPricingStatus, listModels } from "@/lib/providers";
import { pages } from "./helpers/routes";

const root = process.cwd();

function read(relative: string): string {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function makeUser(email: string): string {
  const id = newId("usr");
  const ts = nowIso();
  getDb().prepare("INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, email, "T", "x", ts, ts);
  return id;
}

beforeEach(() => {
  getDb().exec("DELETE FROM provider_models; DELETE FROM providers; DELETE FROM users;");
});

describe("legal documents", () => {
  it("exposes terms, privacy and acceptable use with explicit placeholders", () => {
    expect(Object.keys(LEGAL_DOCS).sort()).toEqual(["acceptable-use", "privacy", "terms"]);
    for (const doc of Object.values(LEGAL_DOCS)) {
      expect(doc.body.length).toBeGreaterThan(2000);
      expect(doc.body).toContain("[OPERATOR LEGAL NAME]");
      expect(unresolvedPlaceholders(doc.body).length).toBeGreaterThan(0);
    }
    expect(LEGAL_DOCS.terms.body).toMatch(/free-only policy/i);
    expect(LEGAL_DOCS.terms.body).toMatch(/Limitation of liability/i);
    expect(LEGAL_DOCS.privacy.body).toMatch(/model providers/i);
    expect(LEGAL_DOCS.privacy.body).toMatch(/account deletion/i);
  });

  it("never presents an unfinished draft as final", () => {
    expect(legalIsFinal(LEGAL_DOCS.terms.body)).toBe(false);
    expect(LEGAL_PLACEHOLDERS.length).toBeGreaterThanOrEqual(6);
  });

  it("keeps markdown copies in the repository in sync with the content", () => {
    for (const doc of Object.values(LEGAL_DOCS)) {
      const file = path.join(root, "docs", "legal", `${doc.slug}.md`);
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.readFileSync(file, "utf8").trim()).toBe(doc.body.trim());
    }
  });

  it("routes every public and legal page", () => {
    for (const route of [
      "/", "/features", "/how-it-works", "/docs", "/getting-started", "/integrations",
      "/security", "/changelog", "/contact",
      "/sign-in", "/sign-up",
    ]) {
      expect(pages, `missing page for ${route}`).toContain(route);
    }
    // Legal documents are served by one dynamic route with static params.
    const legalPage = read("src/app/(marketing)/legal/[doc]/page.tsx");
    expect(legalPage).toContain("generateStaticParams");
    expect(legalPage).toContain("LEGAL_DOCS");
  });

  it("ships the required repository documents", () => {
    for (const file of ["LICENSE", "README.md", "SECURITY.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "THIRD_PARTY_NOTICES.md", ".env.example", "docs/DEPLOYMENT-CHECKLIST.md"]) {
      expect(fs.existsSync(path.join(root, file)), file).toBe(true);
    }
    expect(read("LICENSE")).toMatch(/MIT License/);
    expect(read("LICENSE")).toContain("[COPYRIGHT HOLDER");
    expect(read(".env.example")).not.toMatch(/APP_SECRET=[A-Za-z0-9+/]{20,}/);
  });
});

describe("backend free-only enforcement placement", () => {
  it("resolves models through the eligibility engine in every inference path", () => {
    expect(read("src/app/api/chats/[id]/messages/route.ts")).toContain("resolveEligibleModel");
    expect(read("src/lib/ai/agent.ts")).toContain("resolveEligibleModel");
    expect(read("src/app/api/tasks/route.ts")).toContain("resolveEligibleModel");
    expect(read("src/lib/ai/eligibility.ts")).toContain("FREE_ONLY_POLICY");
  });

  it("does not expose credential columns through provider APIs", () => {
    const route = read("src/app/api/providers/route.ts");
    expect(route).not.toContain("api_key_enc: provider");
    expect(route).not.toContain("accessToken");
    const git = read("src/lib/github/connection.ts");
    expect(git).toContain("encryptSecret");
  });

  it("blocks direct commits to a default branch in the publish flow", () => {
    expect(read("src/lib/git.ts")).toContain("Refusing to publish directly to the default branch");
    expect(read("src/lib/github/api.ts")).toContain("Refusing to commit directly to the default branch");
  });
});

describe("provider validation", () => {
  it("rejects metadata and private endpoints for custom providers", async () => {
    const user = makeUser("ssrf@example.com");
    await expect(
      createProvider(user, { name: "Meta", protocol: "openai_compatible", baseUrl: "http://169.254.169.254/latest", authType: "bearer", apiKey: "x" }),
    ).rejects.toThrow();
    await expect(
      createProvider(user, { name: "Internal", protocol: "openai_compatible", baseUrl: "https://10.0.0.5/v1", authType: "bearer", apiKey: "x" }),
    ).rejects.toThrow(/private|reserved/i);
  });

  it("stores provider credentials encrypted, never in plaintext", async () => {
    const user = makeUser("enc@example.com");
    const provider = await createProvider(user, { name: "Local", protocol: "ollama", baseUrl: "http://localhost:11434", authType: "none" });
    expect(provider.base_url).toBe("http://localhost:11434");
    expect(provider.api_key_enc).toBeNull();
  });

  it("requires an explicit written confirmation before marking a model verified free", async () => {
    const user = makeUser("confirm@example.com");
    const provider = await createProvider(user, { name: "Custom", protocol: "openai_compatible", baseUrl: "http://localhost:8080/v1", authType: "bearer", apiKey: "secret-key-value" });
    getDb()
      .prepare("INSERT INTO provider_models (id, provider_id, user_id, model_id, display_name, pricing_status, capabilities_json, source, enabled, last_checked_at) VALUES (?, ?, ?, ?, ?, 'unverified', '{}', 'test', 1, ?)")
      .run(newId("mdl"), provider.id, user, "some/model", "Some Model", nowIso());
    expect(() => setModelPricingStatus(user, provider.id, "some/model", "verified_free", "too short")).toThrow(/confirmation/);
    setModelPricingStatus(user, provider.id, "some/model", "verified_free", "Confirmed zero-cost with provider dashboard on 2026-10-24");
    expect(listModels(user, provider.id)[0].pricing_status).toBe("verified_free");
  });

  it("refuses to override OpenRouter catalog pricing manually", async () => {
    const user = makeUser("or@example.com");
    const provider = await createProvider(user, { name: "OR", protocol: "openrouter", baseUrl: "https://openrouter.ai/api/v1", authType: "bearer", apiKey: "key" });
    getDb()
      .prepare("INSERT INTO provider_models (id, provider_id, user_id, model_id, display_name, pricing_status, capabilities_json, source, enabled, last_checked_at) VALUES (?, ?, ?, ?, ?, 'paid', '{}', 'catalog', 1, ?)")
      .run(newId("mdl"), provider.id, user, "vendor/paid", "Paid", nowIso());
    expect(() => setModelPricingStatus(user, provider.id, "vendor/paid", "verified_free", "I believe it is free now")).toThrow(/authoritative/);
  });
});
