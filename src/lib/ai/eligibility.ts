import "server-only";
import { getDb, one } from "../db";
import type { ModelRow, PricingStatus, ProviderRow } from "./types";

/**
 * The default free-only policy. Every inference path — chat, retry, agent
 * steps, background tasks and fallbacks — calls `resolveEligibleModel`, so a
 * paid or unverified model can never be reached by crafting a direct API call.
 */
export const FREE_ONLY_POLICY = {
  allowedStatuses: ["verified_free", "local"] as PricingStatus[],
  paidModelsAllowed: false,
  unverifiedModelsAllowed: false,
} as const;

export type Eligibility = {
  eligible: boolean;
  status: PricingStatus;
  reason: string;
};

const REASON: Record<PricingStatus, string> = {
  verified_free:
    "Verified zero-cost in the provider's own catalog (input and output price are 0).",
  local:
    "Self-hosted or local runtime: no per-token inference charge is applied by X-Flex.",
  unverified:
    "Pricing could not be verified from provider metadata. X-Flex will not send requests to unverified models. Mark the model as verified free only if you have confirmed with your provider that it is zero-cost, or configure a local runtime.",
  paid:
    "The provider catalog reports a non-zero price for this model. Paid inference is blocked by the free-only policy.",
};

export function evaluateModel(
  provider: Pick<ProviderRow, "enabled" | "protocol" | "name"> | undefined,
  model: Pick<ModelRow, "enabled" | "pricing_status" | "display_name"> | undefined,
): Eligibility {
  if (!provider) {
    return { eligible: false, status: "unverified", reason: "The provider for this model no longer exists. Re-add it in Provider Manager." };
  }
  if (!provider.enabled) {
    return { eligible: false, status: (model?.pricing_status ?? "unverified") as PricingStatus, reason: `Provider "${provider.name}" is disabled. Enable it to use its models.` };
  }
  if (!model) {
    return { eligible: false, status: "unverified", reason: "Unknown model. Refresh the model catalog in Model Explorer." };
  }
  const status = model.pricing_status as PricingStatus;
  if (!model.enabled) {
    return { eligible: false, status, reason: `Model "${model.display_name}" is disabled in your provider configuration.` };
  }
  if (!FREE_ONLY_POLICY.allowedStatuses.includes(status)) {
    return { eligible: false, status, reason: REASON[status] };
  }
  return { eligible: true, status, reason: REASON[status] };
}

export type ResolvedModel = {
  provider: ProviderRow;
  model: ModelRow;
  ref: string;
  eligibility: Eligibility;
};

export class ModelEligibilityError extends Error {
  status = 403;
  code = "model_ineligible";
  constructor(message: string) {
    super(message);
  }
}

/** Server-side resolution + ownership check + free-only enforcement. */
export function resolveEligibleModel(userId: string, ref: string | null | undefined): ResolvedModel {
  if (!ref) {
    throw new ModelEligibilityError(
      "No model selected. Choose a verified-free or local model in the model selector.",
    );
  }
  const index = ref.indexOf("::");
  if (index <= 0) {
    throw new ModelEligibilityError("Invalid model reference. Re-select a model and try again.");
  }
  const providerId = ref.slice(0, index);
  const modelId = ref.slice(index + 2);
  const provider = one<ProviderRow>(
    "SELECT * FROM providers WHERE id = ? AND user_id = ?",
    providerId,
    userId,
  );
  const model = one<ModelRow>(
    "SELECT * FROM provider_models WHERE provider_id = ? AND model_id = ? AND user_id = ?",
    providerId,
    modelId,
    userId,
  );
  const eligibility = evaluateModel(provider, model);
  if (!eligibility.eligible || !provider || !model) {
    throw new ModelEligibilityError(eligibility.reason);
  }
  return { provider, model, ref, eligibility };
}

export function eligibleModels(userId: string): Array<{
  provider: ProviderRow;
  model: ModelRow;
  ref: string;
}> {
  const rows = getDb()
    .prepare(
      `SELECT pm.*, p.name AS provider_name, p.protocol, p.enabled AS provider_enabled
       FROM provider_models pm JOIN providers p ON p.id = pm.provider_id
       WHERE pm.user_id = ? ORDER BY pm.display_name COLLATE NOCASE`,
    )
    .all(userId) as any[];
  const out: Array<{ provider: ProviderRow; model: ModelRow; ref: string }> = [];
  for (const row of rows) {
    const provider = one<ProviderRow>("SELECT * FROM providers WHERE id = ?", row.provider_id);
    const model = row as ModelRow;
    if (!provider) continue;
    if (evaluateModel(provider, model).eligible) {
      out.push({ provider, model, ref: `${provider.id}::${model.model_id}` });
    }
  }
  return out;
}

/**
 * Capability-based selection. Deliberately ignores commercial ranking, price
 * tiers above zero, popularity and provider prompts.
 */
export function selectModelForTask(
  userId: string,
  needs: { tools?: boolean; longContext?: boolean; vision?: boolean; reasoning?: boolean; coding?: boolean },
): { ref: string; reason: string } | null {
  const candidates = eligibleModels(userId).map(({ provider, model, ref }) => {
    let caps: any = {};
    try {
      caps = JSON.parse(model.capabilities_json || "{}");
    } catch {
      caps = {};
    }
    return { provider, model, ref, caps };
  });
  const matches = candidates.filter(({ caps, model }) => {
    if (needs.tools && !caps.tools) return false;
    if (needs.vision && !caps.vision) return false;
    if (needs.reasoning && !caps.reasoning) return false;
    if (needs.coding && !caps.coding) return false;
    if (needs.longContext && (caps.long_context || (model.context_length ?? 0) >= 100_000) === false) return false;
    return true;
  });
  const pool = matches.length > 0 ? matches : candidates;
  if (!pool.length) return null;
  const scored = pool
    .map((c) => {
      let score = 0;
      if (c.caps.tools) score += 2;
      if (c.caps.coding) score += 2;
      if ((c.model.context_length ?? 0) >= 100_000) score += 1;
      if (c.model.pricing_status === "local") score += 1;
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score || a.model.display_name.localeCompare(b.model.display_name));
  return {
    ref: scored[0].ref,
    reason: matches.length
      ? "Selected the first eligible model whose catalog metadata matches the required capabilities (no commercial ranking)."
      : "No eligible model declared every required capability; used the best eligible fallback from your own configuration.",
  };
}
