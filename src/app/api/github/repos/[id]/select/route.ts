import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { ApiError, json, parseJson, route } from "@/lib/api";
import { getRepository } from "@/lib/github/connection";
import { getDb } from "@/lib/db";

const Schema = z.object({ selected: z.boolean() });

export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  const body = await parseJson(request, Schema);
  const repo = getRepository(auth.user.id, id);
  if (!repo) throw new ApiError("Repository not found.", 404);
  getDb()
    .prepare("UPDATE repositories SET selected = ? WHERE id = ? AND user_id = ?")
    .run(body.selected ? 1 : 0, id, auth.user.id);
  return json({ ok: true, selected: body.selected });
});
