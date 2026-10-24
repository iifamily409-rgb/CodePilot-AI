import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { publishChange } from "@/lib/git";
import { audit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  enforceRateLimit(`publish:${auth.user.id}`, 10, 600);
  const body = await parseJson(
    request,
    z.object({
      branch: z.string().min(1).max(100),
      commitMessage: z.string().min(1).max(500),
      prTitle: z.string().max(200).optional(),
      prBody: z.string().max(4000).optional(),
      createPr: z.boolean(),
    }),
  );
  const result = await publishChange(auth.user.id, id, body);
  audit(request, auth.user.id, "change.published", id, { branch: result.branch, pr: Boolean(result.prUrl) });
  return json(result);
});
