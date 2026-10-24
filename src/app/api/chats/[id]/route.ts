import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { deleteChat, listMessages, requireChat, updateChat } from "@/lib/chats";
import { MODES } from "@/lib/ai/modes";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  const chat = requireChat(auth.user.id, id);
  return json({ chat, messages: listMessages(auth.user.id, id) });
});

export const PATCH = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  const body = await parseJson(
    request,
    z.object({
      title: z.string().min(1).max(120).optional(),
      mode: z.enum(MODES as [string, ...string[]]).optional(),
      archived: z.boolean().optional(),
      projectId: z.string().max(80).nullable().optional(),
      repositoryId: z.string().max(80).nullable().optional(),
      branch: z.string().max(120).nullable().optional(),
      modelRef: z.string().max(300).nullable().optional(),
    }),
  );
  const chat = updateChat(auth.user.id, id, {
    title: body.title,
    mode: body.mode as any,
    archived: body.archived,
    projectId: body.projectId,
    repositoryId: body.repositoryId,
    branch: body.branch,
    modelRef: body.modelRef,
  });
  return json({ chat });
});

export const DELETE = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  deleteChat(auth.user.id, id);
  audit(request, auth.user.id, "chat.deleted", id);
  return json({ ok: true });
});
