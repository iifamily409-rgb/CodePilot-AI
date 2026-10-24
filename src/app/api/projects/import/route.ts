import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { importRepository } from "@/lib/projects";
import { audit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const POST = route(async (request: Request) => {
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  enforceRateLimit(`project-import:${auth.user.id}`, 5, 600);
  const body = await parseJson(request, z.object({ repositoryId: z.string().min(1).max(80) }));
  try {
    const result = await importRepository(auth.user.id, body.repositoryId);
    audit(request, auth.user.id, "project.imported", result.project.id, { files: result.files });
    return json(result, 201);
  } catch (error) {
    throw Object.assign(
      new Error(error instanceof Error ? error.message : "Import failed."),
      { status: (error as any)?.status ?? 502 },
    );
  }
});
