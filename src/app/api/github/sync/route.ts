import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, route } from "@/lib/api";
import { listRepositories, syncRepositories } from "@/lib/github/connection";
import { audit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const POST = route(async (request: Request) => {
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  enforceRateLimit(`gh-sync:${auth.user.id}`, 10, 300);
  try {
    const result = await syncRepositories(auth.user.id);
    audit(request, auth.user.id, "github.repositories_synced", undefined, result);
    return json({ ...result, repositories: listRepositories(auth.user.id) });
  } catch (error) {
    throw Object.assign(
      new Error(error instanceof Error ? error.message : "GitHub sync failed."),
      { status: 502 },
    );
  }
});
