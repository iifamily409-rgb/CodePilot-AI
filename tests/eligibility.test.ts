import { beforeEach, describe, expect, it } from "vitest";
import { getDb, newId, nowIso } from "@/lib/db";
import { evaluateModel, resolveEligibleModel, ModelEligibilityError, selectModelForTask, eligibleModels } from "@/lib/ai/eligibility";
import type { ModelRow, ProviderRow } from "@/lib/ai/types";

function makeUser(email: string): string {
  const id = newId("usr");
  const ts = nowIso();
  getDb()
    .prepare("INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, email, "Tester", "scrypt$1$00$00", ts, ts);
  return id;
}

function makeProvider(userId: string, protocol = "openrouter"): string {
  const id = newId("prv");
  const ts = nowIso();
  getDb()
    .prepare("INSERT INTO providers (id, user_id, name, protocol, base_url, auth_type, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'bearer', 1, ?, ?)")
    .run(id, userId, "Test provider", protocol, "https://example.com/v1", ts, ts);
  return id;
}

function addModel(userId: string, providerId: string, modelId: string, status: string, capabilities: Record<string, boolean> = {}): void {
  getDb()
    .prepare(
      `INSERT INTO provider_models (id, provider_id, user_id, model_id, display_name, pricing_status, context_length, capabilities_json, source, enabled, last_checked_at)
       VALUES (?, ?, ?, ?, ?, ?, 128000, ?, 'test', 1, ?)`,
    )
    .run(newId("mdl"), providerId, userId, modelId, `Model ${modelId}`, status, JSON.stringify(capabilities), nowIso());
}

beforeEach(() => {
  const db = getDb();
  db.exec("DELETE FROM provider_models; DELETE FROM providers; DELETE FROM users;");
});

describe("free-only policy", () => {
  it("allows verified free and local models", () => {
    const user = makeUser("free@example.com");
    const provider = makeProvider(user);
    addModel(user, provider, "free/model", "verified_free");
    addModel(user, provider, "local/model", "local");
    expect(resolveEligibleModel(user, `${provider}::free/model`).model.pricing_status).toBe("verified_free");
    expect(resolveEligibleModel(user, `${provider}::local/model`).model.pricing_status).toBe("local");
    expect(eligibleModels(user)).toHaveLength(2);
  });

  it("blocks paid models even when requested directly", () => {
    const user = makeUser("paid@example.com");
    const provider = makeProvider(user);
    addModel(user, provider, "paid/model", "paid");
    expect(() => resolveEligibleModel(user, `${provider}::paid/model`)).toThrow(ModelEligibilityError);
    try {
      resolveEligibleModel(user, `${provider}::paid/model`);
    } catch (error) {
      expect((error as Error).message).toMatch(/non-zero price/);
      expect((error as any).status).toBe(403);
    }
  });

  it("blocks unverified pricing and explains what to do", () => {
    const user = makeUser("unverified@example.com");
    const provider = makeProvider(user, "openai_compatible");
    addModel(user, provider, "mystery/model", "unverified");
    try {
      resolveEligibleModel(user, `${provider}::mystery/model`);
      throw new Error("should have thrown");
    } catch (error) {
      expect((error as Error).message).toMatch(/Pricing could not be verified/);
    }
  });

  it("blocks models owned by another account", () => {
    const owner = makeUser("owner@example.com");
    const other = makeUser("other@example.com");
    const provider = makeProvider(owner);
    addModel(owner, provider, "free/model", "verified_free");
    expect(() => resolveEligibleModel(other, `${provider}::free/model`)).toThrow(/Unknown model|no longer exists/);
  });

  it("blocks disabled providers and disabled models", () => {
    const user = makeUser("disabled@example.com");
    const provider = makeProvider(user);
    addModel(user, provider, "free/model", "verified_free");
    getDb().prepare("UPDATE providers SET enabled = 0 WHERE id = ?").run(provider);
    expect(() => resolveEligibleModel(user, `${provider}::free/model`)).toThrow(/disabled/);
  });

  it("reports clear reasons for each pricing state", () => {
    const provider: ProviderRow = { id: "p", user_id: "u", name: "P", protocol: "openrouter", base_url: "", auth_type: "bearer", api_key_enc: null, headers_enc: null, enabled: 1, allow_private: 0, last_check_at: null, last_check_ok: null, last_check_message: null, created_at: "", updated_at: "" };
    const model = (status: string): ModelRow => ({ id: "m", provider_id: "p", user_id: "u", model_id: "x", display_name: "X", pricing_status: status as any, input_price_per_mtok: null, output_price_per_mtok: null, context_length: null, capabilities_json: "{}", source: "t", enabled: 1, notes: null, last_checked_at: "" });
    expect(evaluateModel(provider, model("verified_free")).eligible).toBe(true);
    expect(evaluateModel(provider, model("local")).eligible).toBe(true);
    expect(evaluateModel(provider, model("paid")).eligible).toBe(false);
    expect(evaluateModel(provider, model("unverified")).eligible).toBe(false);
  });

  it("selects only eligible models with matching metadata", () => {
    const user = makeUser("smart@example.com");
    const provider = makeProvider(user);
    addModel(user, provider, "paid/coder", "paid", { tools: true, coding: true });
    addModel(user, provider, "free/chat", "verified_free", {});
    addModel(user, provider, "free/coder", "verified_free", { tools: true, coding: true });
    const selected = selectModelForTask(user, { tools: true, coding: true });
    expect(selected?.ref).toBe(`${provider}::free/coder`);
  });
});
