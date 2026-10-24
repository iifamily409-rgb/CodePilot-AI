import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { ApiError, json, parseJson, route } from "@/lib/api";
import { linkRepository, requireProject } from "@/lib/projects";
import { getRepository } from "@/lib/github/connection";
import { audit } from "@/lib/audit";

export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  requireProject(auth.user.id, id);
  const body = await parseJson(request, z.object({ repositoryId: z.string().min(1).max(80) }));
  const repo = getRepository(auth.user.id, body.repositoryId);
  if (!repo) throw new ApiError("Repository not found. Sync your repositories first.", 404);
  linkRepository(auth.user.id, id, repo);
  audit(request, auth.user.id, "project.repository_linked", `${id}:${repo.full_name}`);
  return json({ ok: true, repository: { id: repo.id, fullName: repo.full_name, defaultBranch: repo.default_branch } });
});
