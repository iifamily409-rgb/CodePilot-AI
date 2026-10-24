import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { requireProject } from "@/lib/projects";
import { executionCapabilities, runCommand } from "@/lib/execution/runner";
import { audit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAuth();
  return json(executionCapabilities());
});

export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  requireProject(auth.user.id, id);
  enforceRateLimit(`run:${auth.user.id}`, 30, 300);
  const body = await parseJson(request, z.object({ command: z.string().min(1).max(200) }));
  const result = await runCommand(auth.user.id, id, body.command);
  audit(request, auth.user.id, "execution.ran", id, { command: result.command, status: result.status });
  return json(result);
});
