"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/client/api";
import { useSession } from "../session-context";
import { Badge, Spinner, cx } from "../ui";
import { MessageBubble, type ChatEvent, type ChatMessageRow, type Citation } from "./message";

type Chat = {
  id: string;
  title: string;
  mode: "ask" | "code" | "agent";
  model_ref: string | null;
  project_id: string | null;
  repository_id: string | null;
  branch: string | null;
  archived: number;
  updated_at: string;
};

type ModelOption = {
  ref: string;
  displayName: string;
  provider: { name: string } | null;
  pricingStatus: string;
  capabilities: Record<string, boolean>;
  contextLength: number | null;
};

const MODES: Array<{ id: "ask" | "code" | "agent"; label: string; hint: string }> = [
  { id: "ask", label: "Ask", hint: "Explain and research; no file writes" },
  { id: "code", label: "Code", hint: "Edit files and run checks" },
  { id: "agent", label: "Agent", hint: "Plan multi-step work and verify" },
];

const SUGGESTIONS = [
  "Explain the structure of this project and where to start.",
  "Find bugs in the current workspace and propose fixes.",
  "Create a landing page with a hero, features and a contact section.",
  "Search the latest official documentation for the framework in use.",
  "Write tests for the main module and resolve build errors.",
  "Prepare a pull request for your changes.",
];

export function ChatWorkspace({ initialChatId }: { initialChatId?: string }) {
  const { csrfToken } = useSession();
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [repos, setRepos] = useState<Array<{ id: string; full_name: string; default_branch: string }>>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [mode, setMode] = useState<"ask" | "code" | "agent">("ask");
  const [modelRef, setModelRef] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [repositoryId, setRepositoryId] = useState<string>("");
  const [branch, setBranch] = useState<string>("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamEvents, setStreamEvents] = useState<ChatEvent[]>([]);
  const [streamCitations, setStreamCitations] = useState<Citation[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const eligibleModels = useMemo(() => models.filter((m) => m.pricingStatus === "verified_free" || m.pricingStatus === "local"), [models]);

  const loadChat = useCallback(async (id: string, modelOptions: ModelOption[] = []) => {
    setError(null);
    setNotice(null);
    try {
      const data = await api<{ chat: Chat; messages: any[] }>(`/api/chats/${id}`);
      setActive(data.chat);
      setMode(data.chat.mode);
      const eligible = modelOptions.filter(
        (m) => m.pricingStatus === "verified_free" || m.pricingStatus === "local",
      );
      const saved = data.chat.model_ref ?? "";
      if (saved && eligible.length && !eligible.some((m) => m.ref === saved)) {
        setModelRef(eligible[0].ref);
        setNotice(
          `This conversation was saved with a model that is no longer eligible under the free-only policy. Switched to ${eligible[0].displayName}; choose another eligible model above if you prefer.`,
        );
      } else {
        setModelRef(saved || eligible[0]?.ref || "");
      }
      setProjectId(data.chat.project_id ?? "");
      setRepositoryId(data.chat.repository_id ?? "");
      setBranch(data.chat.branch ?? "");
      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          status: m.status,
          error: m.error,
          model_ref: m.model_ref,
          citations: m.citations_json ? JSON.parse(m.citations_json) : [],
          events: m.events_json ? JSON.parse(m.events_json) : [],
          created_at: m.created_at,
        })),
      );
      window.history.replaceState(null, "", `/app/chat/${id}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [chatData, modelData, projectData, repoData] = await Promise.all([
          api<{ chats: Chat[] }>("/api/chats"),
          api<{ models: ModelOption[] }>("/api/models"),
          api<{ projects: Array<{ id: string; name: string }> }>("/api/projects"),
          api<{ repositories: Array<{ id: string; full_name: string; default_branch: string }> }>("/api/github/repos").catch(() => ({ repositories: [] })),
        ]);
        if (cancelled) return;
        setChats(chatData.chats);
        setModels(modelData.models);
        setProjects(projectData.projects);
        setRepos(repoData.repositories);
        const eligible = modelData.models.filter((m) => m.pricingStatus === "verified_free" || m.pricingStatus === "local");
        if (initialChatId) {
          await loadChat(initialChatId, eligible);
        } else if (eligible.length) {
          setModelRef((current) => current || eligible[0].ref!);
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [initialChatId, loadChat]);

  useEffect(() => {
    if (!repositoryId) {
      setBranches([]);
      return;
    }
    let cancelled = false;
    api<{ branches: string[] }>(`/api/github/repos/${repositoryId}/branches`)
      .then((data) => {
        if (!cancelled) setBranches(data.branches);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [repositoryId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamText, streamEvents]);

  async function ensureChat(): Promise<Chat> {
    if (active) return active;
    const created = await api<{ chat: Chat }>("/api/chats", {
      method: "POST",
      body: {
        title: input.slice(0, 70) || "New chat",
        mode,
        modelRef: modelRef || null,
        projectId: projectId || null,
        repositoryId: repositoryId || null,
        branch: branch || null,
      },
    });
    setChats((prev) => [created.chat, ...prev]);
    setActive(created.chat);
    window.history.replaceState(null, "", `/app/chat/${created.chat.id}`);
    return created.chat;
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    if (!modelRef) {
      setError("Select a verified-free or local model first. Add a provider in Provider Manager if the list is empty.");
      return;
    }
    setError(null);
    setInput("");
    setSending(true);
    setStreamText("");
    setStreamEvents([]);
    setStreamCitations([]);
    setStatus("Connecting…");
    let chat: Chat;
    try {
      chat = await ensureChat();
    } catch (err) {
      setError(errorMessage(err));
      setSending(false);
      return;
    }
    const userMessage: ChatMessageRow = { id: `local-${Date.now()}`, role: "user", content, status: "complete" };
    setMessages((prev) => [...prev, userMessage]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch(`/api/chats/${chat.id}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ content, modelRef, mode }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Request failed (HTTP ${response.status}).`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let textAccum = "";
      const events: ChatEvent[] = [];
      const citations: Citation[] = [];
      let failure: string | null = null;
      setStatus("Generating…");
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);
          if (chunk.startsWith("data:")) {
            const raw = chunk.slice(5).trim();
            let event: any;
            try {
              event = JSON.parse(raw);
            } catch {
              event = null;
            }
            if (event) {
              if (event.type === "text") {
                textAccum += event.text;
                setStreamText(textAccum);
              } else if (event.type === "tool_start") {
                setStatus(`Running ${event.name}…`);
                events.push({ type: "tool_start", name: event.name });
                setStreamEvents([...events]);
              } else if (event.type === "tool_result") {
                events.push({ type: "tool_result", name: event.name, ok: event.ok, summary: event.summary });
                setStreamEvents([...events]);
                setStatus("Thinking…");
              } else if (event.type === "plan") {
                events.push({ type: "plan", steps: event.steps });
                setStreamEvents([...events]);
              } else if (event.type === "citation") {
                citations.push(event.citation);
                setStreamCitations([...citations]);
              } else if (event.type === "fallback") {
                events.push({ type: "tool_result", name: "model_fallback", ok: true, summary: `${event.from} → ${event.to}: ${event.reason}` });
                setStreamEvents([...events]);
              } else if (event.type === "error") {
                failure = event.message;
              } else if (event.type === "saved") {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: event.messageId,
                    role: "assistant",
                    content: textAccum,
                    status: failure ? "error" : controller.signal.aborted ? "stopped" : "complete",
                    error: failure,
                    model_ref: modelRef,
                    citations,
                    events: events.filter((e) => e.type !== "tool_start"),
                  },
                ]);
                setStreamText("");
                setStreamEvents([]);
                setStreamCitations([]);
              }
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
      if (failure) setError(failure);
      const refreshed = await api<{ chats: Chat[] }>("/api/chats");
      setChats(refreshed.chats);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus(null);
        setMessages((prev) => [
          ...prev,
          { id: `stopped-${Date.now()}`, role: "assistant", content: streamText, status: "stopped", events: streamEvents, citations: streamCitations },
        ]);
        setStreamText("");
        setStreamEvents([]);
        setStreamCitations([]);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSending(false);
      setStatus(null);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setStatus("Stopping…");
  }

  async function newChat() {
    abortRef.current?.abort();
    setActive(null);
    setMessages([]);
    setStreamText("");
    setStreamEvents([]);
    setStreamCitations([]);
    setError(null);
    window.history.replaceState(null, "", "/app/chat");
  }

  async function updateActive(patch: Record<string, unknown>) {
    if (!active) return;
    const data = await api<{ chat: Chat }>(`/api/chats/${active.id}`, { method: "PATCH", body: patch });
    setActive(data.chat);
    setChats((prev) => prev.map((c) => (c.id === data.chat.id ? data.chat : c)));
  }

  async function renameChat(chat: Chat) {
    const title = window.prompt("Rename conversation", chat.title)?.trim();
    if (!title) return;
    if (active?.id === chat.id) {
      await updateActive({ title });
      return;
    }
    await api(`/api/chats/${chat.id}`, { method: "PATCH", body: { title } });
    setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, title } : c)));
  }

  async function deleteChat(chat: Chat) {
    if (!window.confirm(`Delete "${chat.title}"? This cannot be undone.`)) return;
    await api(`/api/chats/${chat.id}`, { method: "DELETE" });
    setChats((prev) => prev.filter((c) => c.id !== chat.id));
    if (active?.id === chat.id) await newChat();
  }

  async function archiveChat(chat: Chat) {
    await api(`/api/chats/${chat.id}`, { method: "PATCH", body: { archived: true } });
    setChats((prev) => prev.filter((c) => c.id !== chat.id));
    if (active?.id === chat.id) await newChat();
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="cp-card hidden max-h-[calc(100vh-140px)] flex-col overflow-hidden p-0 lg:flex">
        <div className="border-b border-border p-3">
          <button type="button" onClick={newChat} className="cp-btn cp-btn-primary w-full !py-1.5 !text-xs">+ New chat</button>
        </div>
        <div className="cp-scroll flex-1 space-y-1 overflow-y-auto p-2">
          {chats.length === 0 ? <p className="p-2 text-xs text-muted">No conversations yet.</p> : null}
          {chats.map((chat) => (
            <div key={chat.id} className={cx("group rounded-lg border p-2 text-xs", active?.id === chat.id ? "border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--accent)_9%,transparent)]" : "border-transparent hover:bg-surface2")}>
              <button type="button" onClick={() => loadChat(chat.id, eligibleModels)} className="block w-full truncate text-left font-medium">
                {chat.title}
              </button>
              <div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-muted">
                <span>{chat.mode}</span>
                <span className="hidden gap-1 group-hover:flex">
                  <button type="button" onClick={() => renameChat(chat)} className="hover:text-fg">rename</button>
                  <button type="button" onClick={() => archiveChat(chat)} className="hover:text-fg">archive</button>
                  <button type="button" onClick={() => deleteChat(chat)} className="hover:text-danger">delete</button>
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3 text-[11px] text-muted">
          <Link href="/app/history" className="cp-link">Full history</Link>
        </div>
      </aside>

      <section className="cp-card flex min-h-[calc(100vh-140px)] flex-col overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="flex rounded-lg border border-border bg-bgsoft p-0.5">
            {MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                title={option.hint}
                onClick={() => {
                  setMode(option.id);
                  if (active) void updateActive({ mode: option.id });
                }}
                className={cx("rounded-md px-2.5 py-1 text-xs font-medium", mode === option.id ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg")}
              >
                {option.label}
              </button>
            ))}
          </div>
          <select
            className="cp-input !w-auto max-w-[280px] !py-1.5 !text-xs"
            value={modelRef}
            onChange={(e) => {
              setModelRef(e.target.value);
              setNotice(null);
              if (active) void updateActive({ modelRef: e.target.value || null });
            }}
            aria-label="Model"
          >
            <option value="">{eligibleModels.length ? "Select a model" : "No eligible models"}</option>
            {eligibleModels.map((model) => (
              <option key={model.ref} value={model.ref}>
                {model.provider?.name ?? "?"} · {model.displayName}{model.pricingStatus === "local" ? " (local)" : ""}
              </option>
            ))}
          </select>
          <select
            className="cp-input !w-auto max-w-[200px] !py-1.5 !text-xs"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              if (active) void updateActive({ projectId: e.target.value || null });
            }}
            aria-label="Project"
          >
            <option value="">No project</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select
            className="cp-input !w-auto max-w-[200px] !py-1.5 !text-xs"
            value={repositoryId}
            onChange={(e) => {
              setRepositoryId(e.target.value);
              setBranch("");
              if (active) void updateActive({ repositoryId: e.target.value || null, branch: null });
            }}
            aria-label="Repository"
          >
            <option value="">No repository</option>
            {repos.map((repo) => <option key={repo.id} value={repo.id}>{repo.full_name}</option>)}
          </select>
          {repositoryId && branches.length ? (
            <select
              className="cp-input !w-auto max-w-[180px] !py-1.5 !text-xs"
              value={branch}
              onChange={(e) => {
                setBranch(e.target.value);
                if (active) void updateActive({ branch: e.target.value || null });
              }}
              aria-label="Branch"
            >
              <option value="">default branch</option>
              {branches.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          ) : null}
          <span className="ml-auto text-[11px] text-muted">{status ?? `${eligibleModels.length} eligible model(s)`}</span>
        </div>

        {active ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted">
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none"
              value={active.title}
              onChange={(e) => setActive({ ...active, title: e.target.value })}
              onBlur={() => updateActive({ title: active.title })}
              aria-label="Chat title"
            />
            <Badge>{mode}</Badge>
          </div>
        ) : null}

        <div ref={scrollRef} className="cp-scroll flex-1 space-y-4 overflow-y-auto p-4">
          {loading ? <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Loading workspace…</div> : null}
          {!loading && messages.length === 0 && !streamText ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">What should we build?</h2>
                <p className="mt-1 text-sm text-muted">
                  {eligibleModels.length
                    ? "Ask a question, describe a change, or switch to Agent mode for a multi-step task."
                    : "Add a provider and select a verified-free or local model before chatting."}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => send(suggestion)} disabled={!eligibleModels.length} className="rounded-lg border border-border bg-bgsoft p-3 text-left text-xs text-muted hover:border-borderstrong hover:text-fg disabled:opacity-50">
                    {suggestion}
                  </button>
                ))}
              </div>
              {error ? <p className="rounded-lg border border-border bg-bgsoft p-3 text-xs text-danger">{error}</p> : null}
            </div>
          ) : null}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              projectId={active?.project_id}
              retryDisabled={sending}
              onRetry={lastUser ? () => send(lastUser.content) : undefined}
            />
          ))}
          {streamText || streamEvents.length ? (
            <MessageBubble
              message={{
                id: "streaming",
                role: "assistant",
                content: streamText,
                status: "streaming",
                model_ref: modelRef,
                events: streamEvents.filter((e) => e.type !== "tool_start"),
                citations: streamCitations,
              }}
            />
          ) : null}
          {sending && !streamText ? (
            <div className="flex items-center gap-2 text-xs text-muted"><Spinner /> {status ?? "Working…"}</div>
          ) : null}
        </div>

        <div className="border-t border-border p-3">
          {notice ? (
            <p className="mb-2 rounded-lg border border-border bg-surface2 p-2 text-xs text-muted">{notice}</p>
          ) : null}
          {error && messages.length > 0 ? (
            <p className="mb-2 rounded-lg border border-[color-mix(in_oklab,var(--danger)_40%,transparent)] bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] p-2 text-xs text-danger">{error}</p>
          ) : null}
          <div className="flex items-end gap-2">
            <textarea
              className="cp-input min-h-[52px] flex-1 resize-y"
              placeholder={mode === "ask" ? "Ask about your code, docs or architecture…" : mode === "code" ? "Describe the change to make in the workspace…" : "Describe a multi-step task…"}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              disabled={sending}
            />
            {sending ? (
              <button type="button" onClick={stop} className="cp-btn cp-btn-danger">Stop</button>
            ) : (
              <button type="button" onClick={() => send()} disabled={!input.trim() || !modelRef} className="cp-btn cp-btn-primary">Send</button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            Enter sends · Shift+Enter adds a line · Files change only in your project workspace and publishing needs approval.
          </p>
        </div>
      </section>
    </div>
  );
}
