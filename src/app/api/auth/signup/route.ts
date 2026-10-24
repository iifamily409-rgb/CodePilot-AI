import { z } from "zod";
import { createSession, createUser, validatePasswordStrength } from "@/lib/auth";
import { json, parseJson, route, ApiError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requestIp } from "@/lib/audit";

const Schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export const POST = route(async (request: Request) => {
  enforceRateLimit(`signup:${requestIp(request)}`, 10, 3600);
  const body = await parseJson(request, Schema);
  const weak = validatePasswordStrength(body.password);
  if (weak) throw new ApiError(weak, 422, "weak_password");
  const user = createUser(body);
  const { csrfToken } = await createSession(user.id);
  return json({ user, csrfToken }, 201);
});
