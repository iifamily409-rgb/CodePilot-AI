import { requireAuth } from "@/lib/auth";
import { json, route } from "@/lib/api";
import { requireProject } from "@/lib/projects";
import { readFile } from "@/lib/workspace/fs";

export const dynamic = "force-dynamic";

/**
 * Static preview: inlines local CSS/JS from the workspace into index.html and
 * returns it for a sandboxed iframe (allow-scripts, no same-origin). This is a
 * preview of static templates, not a running server.
 */
export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  requireProject(auth.user.id, id);
  const candidates = ["index.html", "public/index.html"];
  let html: string | null = null;
  let base = "";
  for (const candidate of candidates) {
    try {
      html = await readFile(auth.user.id, id, candidate);
      base = candidate.includes("/") ? candidate.slice(0, candidate.lastIndexOf("/") + 1) : "";
      break;
    } catch {
      // try next candidate
    }
  }
  if (!html) {
    return json({ available: false, reason: "This project has no static index.html. Use the local runner for server projects." });
  }
  const readAsset = async (href: string): Promise<string | null> => {
    if (/^(https?:)?\/\//.test(href) || href.startsWith("data:")) return null;
    try {
      return await readFile(auth.user.id, id, `${base}${href.replace(/^\.\//, "")}`);
    } catch {
      return null;
    }
  };
  const inlineStyles = async (source: string) => {
    const matches = [...source.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)];
    let output = source;
    for (const match of matches) {
      const css = await readAsset(match[1]);
      if (css !== null) output = output.replace(match[0], `<style>${css}</style>`);
    }
    return output;
  };
  const inlineScripts = async (source: string) => {
    const matches = [...source.matchAll(/<script([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi)];
    let output = source;
    for (const match of matches) {
      const js = await readAsset(match[2]);
      if (js !== null) {
        const isModule = /type=["']module["']/.test(match[1] + match[3]) || match[2].endsWith(".mjs");
        output = output.replace(match[0], `<script${isModule ? ' type="module"' : ""}>${js.replace(/<\/script>/gi, "<\\/script>")}</script>`);
      }
    }
    return output;
  };
  const inlined = await inlineScripts(await inlineStyles(html));
  return json({ available: true, html: inlined });
});
