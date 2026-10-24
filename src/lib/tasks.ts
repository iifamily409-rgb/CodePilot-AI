import "server-only";
import { all, getDb, newId, nowIso, one } from "./db";
import { runAgent, type AgentEvent } from "./ai/agent";
import { modePrompt, projectContext, SECURITY_PREAMBLE } from "./ai/prompts";
import { getProject, computeChanges, createChangeRecord, requireProject } from "./projects";
import { listTree } from "./workspace/fs";
import { getRepository } from "./github/connection";
import { redactSecrets } from "./crypto";
import type { AgentMode } from "./ai/modes";

const running = new Set<string>();

export type Task = {
  id: string;
  user_id: string;
  project_id: string | null;
  chat_id: string | null;
  title: string;
  goal: string;
  mode: AgentMode;
  status: string;
  model_ref: string | null;
  plan_json: string | null;
  logs_json: string | null;
  result: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export function listTasks(userId: string): Task[] {
  return all<Task>("SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", userId);
}

export function getTask(userId: string, id: string): Task | undefined {
  return one<Task>("SELECT * FROM tasks WHERE id = ? AND user_id = ?", id, userId);
}

export function createTask(
  userId: string,
  input: { title: string; goal: string; mode: AgentMode; projectId: string | null; modelRef: string },
): Task {
  if (input.projectId) requireProject(userId, input.projectId);
  const id = newId("tsk");
  const ts = nowIso();
  getDb()
    .prepare(
      `INSERT INTO tasks (id, user_id, project_id, title, goal, mode, status, model_ref, logs_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, '[]', ?, ?)`,
    )
    .run(id, userId, input.projectId, input.title.slice(0, 140), input.goal.slice(0, 4000), input.mode, input.modelRef, ts, ts);
  return getTask(userId, id)!;
}

export function appendTaskLog(userId: string, id: string, entry: Record<string, unknown>): void {
  const task = getTask(userId, id);
  if (!task) return;
  const logs = JSON.parse(task.logs_json ?? "[]");
  logs.push({ at: nowIso(), ...entry });
  getDb()
    .prepare("UPDATE tasks SET logs_json = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(logs.slice(-200)), nowIso(), id);
}

export function cancelTask(userId: string, id: string): void {
  const task = getTask(userId, id);
  if (!task) throw Object.assign(new Error("Task not found."), { status: 404 });
  if (["completed", "failed", "cancelled"].includes(task.status)) return;
  getDb()
    .prepare("UPDATE tasks SET status = 'cancelled', updated_at = ? WHERE id = ?")
    .run(nowIso(), id);
}

/**
 * Runs in-process (single-node deployment). Documented limitation: tasks do
 * not survive a server restart and are not distributed across instances.
 */
export function startTask(userId: string, taskId: string): void {
  if (running.has(taskId)) return;
  running.add(taskId);
  void (async () => {
    const task = getTask(userId, taskId);
    if (!task) return;
    getDb().prepare("UPDATE tasks SET status = 'running', updated_at = ? WHERE id = ?").run(nowIso(), taskId);
    const project = task.project_id ? getProject(userId, task.project_id) : undefined;
    const repository = project?.repository_id ? getRepository(userId, project.repository_id) : null;
    let tree: string | null = null;
    if (project) {
      try {
        const node = await listTree(userId, project.id);
        const flat: string[] = [];
        const walk = (n: any, depth = 0) => {
          if (flat.length > 150) return;
          flat.push(`${"  ".repeat(depth)}${n.name}${n.type === "directory" ? "/" : ""}`);
          (n.children ?? []).forEach((c: any) => walk(c, depth + 1));
        };
        walk(node);
        tree = flat.join("\n");
      } catch {
        tree = null;
      }
    }
    const systemPrompt = [
      SECURITY_PREAMBLE,
      modePrompt(task.mode),
      projectContext({ projectName: project?.name, repository: repository?.full_name, tree }),
      "You are running as a background task. Work autonomously, verify with real commands, and finish with a concise summary of changes and test results.",
    ].join("\n\n");
    try {
      const result = await runAgent({
        userId,
        mode: task.mode,
        modelRef: task.model_ref!,
        messages: [{ role: "user", content: task.goal }],
        systemPrompt,
        projectId: project?.id ?? null,
        repositoryId: repository?.id ?? null,
        signal: new AbortController().signal,
        onEvent: (event: AgentEvent) => {
          if (event.type === "plan") {
            getDb().prepare("UPDATE tasks SET plan_json = ? WHERE id = ?").run(JSON.stringify(event.steps), taskId);
          }
          if (event.type === "tool_start") {
            appendTaskLog(userId, taskId, { kind: "tool_start", tool: event.name });
          }
          if (event.type === "tool_result") {
            appendTaskLog(userId, taskId, { kind: "tool_result", tool: event.name, ok: event.ok, summary: event.summary.slice(0, 300) });
          }
          if (event.type === "fallback") {
            appendTaskLog(userId, taskId, { kind: "fallback", from: event.from, to: event.to });
          }
          if (event.type === "error") {
            appendTaskLog(userId, taskId, { kind: "error", message: event.message });
          }
        },
      });
      let changeId: string | null = null;
      if (project && task.mode !== "ask") {
        const diffs = await computeChanges(userId, project.id);
        if (diffs.length) {
          changeId = createChangeRecord(userId, project.id, {
            summary: task.title,
            diffs,
            testOutput: result.text.slice(-4000),
            taskId,
          });
        }
      }
      getDb()
        .prepare(
          "UPDATE tasks SET status = ?, result = ?, updated_at = ? WHERE id = ?",
        )
        .run("awaiting_approval", redactSecrets(result.text), nowIso(), taskId);
      if (changeId) appendTaskLog(userId, taskId, { kind: "change_ready", changeId });
    } catch (error) {
      const message = redactSecrets(error instanceof Error ? error.message : "Task failed.");
      getDb()
        .prepare("UPDATE tasks SET status = 'failed', error = ?, updated_at = ? WHERE id = ?")
        .run(message, nowIso(), taskId);
      appendTaskLog(userId, taskId, { kind: "error", message });
    } finally {
      running.delete(taskId);
    }
  })();
}
