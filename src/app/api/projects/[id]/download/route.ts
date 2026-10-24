import JSZip from "jszip";
import { requireAuth } from "@/lib/auth";
import { route } from "@/lib/api";
import { requireProject } from "@/lib/projects";
import { readFilesFromRoot } from "@/lib/workspace/fs";
import { workspaceRoot } from "@/lib/workspace/fs";

export const dynamic = "force-dynamic";

export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  const project = requireProject(auth.user.id, id);
  const files = await readFilesFromRoot(workspaceRoot(auth.user.id, id), { includeSecrets: true, maxFiles: 1000 });
  const zip = new JSZip();
  for (const file of files) zip.file(file.path, file.content);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const name = project.slug || "project";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${name}.zip"`,
      "content-length": String(buffer.length),
      "cache-control": "no-store",
    },
  });
});
