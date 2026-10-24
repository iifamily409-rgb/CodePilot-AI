import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { ApiError, json, parseJson, route } from "@/lib/api";
import { deleteProvider, getProvider, updateProvider } from "@/lib/providers";
import { publicProvider } from "@/lib/provider-view";
import { audit } from "@/lib/audit";
import { PROVIDER_PROTOCOLS } from "@/lib/ai/types";

const PatchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  protocol: z.enum(PROVIDER_PROTOCOLS as [string, ...string[]]).optional(),
  baseUrl: z.string().max(400).optional(),
  authType: z.enum(["bearer", "x-api-key", "basic", "none"]).optional(),
  apiKey: z.string().max(500).optional().nullable(),
  headers: z.record(z.string(), z.string()).optional().nullable(),
  enabled: z.boolean().optional(),
});

export const PATCH = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  const body = await parseJson(request, PatchSchema);
  if (!getProvider(auth.user.id, id)) throw new ApiError("Provider not found.", 404);
  const provider = await updateProvider(auth.user.id, id, {
    name: body.name,
    protocol: body.protocol as any,
    baseUrl: body.baseUrl,
    authType: body.authType as any,
    apiKey: body.apiKey ?? undefined,
    headers: body.headers ?? undefined,
    enabled: body.enabled,
  });
  audit(request, auth.user.id, "provider.updated", id);
  return json({ provider: publicProvider(provider) });
});

export const DELETE = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  if (!getProvider(auth.user.id, id)) throw new ApiError("Provider not found.", 404);
  deleteProvider(auth.user.id, id);
  audit(request, auth.user.id, "provider.deleted", id);
  return json({ ok: true });
});
