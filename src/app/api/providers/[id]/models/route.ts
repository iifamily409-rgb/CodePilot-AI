import { assertCsrf, requireAuth } from "@/lib/auth";
import { ApiError, json, route } from "@/lib/api";
import { getProvider, listModels, refreshProviderModels } from "@/lib/providers";
import { evaluateModel } from "@/lib/ai/eligibility";
import { audit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  const provider = getProvider(auth.user.id, id);
  if (!provider) throw new ApiError("Provider not found.", 404);
  const models = listModels(auth.user.id, id).map((model) => ({
    ...model,
    capabilities: JSON.parse(model.capabilities_json || "{}"),
    eligibility: evaluateModel(provider, model),
  }));
  return json({ models });
});

export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  enforceRateLimit(`model-refresh:${auth.user.id}`, 20, 300);
  const provider = getProvider(auth.user.id, id);
  if (!provider) throw new ApiError("Provider not found.", 404);
  try {
    const result = await refreshProviderModels(auth.user.id, id);
    audit(request, auth.user.id, "provider.models_refreshed", id, result);
    return json(result);
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : "Model refresh failed.", 502);
  }
});
