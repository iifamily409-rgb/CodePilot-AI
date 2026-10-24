import "server-only";
import { cookies } from "next/headers";
import { getDb, newId, nowIso, one } from "../db";
import { constantTimeEqual, randomToken, sha256 } from "../crypto";

export const SESSION_COOKIE = "xflex_session";
export const CSRF_HEADER = "x-csrf-token";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type User = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
};

export type AuthContext = { user: User; sessionId: string; csrfToken: string };

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function createSession(
  userId: string,
): Promise<{ token: string; csrfToken: string; expiresAt: Date }> {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_TTL_MS);
  getDb()
    .prepare(
      `INSERT INTO sessions (id, user_id, token_hash, csrf_token, created_at, last_seen_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      newId("ses"),
      userId,
      sha256(token),
      csrfToken,
      new Date(now).toISOString(),
      new Date(now).toISOString(),
      expiresAt.toISOString(),
    );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return { token, csrfToken, expiresAt };
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb()
      .prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ?")
      .run(nowIso(), sha256(token));
  }
  store.delete(SESSION_COOKIE);
}

export function revokeAllSessions(userId: string): void {
  getDb()
    .prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
    .run(nowIso(), userId);
}

export async function getAuth(): Promise<AuthContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = one<any>("SELECT * FROM sessions WHERE token_hash = ?", sha256(token));
  if (!session || session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;
  const user = one<any>("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL", session.user_id);
  if (!user) return null;
  if (Date.now() - new Date(session.last_seen_at).getTime() > TOUCH_INTERVAL_MS) {
    getDb().prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(nowIso(), session.id);
  }
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    },
    sessionId: session.id,
    csrfToken: session.csrf_token,
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw new AuthError("Authentication required.", 401);
  return auth;
}

/** Double-submit CSRF token plus same-origin enforcement for mutations. */
export async function assertCsrf(request: Request, auth: AuthContext): Promise<void> {
  const provided = request.headers.get(CSRF_HEADER) ?? "";
  if (!provided || !constantTimeEqual(provided, auth.csrfToken)) {
    throw new AuthError("Invalid or missing CSRF token.", 403);
  }
  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new AuthError("Invalid Origin header.", 403);
    }
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (host && originHost !== host) throw new AuthError("Cross-origin request blocked.", 403);
  }
}
