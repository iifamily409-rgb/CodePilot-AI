import { z } from "zod";
import { authenticate, createSession } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requestIp } from "@/lib/audit";

const Schema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

export const POST = route(async (request: Request) => {
  enforceRateLimit(`signin:${requestIp(request)}`, 20, 900);
  const body = await parseJson(request, Schema);
  const user = authenticate(body.email, body.password);
  const { csrfToken } = await createSession(user.id);
  return json({ user, csrfToken });
});
