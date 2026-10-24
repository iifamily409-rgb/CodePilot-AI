import { z } from "zod";
import { consumePasswordReset, validatePasswordStrength } from "@/lib/auth";
import { ApiError, json, parseJson, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requestIp } from "@/lib/audit";

const Schema = z.object({ token: z.string().min(10).max(200), password: z.string().min(1).max(200) });

export const POST = route(async (request: Request) => {
  enforceRateLimit(`reset:${requestIp(request)}`, 10, 3600);
  const body = await parseJson(request, Schema);
  const weak = validatePasswordStrength(body.password);
  if (weak) throw new ApiError(weak, 422, "weak_password");
  consumePasswordReset(body.token, body.password);
  return json({ ok: true });
});
