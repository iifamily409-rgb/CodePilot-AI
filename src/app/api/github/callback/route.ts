import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { getDb, one } from "@/lib/db";
import { route } from "@/lib/api";
import { connectGithub, syncRepositories } from "@/lib/github/connection";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const redirect = (params: Record<string, string>) => {
    const target = new URL("/app/integrations", appUrl());
    for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
    return NextResponse.redirect(target.toString());
  };
  if (error) return redirect({ github: "denied" });
  if (!code || !state) return redirect({ github: "invalid_request" });
  const auth = await requireAuth().catch(() => null);
  if (!auth) return redirect({ github: "session_expired" });
  const row = one<any>("SELECT * FROM oauth_states WHERE state_hash = ?", sha256(state));
  if (!row || row.user_id !== auth.user.id || new Date(row.expires_at).getTime() < Date.now()) {
    return redirect({ github: "invalid_state" });
  }
  getDb().prepare("DELETE FROM oauth_states WHERE state_hash = ?").run(sha256(state));
  try {
    await connectGithub(auth.user.id, code);
    const result = await syncRepositories(auth.user.id);
    audit(request, auth.user.id, "github.connected", undefined, { repositories: result.synced });
    return redirect({ github: "connected", repos: String(result.synced) });
  } catch (err) {
    audit(request, auth.user.id, "github.connect_failed");
    const message = err instanceof Error ? err.message.slice(0, 120) : "unknown";
    return redirect({ github: "failed", reason: message });
  }
});
