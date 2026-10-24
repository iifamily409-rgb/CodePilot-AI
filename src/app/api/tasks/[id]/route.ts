import { assertCsrf, requireAuth } from "@/lib/auth";
import { ApiError, json, route } from "@/lib/api";
import { cancelTask, getTask } from "@/lib/tasks";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  const task = getTask(auth.user.id, id);
  if (!task) throw new ApiError("Task not found.", 404);
  return json({ task });
});

export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  cancelTask(auth.user.id, id);
  audit(request, auth.user.id, "task.cancelled", id);
  return json({ ok: true });
});
