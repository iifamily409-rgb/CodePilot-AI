import "server-only";
import { all, getDb, newId, nowIso, one } from "./db";
import { encryptSecret } from "./crypto";
import type { ModelRow, ProviderRow } from "./ai/types";
import { discoverModels } from "./ai/discovery";
import { normalizeBaseUrl } from "./ai/http";
import { assertUrlAllowed, providerUrlPolicy } from "./security/url-policy";

export type ProviderInput = {
  name: string;
  protocol: ProviderRow["protocol"];
  baseUrl: string;
  authType: ProviderRow["auth_type"];
  apiKey?: string | null;
  headers?: Record<string, string> | null;
};

const KEYLESS_PROTOCOLS = new Set(["ollama", "opencode"]);

export async function validateProviderInput(input: ProviderInput): Promise<string> {
  const baseUrl = normalizeBaseUrl(input.protocol, input.baseUrl);
  if (!baseUrl) throw new Error("Base URL is required for this provider type.");
  await assertUrlAllowed(baseUrl, providerUrlPolicy());
  if (!KEYLESS_PROTOCOLS.has(input.protocol) && input.protocol !== "openrouter" && !input.apiKey) {
    // Custom OpenAI-compatible endpoints usually need a key; local ones may not.
    // Nothing is enforced here beyond the URL policy.
  }
  return baseUrl;
}

export function listProviders(userId: string): ProviderRow[] {
  return all<ProviderRow>("SELECT * FROM providers WHERE user_id = ? ORDER BY name COLLATE NOCASE", userId);
}

export function getProvider(userId: string, id: string): ProviderRow | undefined {
  return one<ProviderRow>("SELECT * FROM providers WHERE id = ? AND user_id = ?", id, userId);
}

export async function createProvider(userId: string, input: ProviderInput): Promise<ProviderRow> {
  const baseUrl = await validateProviderInput(input);
  const ts = nowIso();
  const id = newId("prv");
  getDb()
    .prepare(
      `INSERT INTO providers (id, user_id, name, protocol, base_url, auth_type, api_key_enc, headers_enc, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(
      id,
      userId,
      input.name.slice(0, 80),
      input.protocol,
      baseUrl,
      input.authType,
      input.apiKey ? encryptSecret(input.apiKey) : null,
      input.headers && Object.keys(input.headers).length ? encryptSecret(JSON.stringify(input.headers)) : null,
      ts,
      ts,
    );
  return getProvider(userId, id)!;
}

export async function updateProvider(
  userId: string,
  id: string,
  input: Partial<ProviderInput> & { enabled?: boolean },
): Promise<ProviderRow> {
  const existing = getProvider(userId, id);
  if (!existing) throw Object.assign(new Error("Provider not found."), { status: 404 });
  const baseUrl = input.baseUrl || input.protocol
    ? await validateProviderInput({
        name: input.name ?? existing.name,
        protocol: input.protocol ?? existing.protocol,
        baseUrl: input.baseUrl ?? existing.base_url,
        authType: input.authType ?? existing.auth_type,
        apiKey: input.apiKey ?? undefined,
      })
    : existing.base_url;
  getDb()
    .prepare(
      `UPDATE providers SET name = ?, protocol = ?, base_url = ?, auth_type = ?, enabled = ?,
       api_key_enc = COALESCE(?, api_key_enc), headers_enc = COALESCE(?, headers_enc), updated_at = ? WHERE id = ? AND user_id = ?`,
    )
    .run(
      (input.name ?? existing.name).slice(0, 80),
      input.protocol ?? existing.protocol,
      baseUrl,
      input.authType ?? existing.auth_type,
      input.enabled === undefined ? existing.enabled : input.enabled ? 1 : 0,
      input.apiKey ? encryptSecret(input.apiKey) : null,
      input.headers ? encryptSecret(JSON.stringify(input.headers)) : null,
      nowIso(),
      id,
      userId,
    );
  return getProvider(userId, id)!;
}

export function deleteProvider(userId: string, id: string): void {
  getDb().prepare("DELETE FROM providers WHERE id = ? AND user_id = ?").run(id, userId);
}

export function listModels(userId: string, providerId?: string): ModelRow[] {
  if (providerId) {
    return all<ModelRow>(
      "SELECT * FROM provider_models WHERE user_id = ? AND provider_id = ? ORDER BY display_name COLLATE NOCASE",
      userId,
      providerId,
    );
  }
  return all<ModelRow>(
    "SELECT * FROM provider_models WHERE user_id = ? ORDER BY display_name COLLATE NOCASE",
    userId,
  );
}

export async function refreshProviderModels(
  userId: string,
  providerId: string,
): Promise<{ count: number; note?: string }> {
  const provider = getProvider(userId, providerId);
  if (!provider) throw Object.assign(new Error("Provider not found."), { status: 404 });
  const { models, note } = await discoverModels(provider);
  const ts = nowIso();
  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO provider_models (id, provider_id, user_id, model_id, display_name, pricing_status,
      input_price_per_mtok, output_price_per_mtok, context_length, capabilities_json, source, enabled, notes, last_checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(provider_id, model_id) DO UPDATE SET
       display_name = excluded.display_name, pricing_status = excluded.pricing_status,
       input_price_per_mtok = excluded.input_price_per_mtok, output_price_per_mtok = excluded.output_price_per_mtok,
       context_length = excluded.context_length, capabilities_json = excluded.capabilities_json,
       source = excluded.source, notes = excluded.notes, last_checked_at = excluded.last_checked_at`,
  );
  db.transaction(() => {
    for (const model of models) {
      upsert.run(
        newId("mdl"),
        providerId,
        userId,
        model.model_id,
        model.display_name,
        model.pricing_status,
        model.input_price_per_mtok,
        model.output_price_per_mtok,
        model.context_length,
        JSON.stringify(model.capabilities),
        model.source,
        model.notes,
        ts,
      );
    }
  })();
  return { count: models.length, note };
}

/** Explicit, auditable manual classification of a single model by its owner. */
export function setModelPricingStatus(
  userId: string,
  providerId: string,
  modelId: string,
  status: ModelRow["pricing_status"],
  confirmation: string | null,
): void {
  const provider = getProvider(userId, providerId);
  if (!provider) throw Object.assign(new Error("Provider not found."), { status: 404 });
  if (status === "verified_free") {
    if (!confirmation || confirmation.trim().length < 10) {
      throw Object.assign(
        new Error(
          "Marking a model verified-free requires a written confirmation that you checked the provider's pricing (at least 10 characters).",
        ),
        { status: 422 },
      );
    }
    if (provider.protocol === "openrouter") {
      throw Object.assign(
        new Error("OpenRouter pricing is authoritative from its catalog; refresh models instead of overriding it."),
        { status: 422 },
      );
    }
  }
  const result = getDb()
    .prepare(
      "UPDATE provider_models SET pricing_status = ?, notes = ?, last_checked_at = ? WHERE user_id = ? AND provider_id = ? AND model_id = ?",
    )
    .run(status, confirmation ? `Owner confirmation: ${confirmation.slice(0, 400)}` : null, nowIso(), userId, providerId, modelId);
  if (result.changes === 0) throw Object.assign(new Error("Model not found."), { status: 404 });
}

export function toggleModel(userId: string, providerId: string, modelId: string, enabled: boolean) {
  const result = getDb()
    .prepare("UPDATE provider_models SET enabled = ? WHERE user_id = ? AND provider_id = ? AND model_id = ?")
    .run(enabled ? 1 : 0, userId, providerId, modelId);
  if (result.changes === 0) throw Object.assign(new Error("Model not found."), { status: 404 });
}
