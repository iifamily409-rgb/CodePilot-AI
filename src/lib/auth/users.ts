import "server-only";
import { getDb, newId, nowIso, one } from "../db";
import { hashPassword, randomToken, sha256, verifyPassword } from "../crypto";
import { AuthError, revokeAllSessions } from "./session";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters long.";
  if (password.length > 200) return "Password must be at most 200 characters long.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain at least one letter and one number.";
  }
  return null;
}

export function createUser(input: { email: string; name: string; password: string }) {
  const email = normalizeEmail(input.email);
  if (one<{ id: string }>("SELECT id FROM users WHERE email = ?", email)) {
    throw new AuthError("An account with this email already exists.", 409);
  }
  const id = newId("usr");
  const ts = nowIso();
  const name = input.name.trim().slice(0, 120) || "Developer";
  getDb()
    .prepare(
      `INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, email, name, hashPassword(input.password), ts, ts);
  return { id, email, name, avatar_url: null, created_at: ts };
}

export function authenticate(email: string, password: string) {
  const row = one<any>(
    "SELECT * FROM users WHERE email = ? AND deleted_at IS NULL",
    normalizeEmail(email),
  );
  const dummy = "scrypt$16384$" + "0".repeat(32) + "$" + "0".repeat(128);
  const ok = verifyPassword(password, row?.password_hash ?? dummy);
  if (!row || !ok) throw new AuthError("Invalid email or password.", 401);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar_url: row.avatar_url,
    created_at: row.created_at,
  };
}

export function updateProfile(userId: string, input: { name?: string; email?: string }) {
  const ts = nowIso();
  if (input.email) {
    const email = normalizeEmail(input.email);
    const clash = one<{ id: string }>("SELECT id FROM users WHERE email = ? AND id <> ?", email, userId);
    if (clash) throw new AuthError("That email address is already in use.", 409);
    getDb().prepare("UPDATE users SET email = ?, updated_at = ? WHERE id = ?").run(email, ts, userId);
  }
  if (input.name) {
    getDb()
      .prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?")
      .run(input.name.trim().slice(0, 120), ts, userId);
  }
  return one<any>("SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?", userId);
}

export function changePassword(userId: string, current: string, next: string) {
  const row = one<any>("SELECT password_hash FROM users WHERE id = ?", userId);
  if (!row || !verifyPassword(current, row.password_hash)) {
    throw new AuthError("Current password is incorrect.", 400);
  }
  getDb()
    .prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
    .run(hashPassword(next), nowIso(), userId);
  revokeAllSessions(userId);
}

export function createPasswordReset(userId: string): string {
  const token = randomToken(32);
  getDb()
    .prepare(
      "INSERT INTO password_resets (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      newId("prs"),
      userId,
      sha256(token),
      nowIso(),
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    );
  return token;
}

export function consumePasswordReset(token: string, newPassword: string): void {
  const row = one<any>("SELECT * FROM password_resets WHERE token_hash = ?", sha256(token));
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    throw new AuthError("This password reset link is invalid or has expired.", 400);
  }
  const ts = nowIso();
  getDb()
    .prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
    .run(hashPassword(newPassword), ts, row.user_id);
  getDb().prepare("UPDATE password_resets SET used_at = ? WHERE id = ?").run(ts, row.id);
  revokeAllSessions(row.user_id);
}
