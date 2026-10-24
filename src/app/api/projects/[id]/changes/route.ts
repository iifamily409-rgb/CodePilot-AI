import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { computeChanges, createChangeRecord, listChanges, requireProject } from "@/lib/projects";
import { getRepository } from "@/lib/github/connection";
import { executionCapabilities } from "@/lib/execution/runner";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  const project = requireProject(auth.user.id, id);
  const repository = project.repository_id ? getRepository(auth.user.id, project.repository_id) : null;
  return json({
    diffs: await computeChanges(auth.user.id, id),
    changes: listChanges(auth.user.id, id),
    repository: repository ? { id: repository.id, fullName: repository.full_name, defaultBranch: repository.default_branch } : null,
    project,
    execution: executionCapabilities(),
  });
});

export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  requireProject(auth.user.id, id);
  const body = await parseJson(
    request,
    z.object({
      summary: z.string().min(1).max(400),
      testOutput: z.string().max(20_000).optional().nullable(),
      taskId: z.string().max(80).optional().nullable(),
      branch: z.string().max(100).optional().nullable(),
    }),
  );
  const diffs = await computeChanges(auth.user.id, id);
  if (!diffs.length) {
    return json({ ok: false, error: "No changes to review yet." }, 400);
  }
  const changeId = createChangeRecord(auth.user.id, id, {
    summary: body.summary,
    diffs,
    testOutput: body.testOutput ?? null,
    taskId: body.taskId ?? null,
    branch: body.branch ?? null,
  });
  audit(request, auth.user.id, "change.created", changeId, { files: diffs.length });
  return json({ ok: true, changeId, diffs }, 201);
});
