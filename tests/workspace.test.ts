import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { getDb, nowIso } from "@/lib/db";
import {
  createEntry,
  deleteEntry,
  ensureWorkspace,
  isSecretFile,
  listTree,
  readFile,
  readFilesFromRoot,
  renameEntry,
  resolveInside,
  searchInFiles,
  snapshotBaseline,
  baselineRoot,
  workspaceRoot,
  writeFile,
  writeProjectFiles,
} from "@/lib/workspace/fs";
import { createProject, computeChanges, createChangeRecord, decideChange, requireProject } from "@/lib/projects";
import { buildTemplate, TEMPLATES } from "@/lib/workspace/templates";

const userId = "usr_workspace_test_user";

beforeEach(async () => {
  const db = getDb();
  db.exec("DELETE FROM changes; DELETE FROM projects; DELETE FROM users;");
  const ts = nowIso();
  db.prepare("INSERT OR REPLACE INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(userId, "ws@example.com", "WS", "x", ts, ts);
  await fs.rm(path.join(workspaceRoot(userId, "prj_test")), { recursive: true, force: true });
  await fs.rm(baselineRoot(userId, "prj_test"), { recursive: true, force: true });
});

describe("workspace file safety", () => {
  it("rejects traversal, absolute paths, excluded dirs and null bytes", async () => {
    await ensureWorkspace(userId, "prj_test");
    await expect(resolveInside(workspaceRoot(userId, "prj_test"), "../escape.txt")).rejects.toThrow(/traversal/);
    await expect(resolveInside(workspaceRoot(userId, "prj_test"), "/etc/passwd")).rejects.toThrow(/Absolute/);
    await expect(resolveInside(workspaceRoot(userId, "prj_test"), "node_modules/pkg/index.js")).rejects.toThrow(/excluded/);
    await expect(resolveInside(workspaceRoot(userId, "prj_test"), "a\0b")).rejects.toThrow(/Invalid/);
  });

  it("writes, reads, searches, renames and deletes real files", async () => {
    await writeFile(userId, "prj_test", "src/app.js", "console.log('hello');\n");
    expect(await readFile(userId, "prj_test", "src/app.js")).toContain("hello");
    await createEntry(userId, "prj_test", "src/lib", "directory");
    expect((await listTree(userId, "prj_test")).children?.[0].name).toBe("src");
    const hits = await searchInFiles(userId, "prj_test", "hello");
    expect(hits[0].path).toBe("src/app.js");
    await renameEntry(userId, "prj_test", "src/app.js", "src/main.js");
    expect(await readFile(userId, "prj_test", "src/main.js")).toContain("hello");
    await deleteEntry(userId, "prj_test", "src/main.js");
    await expect(readFile(userId, "prj_test", "src/main.js")).rejects.toThrow(/not found/);
  });

  it("flags secret files so they are never published", () => {
    expect(isSecretFile(".env")).toBe(true);
    expect(isSecretFile("config/.env.local")).toBe(true);
    expect(isSecretFile("keys/server.pem")).toBe(true);
    expect(isSecretFile("id_rsa")).toBe(true);
    expect(isSecretFile("src/index.ts")).toBe(false);
  });

  it("does not include secret files in publishable diffs", async () => {
    const project = await createProject(userId, { name: "Secrets", template: "blank" });
    await writeProjectFiles(userId, project.id, { "index.html": "<h1>a</h1>", ".env": "SECRET=1" });
    await snapshotBaseline(userId, project.id);
    await writeProjectFiles(userId, project.id, { "index.html": "<h1>b</h1>", ".env": "SECRET=2" });
    const diffs = await computeChanges(userId, project.id);
    expect(diffs.find((d) => d.path === ".env")?.publishable).toBe(false);
    expect(diffs.find((d) => d.path === "index.html")?.publishable).toBe(true);
  });
});

describe("projects and review", () => {
  it("creates a project from a template with real files and a baseline", async () => {
    const project = await createProject(userId, { name: "Demo Site", template: "website" });
    const files = await readFilesFromRoot(workspaceRoot(userId, project.id));
    expect(files.map((f) => f.path)).toContain("index.html");
    expect(files.map((f) => f.path)).toContain("style.css");
    expect(await computeChanges(userId, project.id)).toHaveLength(0);
  });

  it("computes a real unified diff after an edit", async () => {
    const project = await createProject(userId, { name: "Demo", template: "blank" });
    await writeFile(userId, project.id, "README.md", "# Changed\n");
    const diffs = await computeChanges(userId, project.id);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].patch).toContain("+# Changed");
    expect(diffs[0].additions).toBeGreaterThan(0);
  });

  it("requires approval before a change is publishable and keeps baselines on approve", async () => {
    const project = await createProject(userId, { name: "Review", template: "blank" });
    await writeFile(userId, project.id, "notes.md", "# Updated\n");
    const diffs = await computeChanges(userId, project.id);
    const changeId = createChangeRecord(userId, project.id, { summary: "Update notes", diffs });
    const row = getDb().prepare("SELECT status FROM changes WHERE id = ?").get(changeId) as any;
    expect(row.status).toBe("pending");
    await decideChange(userId, changeId, "approved");
    expect((getDb().prepare("SELECT status FROM changes WHERE id = ?").get(changeId) as any).status).toBe("approved");
    expect(await computeChanges(userId, project.id)).toHaveLength(0);
  });

  it("isolates projects between users", async () => {
    const project = await createProject(userId, { name: "Private", template: "blank" });
    const ts = nowIso();
    getDb().prepare("INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run("usr_intruder", "intruder@example.com", "I", "x", ts, ts);
    expect(() => requireProject("usr_intruder", project.id)).toThrow(/not found/);
  });
});

describe("templates", () => {
  it("ships real files for every template", () => {
    for (const template of TEMPLATES) {
      const files = buildTemplate(template.id, "Test");
      expect(Object.keys(files).length).toBeGreaterThan(0);
      expect(files["README.md"] ?? Object.values(files)[0]).toBeTruthy();
    }
  });

  it("includes runnable test files in the api and python templates", () => {
    expect(Object.keys(buildTemplate("api", "x"))).toContain("test/api.test.js");
    expect(Object.keys(buildTemplate("python", "x"))).toContain("test_main.py");
  });
});
