import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { recordResearch, researchProviders, searchWeb } from "@/lib/research";
import { all } from "@/lib/db";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const auth = await requireAuth();
  const recent = all<any>(
    "SELECT id, query, provider, results_json, error, created_at FROM research_queries WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
    auth.user.id,
  ).map((row) => ({ ...row, results: JSON.parse(row.results_json ?? "[]") }));
  return json({ providers: researchProviders(), recent });
});

export const POST = route(async (request: Request) => {
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  enforceRateLimit(`research:${auth.user.id}`, 30, 600);
  const body = await parseJson(
    request,
    z.object({ query: z.string().min(2).max(300), chatId: z.string().max(80).optional().nullable() }),
  );
  const result = await searchWeb(body.query, 8);
  recordResearch(auth.user.id, body.query, body.chatId ?? null, result);
  audit(request, auth.user.id, "research.search", undefined, { provider: result.provider, results: result.results.length });
  return json(result);
});
