import { requireAuth } from "@/lib/auth";
import { json, route } from "@/lib/api";
import { githubConfigured, githubMode, installationSetupUrl } from "@/lib/github/app";
import { connectionSummary, listRepositories } from "@/lib/github/connection";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const auth = await requireAuth();
  return json({
    configured: githubConfigured(),
    mode: githubMode(),
    connection: connectionSummary(auth.user.id),
    repositories: listRepositories(auth.user.id),
    installationSetupUrl: installationSetupUrl(),
  });
});
