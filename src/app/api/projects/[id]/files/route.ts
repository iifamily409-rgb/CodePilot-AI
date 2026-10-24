import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { requireProject } from "@/lib/projects";
import {
  createEntry,
  deleteEntry,
  listTree,
  readFile,
  renameEntry,
  searchInFiles,
  writeFile,
} from "@/lib/workspace/fs";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  requireProject(auth.user.id, id);
  const url = new URL(request.url);
  const filePath = url.searchParams.get("path");
  const query = url.searchParams.get("q");
  if (query) {
    return json({ results: await searchInFiles(auth.user.id, id, query, url.searchParams.get("regex") === "1") });
  }
  if (filePath) {
    return json({ path: filePath, content: await readFile(auth.user.id, id, filePath) });
  }
  return json({ tree: await listTree(auth.user.id, id) });
});

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("write"), path: z.string().min(1).max(400), content: z.string().max(600_000) }),
  z.object({ action: z.literal("create"), path: z.string().min(1).max(400), kind: z.enum(["file", "directory"]) }),
  z.object({ action: z.literal("rename"), from: z.string().min(1).max(400), to: z.string().min(1).max(400) }),
  z.object({ action: z.literal("delete"), path: z.string().min(1).max(400), confirm: z.literal(true) }),
]);

export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  requireProject(auth.user.id, id);
  const body = await parseJson(request, ActionSchema);
  if (body.action === "write") {
    const result = await writeFile(auth.user.id, id, body.path, body.content);
    return json({ ok: true, ...result });
  }
  if (body.action === "create") {
    await createEntry(auth.user.id, id, body.path, body.kind);
    audit(request, auth.user.id, "project.file_created", `${id}:${body.path}`);
    return json({ ok: true });
  }
  if (body.action === "rename") {
    await renameEntry(auth.user.id, id, body.from, body.to);
    audit(request, auth.user.id, "project.file_renamed", `${id}:${body.from}->${body.to}`);
    return json({ ok: true });
  }
  await deleteEntry(auth.user.id, id, body.path);
  audit(request, auth.user.id, "project.file_deleted", `${id}:${body.path}`);
  return json({ ok: true });
});
