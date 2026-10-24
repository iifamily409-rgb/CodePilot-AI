import { requireAuth } from "@/lib/auth";
import { ApiError, json, route } from "@/lib/api";
import { getRepository, repoToken } from "@/lib/github/connection";
import { listBranches } from "@/lib/github/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  enforceRateLimit(`gh-branches:${auth.user.id}`, 60, 60);
  const repo = getRepository(auth.user.id, id);
  if (!repo) throw new ApiError("Repository not found.", 404);
  try {
    const token = await repoToken(repo, auth.user.id);
    const branches = await listBranches(token, repo.full_name);
    return json({ branches, defaultBranch: repo.default_branch });
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : "Could not load branches.", 502);
  }
});
