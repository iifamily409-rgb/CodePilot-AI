import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { createChat, listChats } from "@/lib/chats";
import { MODES } from "@/lib/ai/modes";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const auth = await requireAuth();
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  return json({ chats: listChats(auth.user.id, archived) });
});

export const POST = route(async (request: Request) => {
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  enforceRateLimit(`chat-create:${auth.user.id}`, 60, 3600);
  const body = await parseJson(
    request,
    z.object({
      title: z.string().max(120).optional(),
      mode: z.enum(MODES as [string, ...string[]]).optional(),
      projectId: z.string().max(80).nullable().optional(),
      repositoryId: z.string().max(80).nullable().optional(),
      branch: z.string().max(120).nullable().optional(),
      modelRef: z.string().max(300).nullable().optional(),
    }),
  );
  const chat = createChat(auth.user.id, {
    title: body.title,
    mode: body.mode as any,
    projectId: body.projectId ?? null,
    repositoryId: body.repositoryId ?? null,
    branch: body.branch ?? null,
    modelRef: body.modelRef ?? null,
  });
  return json({ chat }, 201);
});
