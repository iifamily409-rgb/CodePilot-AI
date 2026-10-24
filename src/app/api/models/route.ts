import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, route } from "@/lib/api";
import { listModels, listProviders, refreshProviderModels } from "@/lib/providers";
import { evaluateModel, selectModelForTask } from "@/lib/ai/eligibility";
import { audit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const auth = await requireAuth();
  const url = new URL(request.url);
  const capability = url.searchParams.get("capability");
  const providers = new Map(listProviders(auth.user.id).map((p) => [p.id, p]));
  let models = listModels(auth.user.id).map((model) => {
    const provider = providers.get(model.provider_id);
    return {
      ref: `${model.provider_id}::${model.model_id}`,
      id: model.id,
      modelId: model.model_id,
      displayName: model.display_name,
      provider: provider ? { id: provider.id, name: provider.name, protocol: provider.protocol } : null,
      pricingStatus: model.pricing_status,
      inputPricePerMtok: model.input_price_per_mtok,
      outputPricePerMtok: model.output_price_per_mtok,
      contextLength: model.context_length,
      capabilities: JSON.parse(model.capabilities_json || "{}"),
      source: model.source,
      enabled: Boolean(model.enabled),
      notes: model.notes,
      lastCheckedAt: model.last_checked_at,
      eligibility: evaluateModel(provider, model),
    };
  });
  if (capability) {
    models = models.filter((m) => (m.capabilities as any)[capability]);
  }
  const smart = selectModelForTask(auth.user.id, { tools: true });
  return json({ models, smartSelection: smart });
});

export const POST = route(async (request: Request) => {
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  enforceRateLimit(`models-refresh-all:${auth.user.id}`, 6, 600);
  const results: Array<{ provider: string; ok: boolean; count?: number; error?: string }> = [];
  for (const provider of listProviders(auth.user.id)) {
    try {
      const result = await refreshProviderModels(auth.user.id, provider.id);
      results.push({ provider: provider.name, ok: true, count: result.count });
    } catch (error) {
      results.push({
        provider: provider.name,
        ok: false,
        error: error instanceof Error ? error.message : "refresh failed",
      });
    }
  }
  audit(request, auth.user.id, "models.refreshed_all", undefined, { providers: results.length });
  return json({ results });
});
