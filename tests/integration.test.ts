import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getDb, newId, nowIso } from "@/lib/db";
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

describe("project surface", () => {
  it("keeps the public surface small and personal-use focused", () => {
    for (const route of ["/", "/docs", "/getting-started", "/changelog", "/sign-in", "/sign-up"]) {
      expect(pages, `missing page for ${route}`).toContain(route);
    }
    expect(pages.some((route) => route.startsWith("/legal"))).toBe(false);
  });

  it("does not ship legal, sales or support infrastructure", () => {
    for (const entry of [
      "src/app/(marketing)/legal",
      "src/content/legal",
      "docs/legal",
      "src/app/(marketing)/contact",
      "src/app/(marketing)/features",
    ]) {
      expect(fs.existsSync(path.join(root, entry)), entry).toBe(false);
    }
    const source = [
      read("src/components/site-footer.tsx"),
      read("src/app/sign-up/page.tsx"),
      read("src/app/sign-in/page.tsx"),
      read("src/app/app/help/page.tsx"),
    ].join(String.fromCharCode(10));
    expect(source).not.toMatch(/\/legal\/|Terms of Service|Privacy Policy|Acceptable Use/);
  });

  it("ships the required repository documents with placeholders only", () => {
    for (const file of ["LICENSE", "README.md", ".env.example", ".gitignore", "docs/ARCHITECTURE.md"]) {
      expect(fs.existsSync(path.join(root, file)), file).toBe(true);
    }
    expect(read("LICENSE")).toMatch(/MIT License/);
    expect(read(".env.example")).not.toMatch(/APP_SECRET=[A-Za-z0-9+/]{20,}/);
    expect(read(".env.example")).not.toContain("LEGAL_PLACEHOLDERS_RESOLVED");
    expect(read("README.md")).toContain("X-Flex");
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
