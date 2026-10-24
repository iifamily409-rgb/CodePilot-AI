import "server-only";
import { getDb } from "../db";

/**
 * SQLite-backed fixed-window rate limiter. Works across processes that share
 * the same database file (the self-hosted deployment model).
 */
export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): { ok: boolean; remaining: number; retryAfter: number } {
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1`,
    ).run(key, windowStart);
    const row = db
      .prepare("SELECT count FROM rate_limits WHERE key = ? AND window_start = ?")
      .get(key, windowStart) as { count: number };
    return row.count;
  });
  const count = tx();
  if (Math.random() < 0.02) {
    db.prepare("DELETE FROM rate_limits WHERE window_start < ?").run(
      windowStart - windowMs * 10,
    );
  }
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfter: Math.ceil((windowStart + windowMs - Date.now()) / 1000),
  };
}

export function enforceRateLimit(key: string, limit: number, windowSeconds: number): void {
  const result = rateLimit(key, limit, windowSeconds);
  if (!result.ok) {
    const error = new Error(`Rate limit exceeded. Try again in ${result.retryAfter} seconds.`);
    (error as any).status = 429;
    (error as any).code = "rate_limited";
    (error as any).retryAfter = result.retryAfter;
    throw error;
  }
}
