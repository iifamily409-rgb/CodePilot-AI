import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { decideChange } from "@/lib/projects";
import { audit } from "@/lib/audit";

export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  const body = await parseJson(request, z.object({ decision: z.enum(["approved", "rejected"]) }));
  decideChange(auth.user.id, id, body.decision);
  audit(request, auth.user.id, `change.${body.decision}`, id);
  return json({ ok: true, status: body.decision });
});
