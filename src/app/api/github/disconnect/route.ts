import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, route } from "@/lib/api";
import { disconnectGithub } from "@/lib/github/connection";
import { audit } from "@/lib/audit";

export const POST = route(async (request: Request) => {
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  disconnectGithub(auth.user.id);
  audit(request, auth.user.id, "github.disconnected");
  return json({ ok: true });
});
