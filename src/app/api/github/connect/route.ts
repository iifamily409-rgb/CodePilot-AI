import { randomToken, sha256 } from "@/lib/crypto";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ApiError, json, route } from "@/lib/api";
import { authorizeUrl, githubConfigured, githubConfigError } from "@/lib/github/app";
import { audit } from "@/lib/audit";

export const POST = route(async (request: Request) => {
  if (!githubConfigured()) throw new ApiError(githubConfigError() ?? "GitHub is not configured.", 503);
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  const state = randomToken(24);
  getDb()
    .prepare("INSERT INTO oauth_states (state_hash, user_id, kind, created_at, expires_at) VALUES (?, ?, 'github', ?, ?)")
    .run(sha256(state), auth.user.id, new Date().toISOString(), new Date(Date.now() + 15 * 60 * 1000).toISOString());
  audit(request, auth.user.id, "github.connect_started");
  return json({ authorizeUrl: authorizeUrl(state) });
});
