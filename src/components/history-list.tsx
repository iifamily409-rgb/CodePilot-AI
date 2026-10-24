"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { Badge, EmptyState, Spinner, StatusPill } from "./ui";

type Chat = { id: string; title: string; mode: string; archived: number; updated_at: string; model_ref: string | null };

export function HistoryList() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load(showArchived = archived) {
    setLoading(true);
    try {
      const data = await api<{ chats: Chat[] }>(`/api/chats${showArchived ? "?archived=1" : ""}`);
      setChats(data.chats);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(archived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archived]);

  async function act(chat: Chat, action: "archive" | "restore" | "delete" | "rename") {
    if (action === "delete" && !window.confirm(`Delete "${chat.title}"?`)) return;
    if (action === "rename") {
      const title = window.prompt("Rename conversation", chat.title)?.trim();
      if (!title) return;
      setBusy(chat.id);
      await api(`/api/chats/${chat.id}`, { method: "PATCH", body: { title } });
      setBusy(null);
      void load();
      return;
    }
    setBusy(chat.id);
    try {
      if (action === "delete") await api(`/api/chats/${chat.id}`, { method: "DELETE" });
      else await api(`/api/chats/${chat.id}`, { method: "PATCH", body: { archived: action === "archive" } });
      void load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Chat history</h1>
          <p className="mt-1 text-sm text-muted">Conversations persist in this instance and can be archived or deleted.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setArchived(false)} className={archived ? "cp-btn cp-btn-ghost" : "cp-btn cp-btn-subtle"}>Active</button>
          <button type="button" onClick={() => setArchived(true)} className={archived ? "cp-btn cp-btn-subtle" : "cp-btn cp-btn-ghost"}>Archived</button>
          <Link href="/app/chat" className="cp-btn cp-btn-primary">New chat</Link>
        </div>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {loading ? <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Loading…</div> : null}
      {!loading && chats.length === 0 ? (
        <EmptyState title={archived ? "No archived conversations" : "No conversations yet"} description="Start a chat to create a persistent conversation with tool activity and citations." action={<Link href="/app/chat" className="cp-btn cp-btn-primary">Start a chat</Link>} />
      ) : null}
      <div className="grid gap-2">
        {chats.map((chat) => (
          <div key={chat.id} className="cp-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <Link href={`/app/chat/${chat.id}`} className="truncate font-medium hover:text-accent">{chat.title}</Link>
              <p className="mt-1 text-xs text-muted">{new Date(chat.updated_at).toLocaleString()} · {chat.model_ref ?? "no model"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{chat.mode}</Badge>
              {archived ? <StatusPill status="stopped" /> : null}
              <button type="button" disabled={busy === chat.id} onClick={() => act(chat, "rename")} className="cp-btn cp-btn-ghost !py-1 !text-xs">Rename</button>
              <button type="button" disabled={busy === chat.id} onClick={() => act(chat, archived ? "restore" : "archive")} className="cp-btn cp-btn-ghost !py-1 !text-xs">{archived ? "Restore" : "Archive"}</button>
              <button type="button" disabled={busy === chat.id} onClick={() => act(chat, "delete")} className="cp-btn cp-btn-danger !py-1 !text-xs">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
