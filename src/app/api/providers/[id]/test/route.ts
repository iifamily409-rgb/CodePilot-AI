import { assertCsrf, requireAuth } from "@/lib/auth";
import { ApiError, json, route } from "@/lib/api";
import { getProvider } from "@/lib/providers";
import { healthCheck } from "@/lib/ai/discovery";
import { getDb, nowIso } from "@/lib/db";
import { audit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  enforceRateLimit(`provider-test:${auth.user.id}`, 30, 300);
  const provider = getProvider(auth.user.id, id);
  if (!provider) throw new ApiError("Provider not found.", 404);
  const result = await healthCheck(provider);
  getDb()
    .prepare("UPDATE providers SET last_check_at = ?, last_check_ok = ?, last_check_message = ? WHERE id = ?")
    .run(nowIso(), result.ok ? 1 : 0, result.message.slice(0, 500), id);
  audit(request, auth.user.id, "provider.health_check", id, { ok: result.ok });
  return json(result, result.ok ? 200 : 502);
});
