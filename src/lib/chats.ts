import "server-only";
import { all, getDb, newId, nowIso, one } from "./db";
import { getProject, type Project } from "./projects";
import { getRepository } from "./github/connection";
import type { AgentMode } from "./ai/modes";

export type Chat = {
  id: string;
  user_id: string;
  project_id: string | null;
  repository_id: string | null;
  branch: string | null;
  title: string;
  mode: AgentMode;
  model_ref: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  chat_id: string;
  user_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  model_ref: string | null;
  citations_json: string | null;
  events_json: string | null;
  status: string;
  error: string | null;
  seq: number;
  created_at: string;
};

export function listChats(userId: string, archived = false): Chat[] {
  return all<Chat>(
    "SELECT * FROM chats WHERE user_id = ? AND archived = ? ORDER BY updated_at DESC LIMIT 200",
    userId,
    archived ? 1 : 0,
  );
}

export function getChat(userId: string, id: string): Chat | undefined {
  return one<Chat>("SELECT * FROM chats WHERE id = ? AND user_id = ?", id, userId);
}

export function requireChat(userId: string, id: string): Chat {
  const chat = getChat(userId, id);
  if (!chat) throw Object.assign(new Error("Chat not found."), { status: 404 });
  return chat;
}

export function createChat(
  userId: string,
  input: {
    title?: string;
    mode?: AgentMode;
    projectId?: string | null;
    repositoryId?: string | null;
    branch?: string | null;
    modelRef?: string | null;
  },
): Chat {
  if (input.projectId && !getProject(userId, input.projectId)) {
    throw Object.assign(new Error("Project not found."), { status: 404 });
  }
  if (input.repositoryId && !getRepository(userId, input.repositoryId)) {
    throw Object.assign(new Error("Repository not found."), { status: 404 });
  }
  const ts = nowIso();
  const id = newId("cht");
  getDb()
    .prepare(
      `INSERT INTO chats (id, user_id, project_id, repository_id, branch, title, mode, model_ref, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      userId,
      input.projectId ?? null,
      input.repositoryId ?? null,
      input.branch ?? null,
      (input.title ?? "New chat").slice(0, 120),
      input.mode ?? "ask",
      input.modelRef ?? null,
      ts,
      ts,
    );
  return requireChat(userId, id);
}

export function updateChat(
  userId: string,
  id: string,
  input: Partial<Pick<Chat, "title" | "mode">> & {
    archived?: boolean;
    projectId?: string | null;
    repositoryId?: string | null;
    branch?: string | null;
    modelRef?: string | null;
  },
): Chat {
  const chat = requireChat(userId, id);
  const fields: string[] = [];
  const values: any[] = [];
  if (input.title !== undefined) {
    fields.push("title = ?");
    values.push(input.title.trim().slice(0, 120) || "Untitled chat");
  }
  if (input.mode !== undefined) {
    fields.push("mode = ?");
    values.push(input.mode);
  }
  if (input.archived !== undefined) {
    fields.push("archived = ?");
    values.push(input.archived ? 1 : 0);
  }
  if (input.projectId !== undefined) {
    if (input.projectId && !getProject(userId, input.projectId)) {
      throw Object.assign(new Error("Project not found."), { status: 404 });
    }
    fields.push("project_id = ?");
    values.push(input.projectId);
  }
  if (input.repositoryId !== undefined) {
    if (input.repositoryId && !getRepository(userId, input.repositoryId)) {
      throw Object.assign(new Error("Repository not found."), { status: 404 });
    }
    fields.push("repository_id = ?");
    values.push(input.repositoryId);
  }
  if (input.branch !== undefined) {
    fields.push("branch = ?");
    values.push(input.branch);
  }
  if (input.modelRef !== undefined) {
    fields.push("model_ref = ?");
    values.push(input.modelRef);
  }
  fields.push("updated_at = ?");
  values.push(nowIso());
  values.push(id, userId);
  getDb().prepare(`UPDATE chats SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`).run(...values);
  void chat;
  return requireChat(userId, id);
}

export function deleteChat(userId: string, id: string): void {
  requireChat(userId, id);
  getDb().prepare("DELETE FROM chats WHERE id = ? AND user_id = ?").run(id, userId);
}

export function listMessages(userId: string, chatId: string, limit = 200): Message[] {
  requireChat(userId, chatId);
  return all<Message>(
    "SELECT * FROM messages WHERE chat_id = ? AND user_id = ? ORDER BY seq ASC LIMIT ?",
    chatId,
    userId,
    limit,
  );
}

export function appendMessage(
  userId: string,
  chatId: string,
  input: {
    role: Message["role"];
    content: string;
    modelRef?: string | null;
    citations?: unknown;
    events?: unknown;
    status?: string;
    error?: string | null;
  },
): Message {
  const chat = requireChat(userId, chatId);
  const last = one<{ seq: number }>("SELECT MAX(seq) AS seq FROM messages WHERE chat_id = ?", chatId);
  const seq = (last?.seq ?? 0) + 1;
  const id = newId("msg");
  const ts = nowIso();
  getDb()
    .prepare(
      `INSERT INTO messages (id, chat_id, user_id, role, content, model_ref, citations_json, events_json, status, error, seq, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      chatId,
      userId,
      input.role,
      input.content,
      input.modelRef ?? null,
      input.citations === undefined ? null : JSON.stringify(input.citations),
      input.events === undefined ? null : JSON.stringify(input.events),
      input.status ?? "complete",
      input.error ?? null,
      seq,
      ts,
    );
  getDb().prepare("UPDATE chats SET updated_at = ? WHERE id = ?").run(ts, chat.id);
  if (chat.title === "New chat" && input.role === "user") {
    const title = input.content.replace(/\s+/g, " ").trim().slice(0, 70);
    getDb().prepare("UPDATE chats SET title = ? WHERE id = ?").run(title || "New chat", chat.id);
  }
  return one<Message>("SELECT * FROM messages WHERE id = ?", id)!;
}

export function updateMessage(
  userId: string,
  messageId: string,
  input: { content?: string; status?: string; citations?: unknown; events?: unknown; error?: string | null },
): void {
  const fields: string[] = [];
  const values: any[] = [];
  if (input.content !== undefined) {
    fields.push("content = ?");
    values.push(input.content);
  }
  if (input.status !== undefined) {
    fields.push("status = ?");
    values.push(input.status);
  }
  if (input.citations !== undefined) {
    fields.push("citations_json = ?");
    values.push(JSON.stringify(input.citations));
  }
  if (input.events !== undefined) {
    fields.push("events_json = ?");
    values.push(JSON.stringify(input.events));
  }
  if (input.error !== undefined) {
    fields.push("error = ?");
    values.push(input.error);
  }
  if (!fields.length) return;
  values.push(messageId, userId);
  getDb().prepare(`UPDATE messages SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`).run(...values);
}

export function chatContext(project: Project | undefined, branch: string | null) {
  if (!project) return { projectName: null, repository: null, branch };
  return {
    projectName: project.name,
    repository: project.repository_id ? project.repository_id : null,
    branch,
  };
}
