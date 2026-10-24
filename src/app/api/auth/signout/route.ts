import { assertCsrf, destroyCurrentSession, requireAuth } from "@/lib/auth";
import { json, route } from "@/lib/api";

export const POST = route(async (request: Request) => {
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  await destroyCurrentSession();
  return json({ ok: true });
});
