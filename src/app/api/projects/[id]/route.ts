import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { deleteProject, requireProject, updateProject } from "@/lib/projects";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  return json({ project: requireProject(auth.user.id, id) });
});

export const PATCH = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  const body = await parseJson(request, z.object({ name: z.string().min(1).max(80).optional(), description: z.string().max(1000).optional() }));
  const project = await updateProject(auth.user.id, id, body);
  audit(request, auth.user.id, "project.updated", id);
  return json({ project });
});

export const DELETE = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  await deleteProject(auth.user.id, id);
  audit(request, auth.user.id, "project.deleted", id);
  return json({ ok: true });
});
