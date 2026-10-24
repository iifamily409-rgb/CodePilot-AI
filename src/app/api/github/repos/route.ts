import { requireAuth } from "@/lib/auth";
import { json, route } from "@/lib/api";
import { listRepositories } from "@/lib/github/connection";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const auth = await requireAuth();
  return json({ repositories: listRepositories(auth.user.id) });
});
