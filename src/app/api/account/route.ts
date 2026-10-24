import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { assertCsrf, authenticate, changePassword, requireAuth, updateProfile, validatePasswordStrength } from "@/lib/auth";
import { ApiError, json, parseJson, route } from "@/lib/api";
import { getDb, all } from "@/lib/db";
import { DATA_DIR } from "@/lib/env";
import { audit } from "@/lib/audit";

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().max(200).optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().max(200).optional(),
});

export const PATCH = route(async (request: Request) => {
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  const body = await parseJson(request, PatchSchema);
  if (body.currentPassword && body.newPassword) {
    const weak = validatePasswordStrength(body.newPassword);
    if (weak) throw new ApiError(weak, 422, "weak_password");
    changePassword(auth.user.id, body.currentPassword, body.newPassword);
    audit(request, auth.user.id, "account.password_changed");
  }
  if (body.name || body.email) {
    const updated = updateProfile(auth.user.id, { name: body.name, email: body.email });
    audit(request, auth.user.id, "account.profile_updated");
    return json({ user: updated });
  }
  return json({ ok: true });
});

const DeleteSchema = z.object({ password: z.string().min(1).max(200), confirm: z.literal("delete my account") });

export const DELETE = route(async (request: Request) => {
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  const body = await parseJson(request, DeleteSchema);
  authenticate(auth.user.email, body.password);
  const projects = all<{ id: string }>("SELECT id FROM projects WHERE user_id = ?", auth.user.id);
  getDb().prepare("DELETE FROM users WHERE id = ?").run(auth.user.id);
  for (const project of projects) {
    await fs.rm(path.join(DATA_DIR, "workspaces", auth.user.id, project.id), { recursive: true, force: true });
    await fs.rm(path.join(DATA_DIR, "baselines", auth.user.id, project.id), { recursive: true, force: true });
  }
  return json({ ok: true });
});
