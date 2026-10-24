import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { createTask, listTasks, startTask } from "@/lib/tasks";
import { resolveEligibleModel } from "@/lib/ai/eligibility";
import { MODES } from "@/lib/ai/modes";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const auth = await requireAuth();
  return json({ tasks: listTasks(auth.user.id) });
});

export const POST = route(async (request: Request) => {
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  enforceRateLimit(`task-create:${auth.user.id}`, 10, 3600);
  const body = await parseJson(
    request,
    z.object({
      title: z.string().min(1).max(140),
      goal: z.string().min(5).max(4000),
      projectId: z.string().max(80).optional().nullable(),
      mode: z.enum(["code", "agent"]).default("agent"),
      modelRef: z.string().min(3).max(300),
    }),
  );
  resolveEligibleModel(auth.user.id, body.modelRef);
  const task = createTask(auth.user.id, {
    title: body.title,
    goal: body.goal,
    mode: body.mode as any,
    projectId: body.projectId ?? null,
    modelRef: body.modelRef,
  });
  startTask(auth.user.id, task.id);
  audit(request, auth.user.id, "task.created", task.id);
  return json({ task }, 201);
});
void MODES;
