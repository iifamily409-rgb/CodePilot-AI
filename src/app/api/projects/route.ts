import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { createProject, listProjects } from "@/lib/projects";
import { TEMPLATES } from "@/lib/workspace/templates";
import { all } from "@/lib/db";
import { audit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  template: z.enum(TEMPLATES.map((t) => t.id) as [string, ...string[]]),
  description: z.string().max(1000).optional(),
});

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const auth = await requireAuth();
  const repos = new Map(
    all<any>("SELECT id, full_name FROM repositories WHERE user_id = ?", auth.user.id).map((r) => [r.id, r.full_name]),
  );
  const projects = listProjects(auth.user.id).map((project) => ({
    ...project,
    repositoryName: project.repository_id ? repos.get(project.repository_id) ?? null : null,
  }));
  return json({ projects, templates: TEMPLATES });
});

export const POST = route(async (request: Request) => {
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  enforceRateLimit(`project-create:${auth.user.id}`, 20, 3600);
  const body = await parseJson(request, CreateSchema);
  const project = await createProject(auth.user.id, {
    name: body.name,
    template: body.template as any,
    description: body.description,
  });
  audit(request, auth.user.id, "project.created", project.id, { template: project.template });
  return json({ project }, 201);
});
