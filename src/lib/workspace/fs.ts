import "server-only";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { dataPath } from "../env";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  ".venv",
  "__pycache__",
  ".cache",
]);

const DENIED_NAMES = new Set([
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  ".npmrc",
  ".pypirc",
  "credentials",
  "credentials.json",
]);

export const MAX_FILE_BYTES = 512 * 1024;
export const MAX_TREE_ENTRIES = 4000;

export class WorkspaceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function assertSafeId(value: string, label: string): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new WorkspaceError(`Invalid ${label}.`, 400);
  }
  return value;
}

/** User-scoped on-disk root; keeps tenants isolated at the filesystem level. */
export function workspaceRoot(userId: string, projectId: string): string {
  return dataPath("workspaces", assertSafeId(userId, "user id"), assertSafeId(projectId, "project id"));
}

export function baselineRoot(userId: string, projectId: string): string {
  return dataPath("baselines", assertSafeId(userId, "user id"), assertSafeId(projectId, "project id"));
}

export function isSecretFile(relativePath: string): boolean {
  const base = path.basename(relativePath).toLowerCase();
  if (DENIED_NAMES.has(base)) return true;
  if (base === ".env" || base.startsWith(".env.")) return true;
  if (base.endsWith(".pem") || base.endsWith(".key") || base.endsWith(".p12") || base.endsWith(".pfx")) return true;
  if (relativePath.split(/[\\/]/).some((part) => part === ".git")) return true;
  return false;
}

/** Resolve a relative path inside the workspace, rejecting traversal and symlinks. */
export async function resolveInside(root: string, relativePath: string): Promise<string> {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new WorkspaceError("A file path is required.", 400);
  }
  if (relativePath.includes("\0")) throw new WorkspaceError("Invalid file path.", 400);
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) {
    throw new WorkspaceError("Absolute paths are not allowed.", 400);
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === ".." || segment === ".")) {
    throw new WorkspaceError("Path traversal is not allowed.", 400);
  }
  if (segments.some((segment) => SKIP_DIRS.has(segment))) {
    throw new WorkspaceError("That directory is excluded from the workspace.", 400);
  }
  const absolute = path.resolve(root, normalized);
  const rootReal = await fs.realpath(root).catch(() => path.resolve(root));
  if (absolute !== rootReal && !absolute.startsWith(rootReal + path.sep)) {
    throw new WorkspaceError("Path escapes the project workspace.", 400);
  }
  // Reject symlinks that point outside the workspace.
  try {
    const stat = await fs.lstat(absolute);
    if (stat.isSymbolicLink()) {
      const target = await fs.realpath(absolute);
      if (target !== rootReal && !target.startsWith(rootReal + path.sep)) {
        throw new WorkspaceError("Symlinks outside the workspace are not allowed.", 400);
      }
    }
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }
  return absolute;
}

export async function ensureWorkspace(userId: string, projectId: string): Promise<string> {
  const root = workspaceRoot(userId, projectId);
  await fs.mkdir(root, { recursive: true });
  return root;
}

export async function writeProjectFiles(
  userId: string,
  projectId: string,
  files: Record<string, string>,
): Promise<void> {
  const root = await ensureWorkspace(userId, projectId);
  for (const [relative, content] of Object.entries(files)) {
    const target = await resolveInside(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, "utf8");
  }
}

export type TreeNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  children?: TreeNode[];
};

export async function listTree(userId: string, projectId: string): Promise<TreeNode> {
  const root = await ensureWorkspace(userId, projectId);
  let count = 0;
  async function walk(absolute: string, prefix: string): Promise<TreeNode[]> {
    const entries = await fs.readdir(absolute, { withFileTypes: true });
    const nodes: TreeNode[] = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (count++ > MAX_TREE_ENTRIES) return nodes;
      if (entry.name.startsWith(".") && entry.name !== ".env.example") {
        if (entry.isDirectory()) continue;
      }
      if (SKIP_DIRS.has(entry.name)) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        nodes.push({ name: entry.name, path: rel, type: "directory", children: await walk(path.join(absolute, entry.name), rel) });
      } else if (entry.isFile()) {
        const stat = await fs.stat(path.join(absolute, entry.name));
        nodes.push({ name: entry.name, path: rel, type: "file", size: stat.size });
      }
    }
    return nodes;
  }
  const children = await walk(root, "");
  return { name: "project", path: "", type: "directory", children };
}

export async function readFile(userId: string, projectId: string, relativePath: string): Promise<string> {
  const root = await ensureWorkspace(userId, projectId);
  const absolute = await resolveInside(root, relativePath);
  const stat = await fs.stat(absolute).catch(() => null);
  if (!stat || !stat.isFile()) throw new WorkspaceError("File not found.", 404);
  if (stat.size > MAX_FILE_BYTES) throw new WorkspaceError("File is too large to open in the editor (limit 512 KB).", 413);
  const buffer = await fs.readFile(absolute);
  if (buffer.includes(0)) throw new WorkspaceError("Binary files cannot be opened in the text editor.", 415);
  return buffer.toString("utf8");
}

export async function writeFile(
  userId: string,
  projectId: string,
  relativePath: string,
  content: string,
): Promise<{ path: string; bytes: number }> {
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    throw new WorkspaceError("File exceeds the 512 KB editor limit.", 413);
  }
  const root = await ensureWorkspace(userId, projectId);
  const absolute = await resolveInside(root, relativePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content, "utf8");
  return { path: relativePath, bytes: Buffer.byteLength(content, "utf8") };
}

export async function createEntry(
  userId: string,
  projectId: string,
  relativePath: string,
  kind: "file" | "directory",
): Promise<void> {
  const root = await ensureWorkspace(userId, projectId);
  const absolute = await resolveInside(root, relativePath);
  if (await fs.stat(absolute).catch(() => null)) throw new WorkspaceError("That path already exists.", 409);
  if (kind === "directory") {
    await fs.mkdir(absolute, { recursive: true });
  } else {
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, "", { flag: "wx" });
  }
}

export async function deleteEntry(userId: string, projectId: string, relativePath: string): Promise<void> {
  const root = await ensureWorkspace(userId, projectId);
  const absolute = await resolveInside(root, relativePath);
  if (absolute === root) throw new WorkspaceError("Refusing to delete the project root.", 400);
  await fs.rm(absolute, { recursive: true, force: true });
}

export async function renameEntry(
  userId: string,
  projectId: string,
  from: string,
  to: string,
): Promise<void> {
  const root = await ensureWorkspace(userId, projectId);
  const source = await resolveInside(root, from);
  const target = await resolveInside(root, to);
  if (await fs.stat(target).catch(() => null)) throw new WorkspaceError("Destination already exists.", 409);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.rename(source, target);
}

export async function readAllFiles(
  userId: string,
  projectId: string,
  options: { includeSecrets?: boolean; maxFiles?: number } = {},
): Promise<Array<{ path: string; content: string }>> {
  const root = await ensureWorkspace(userId, projectId);
  const maxFiles = options.maxFiles ?? 800;
  const out: Array<{ path: string; content: string }> = [];
  async function walk(absolute: string, prefix: string) {
    if (out.length >= maxFiles) return;
    const entries = await fs.readdir(absolute, { withFileTypes: true });
    for (const entry of entries) {
      if (out.length >= maxFiles) return;
      if (SKIP_DIRS.has(entry.name)) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(absolute, entry.name), rel);
      } else if (entry.isFile()) {
        if (!options.includeSecrets && isSecretFile(rel)) continue;
        const buffer = await fs.readFile(path.join(absolute, entry.name));
        if (buffer.length > MAX_FILE_BYTES || buffer.includes(0)) continue;
        out.push({ path: rel, content: buffer.toString("utf8") });
      }
    }
  }
  await walk(root, "");
  return out;
}

export async function copyTree(source: string, destination: string): Promise<void> {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyTree(from, to);
    else if (entry.isFile()) await fs.copyFile(from, to);
  }
}

export async function snapshotBaseline(userId: string, projectId: string): Promise<void> {
  const root = await ensureWorkspace(userId, projectId);
  const base = baselineRoot(userId, projectId);
  await fs.rm(base, { recursive: true, force: true });
  await copyTree(root, base);
}

export async function searchInFiles(
  userId: string,
  projectId: string,
  query: string,
  useRegex = false,
): Promise<Array<{ path: string; line: number; text: string }>> {
  if (!query || query.length > 200) throw new WorkspaceError("Search query must be 1–200 characters.", 400);
  let matcher: RegExp;
  try {
    matcher = useRegex ? new RegExp(query, "i") : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  } catch {
    throw new WorkspaceError("Invalid regular expression.", 400);
  }
  const files = await readAllFiles(userId, projectId, { includeSecrets: false, maxFiles: 500 });
  const results: Array<{ path: string; line: number; text: string }> = [];
  for (const file of files) {
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length && results.length < 200; i++) {
      if (matcher.test(lines[i])) {
        results.push({ path: file.path, line: i + 1, text: lines[i].slice(0, 300) });
      }
    }
    if (results.length >= 200) break;
  }
  return results;
}

export async function fileStream(userId: string, projectId: string, relativePath: string) {
  const root = await ensureWorkspace(userId, projectId);
  const absolute = await resolveInside(root, relativePath);
  const stat = await fs.stat(absolute);
  if (!stat.isFile()) throw new WorkspaceError("Not a file.", 400);
  return { stream: createReadStream(absolute), size: stat.size };
}

/** Read text files from an arbitrary root (used for baseline comparisons). */
export async function readFilesFromRoot(
  root: string,
  options: { includeSecrets?: boolean; maxFiles?: number } = {},
): Promise<Array<{ path: string; content: string }>> {
  const maxFiles = options.maxFiles ?? 800;
  const out: Array<{ path: string; content: string }> = [];
  async function walk(absolute: string, prefix: string) {
    if (out.length >= maxFiles) return;
    const entries = await fs.readdir(absolute, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (out.length >= maxFiles) return;
      if (SKIP_DIRS.has(entry.name)) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(absolute, entry.name), rel);
      } else if (entry.isFile()) {
        if (!options.includeSecrets && isSecretFile(rel)) continue;
        const buffer = await fs.readFile(path.join(absolute, entry.name));
        if (buffer.length > MAX_FILE_BYTES || buffer.includes(0)) continue;
        out.push({ path: rel, content: buffer.toString("utf8") });
      }
    }
  }
  await walk(root, "");
  return out;
}
