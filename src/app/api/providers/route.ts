import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { createProvider, listModels, listProviders, refreshProviderModels } from "@/lib/providers";
import { PROVIDER_PROTOCOLS } from "@/lib/ai/types";
import { audit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export function publicProvider(provider: any, modelCounts?: Record<string, { total: number; eligible: number }>) {
  return {
    id: provider.id,
    name: provider.name,
    protocol: provider.protocol,
    baseUrl: provider.base_url,
    authType: provider.auth_type,
    hasApiKey: Boolean(provider.api_key_enc),
    hasCustomHeaders: Boolean(provider.headers_enc),
    enabled: Boolean(provider.enabled),
    lastCheckAt: provider.last_check_at,
    lastCheckOk: provider.last_check_ok === null ? null : Boolean(provider.last_check_ok),
    lastCheckMessage: provider.last_check_message,
    modelCounts: modelCounts?.[provider.id] ?? { total: 0, eligible: 0 },
    createdAt: provider.created_at,
  };
}

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  protocol: z.enum(PROVIDER_PROTOCOLS as [string, ...string[]]),
  baseUrl: z.string().max(400),
  authType: z.enum(["bearer", "x-api-key", "basic", "none"]),
  apiKey: z.string().max(500).optional().nullable(),
  headers: z.record(z.string(), z.string()).optional().nullable(),
  discover: z.boolean().optional(),
});

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const auth = await requireAuth();
  const models = listModels(auth.user.id);
  const counts: Record<string, { total: number; eligible: number }> = {};
  for (const model of models) {
    counts[model.provider_id] ??= { total: 0, eligible: 0 };
    counts[model.provider_id].total += 1;
    if (model.pricing_status === "verified_free" || model.pricing_status === "local") {
      counts[model.provider_id].eligible += 1;
    }
  }
  return json({ providers: listProviders(auth.user.id).map((p) => publicProvider(p, counts)) });
});

export const POST = route(async (request: Request) => {
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  enforceRateLimit(`provider-create:${auth.user.id}`, 20, 3600);
  const body = await parseJson(request, CreateSchema);
  const provider = await createProvider(auth.user.id, {
    name: body.name,
    protocol: body.protocol as any,
    baseUrl: body.baseUrl,
    authType: body.authType as any,
    apiKey: body.apiKey ?? null,
    headers: body.headers ?? null,
  });
  audit(request, auth.user.id, "provider.created", provider.id, { protocol: provider.protocol });
  let discovery: { count: number; note?: string } | { error: string } | null = null;
  if (body.discover !== false) {
    try {
      discovery = await refreshProviderModels(auth.user.id, provider.id);
    } catch (error) {
      discovery = { error: error instanceof Error ? error.message : "Model discovery failed." };
    }
  }
  return json({ provider: publicProvider(provider), discovery }, 201);
});
