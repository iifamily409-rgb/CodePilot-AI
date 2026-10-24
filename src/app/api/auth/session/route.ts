import { getAuth } from "@/lib/auth";
import { json, route } from "@/lib/api";
import { connectionSummary } from "@/lib/github/connection";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const auth = await getAuth();
  if (!auth) return json({ user: null, csrfToken: null });
  return json({
    user: auth.user,
    csrfToken: auth.csrfToken,
    github: connectionSummary(auth.user.id),
  });
});
