import "server-only";
import fs from "node:fs/promises";
import { createTwoFilesPatch } from "diff";
import { all, getDb, newId, nowIso, one } from "./db";
import {
  baselineRoot,
  ensureWorkspace,
  isSecretFile,
  readFilesFromRoot,
  snapshotBaseline,
  workspaceRoot,
  writeProjectFiles,
} from "./workspace/fs";
import { buildTemplate, type TemplateId } from "./workspace/templates";
import { getRepository, repoToken, type Repository } from "./github/connection";
import { getFileContent, getTree } from "./github/api";

export type Project = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  template: string;
  description: string | null;
  repository_id: string | null;
  default_branch: string | null;
  execution_method: string;
  created_at: string;
  updated_at: string;
};

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "project"
  );
}

export function listProjects(userId: string): Project[] {
  return all<Project>("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC", userId);
}

export function getProject(userId: string, id: string): Project | undefined {
  return one<Project>("SELECT * FROM projects WHERE id = ? AND user_id = ?", id, userId);
}

export function requireProject(userId: string, id: string): Project {
  const project = getProject(userId, id);
  if (!project) {
    throw Object.assign(new Error("Project not found."), { status: 404 });
  }
  return project;
}

export async function createProject(
  userId: string,
  input: { name: string; template: TemplateId; description?: string },
): Promise<Project> {
  const id = newId("prj");
  const ts = nowIso();
  const name = input.name.trim().slice(0, 80) || "Untitled project";
  getDb()
    .prepare(
      `INSERT INTO projects (id, user_id, name, slug, template, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, userId, name, slugify(name), input.template, input.description?.slice(0, 1000) ?? null, ts, ts);
  await ensureWorkspace(userId, id);
  await writeProjectFiles(userId, id, buildTemplate(input.template, name));
  await snapshotBaseline(userId, id);
  return requireProject(userId, id);
}

export async function updateProject(
  userId: string,
  id: string,
  input: { name?: string; description?: string },
): Promise<Project> {
  requireProject(userId, id);
  if (input.name !== undefined) {
    const name = input.name.trim().slice(0, 80) || "Untitled project";
    getDb()
      .prepare("UPDATE projects SET name = ?, slug = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(name, slugify(name), nowIso(), id, userId);
  }
  if (input.description !== undefined) {
    getDb()
      .prepare("UPDATE projects SET description = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(input.description.slice(0, 1000), nowIso(), id, userId);
  }
  return requireProject(userId, id);
}

export async function deleteProject(userId: string, id: string): Promise<void> {
  requireProject(userId, id);
  getDb().prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(id, userId);
  await fs.rm(workspaceRoot(userId, id), { recursive: true, force: true });
  await fs.rm(baselineRoot(userId, id), { recursive: true, force: true });
}

/** Import an accessible GitHub repository into a local project workspace. */
export async function importRepository(
  userId: string,
  repositoryId: string,
): Promise<{ project: Project; files: number; truncated: boolean }> {
  const repository = getRepository(userId, repositoryId);
  if (!repository) throw Object.assign(new Error("Repository not found. Sync your repositories first."), { status: 404 });
  const token = await repoToken(repository, userId);
  const entries = await getTree(token, repository.full_name, repository.default_branch);
  const blobs = entries.filter((e) => e.type === "blob" && (e.size ?? 0) <= 200_000);
  const selected = blobs.slice(0, 120);
  const id = newId("prj");
  const ts = nowIso();
  const name = repository.name.slice(0, 80);
  getDb()
    .prepare(
      `INSERT INTO projects (id, user_id, name, slug, template, description, repository_id, default_branch, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'imported', ?, ?, ?, ?, ?)`,
    )
    .run(id, userId, name, slugify(name), repository.description, repository.id, repository.default_branch, ts, ts);
  await ensureWorkspace(userId, id);
  const files: Record<string, string> = {};
  for (const blob of selected) {
    if (isSecretFile(blob.path)) continue;
    try {
      files[blob.path] = await getFileContent(token, repository.full_name, blob.path, repository.default_branch);
    } catch {
      // Skip unreadable or binary files instead of failing the whole import.
    }
  }
  await writeProjectFiles(userId, id, files);
  await snapshotBaseline(userId, id);
  getDb().prepare("UPDATE repositories SET imported_project_id = ? WHERE id = ?").run(id, repository.id);
  return {
    project: requireProject(userId, id),
    files: Object.keys(files).length,
    truncated: blobs.length > selected.length,
  };
}

export function linkRepository(userId: string, projectId: string, repository: Repository): void {
  requireProject(userId, projectId);
  getDb()
    .prepare("UPDATE projects SET repository_id = ?, default_branch = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .run(repository.id, repository.default_branch, nowIso(), projectId, userId);
}

export type FileDiff = {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  patch: string;
  publishable: boolean;
};

export async function computeChanges(userId: string, projectId: string): Promise<FileDiff[]> {
  requireProject(userId, projectId);
  const current = await readFilesFromRoot(workspaceRoot(userId, projectId), { includeSecrets: true });
  const baseline = await readFilesFromRoot(baselineRoot(userId, projectId), { includeSecrets: true });
  const currentMap = new Map(current.map((f) => [f.path, f.content]));
  const baselineMap = new Map(baseline.map((f) => [f.path, f.content]));
  const paths = new Set([...currentMap.keys(), ...baselineMap.keys()]);
  const diffs: FileDiff[] = [];
  for (const path of [...paths].sort()) {
    const before = baselineMap.get(path);
    const after = currentMap.get(path);
    if (before === after) continue;
    const status: FileDiff["status"] = before === undefined ? "added" : after === undefined ? "deleted" : "modified";
    const patch = createTwoFilesPatch(`a/${path}`, `b/${path}`, before ?? "", after ?? "", "", "", { context: 3 });
    const additions = patch.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
    const deletions = patch.split("\n").filter((line) => line.startsWith("-") && !line.startsWith("---")).length;
    diffs.push({ path, status, additions, deletions, patch, publishable: !isSecretFile(path) });
  }
  return diffs;
}

export function createChangeRecord(
  userId: string,
  projectId: string,
  input: { summary: string; diffs: FileDiff[]; testOutput?: string | null; taskId?: string | null; branch?: string | null },
): string {
  const id = newId("chg");
  getDb()
    .prepare(
      `INSERT INTO changes (id, project_id, user_id, task_id, summary, diff, test_output, status, branch, files_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    )
    .run(
      id,
      projectId,
      userId,
      input.taskId ?? null,
      input.summary.slice(0, 400),
      input.diffs.map((d) => d.patch).join("\n"),
      input.testOutput ?? null,
      input.branch ?? null,
      JSON.stringify(input.diffs.map((d) => ({ path: d.path, status: d.status, additions: d.additions, deletions: d.deletions, publishable: d.publishable }))),
      nowIso(),
    );
  return id;
}

export function listChanges(userId: string, projectId: string) {
  requireProject(userId, projectId);
  return all<any>(
    "SELECT * FROM changes WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 50",
    projectId,
    userId,
  );
}

export async function decideChange(userId: string, changeId: string, decision: "approved" | "rejected"): Promise<void> {
  const change = one<any>("SELECT * FROM changes WHERE id = ? AND user_id = ?", changeId, userId);
  if (!change) throw Object.assign(new Error("Change not found."), { status: 404 });
  getDb()
    .prepare("UPDATE changes SET status = ?, decided_at = ? WHERE id = ?")
    .run(decision, nowIso(), changeId);
  if (decision === "approved") {
    // Accepting a change makes the current workspace the new review baseline.
    await snapshotBaseline(userId, change.project_id);
  }
}
