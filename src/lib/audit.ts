import "server-only";
import crypto from "node:crypto";
import { all, getDb, newId, nowIso } from "./db";

export function requestIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );
}

/**
 * Persist a sensitive-operation audit record. IP addresses are hashed rather
 * than stored in clear text. Never pass credentials in `meta`.
 */
export function audit(
  request: Request | null,
  userId: string | null,
  action: string,
  target?: string,
  meta?: unknown,
): void {
  try {
    const ip = request ? requestIp(request) : "";
    getDb()
      .prepare(
        `INSERT INTO audit_logs (id, user_id, action, target, meta_json, ip_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId("aud"),
        userId,
        action,
        target ?? null,
        meta === undefined ? null : JSON.stringify(meta).slice(0, 4000),
        ip ? crypto.createHash("sha256").update(ip).digest("hex") : null,
        nowIso(),
      );
  } catch {
    // Auditing must never break a request.
  }
}

export function listAudit(userId: string, limit = 30) {
  return all<any>(
    "SELECT id, action, target, meta_json, created_at FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    userId,
    limit,
  );
}
