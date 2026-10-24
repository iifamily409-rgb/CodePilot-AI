"use client";

import { useState } from "react";
import Link from "next/link";
import { Markdown } from "../markdown";
import { Badge, StatusPill, cx } from "../ui";

export type ChatEvent = {
  type: string;
  message?: string;
  name?: string;
  ok?: boolean;
  summary?: string;
  steps?: string[];
  from?: string;
  to?: string;
  model?: string;
};

export type Citation = { title: string; url: string; snippet?: string; publishedAt?: string | null };

export type ChatMessageRow = {
  id: string;
  role: string;
  content: string;
  status?: string;
  error?: string | null;
  model_ref?: string | null;
  citations?: Citation[];
  events?: ChatEvent[];
  created_at?: string;
};

export function ToolEvents({ events }: { events: ChatEvent[] }) {
  const [open, setOpen] = useState(false);
  const tools = events.filter((e) => e.type === "tool_result");
  if (!tools.length && !events.some((e) => e.type === "plan")) return null;
  return (
    <div className="mt-2 rounded-lg border border-border bg-bgsoft">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs text-muted hover:text-fg">
        <span>{tools.length} tool result{tools.length === 1 ? "" : "s"} · {tools.filter((t) => t.ok).length} succeeded</span>
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="space-y-1.5 border-t border-border p-3">
          {events.map((event, index) => {
            if (event.type === "plan" && event.steps) {
              return (
                <div key={index} className="rounded-md border border-border bg-surface p-2 text-xs">
                  <p className="font-semibold text-fg">Plan</p>
                  <ol className="mt-1 list-decimal pl-4 text-muted">
                    {event.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </div>
              );
            }
            if (event.type !== "tool_result") return null;
            return (
              <div key={index} className="text-xs">
                <div className="flex items-center gap-2">
                  <Badge tone={event.ok ? "success" : "danger"}>{event.ok ? "ok" : "failed"}</Badge>
                  <span className="font-mono text-[11px]">{event.name}</span>
                </div>
                {event.summary ? <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-surface p-2 font-mono text-[11px] text-muted">{event.summary}</pre> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function Citations({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <div className="mt-3 rounded-lg border border-border bg-bgsoft p-3">
      <p className="text-xs font-semibold text-muted">Sources</p>
      <ol className="mt-2 space-y-1.5">
        {citations.map((citation, index) => (
          <li key={`${citation.url}-${index}`} className="text-xs">
            <a href={citation.url} target="_blank" rel="noopener noreferrer nofollow" className="cp-link break-all">
              [{index + 1}] {citation.title || citation.url}
            </a>
            {citation.snippet ? <p className="mt-0.5 line-clamp-2 text-muted">{citation.snippet}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function MessageBubble({
  message,
  projectId,
  onRetry,
  retryDisabled,
}: {
  message: ChatMessageRow;
  projectId?: string | null;
  onRetry?: () => void;
  retryDisabled?: boolean;
}) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-border bg-surface2 px-4 py-3 text-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className={cx("cp-fade-in rounded-2xl border border-border bg-surface px-4 py-3")}>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="font-semibold text-fg">CodePilot AI</span>
        {message.status ? <StatusPill status={message.status} /> : null}
        {message.model_ref ? <Badge>{message.model_ref.split("::").slice(1).join("::")}</Badge> : null}
        {projectId ? <Link href={`/app/projects/${projectId}?tab=review`} className="cp-link">Review changes</Link> : null}
      </div>
      {message.content ? <Markdown>{message.content}</Markdown> : <p className="text-sm text-muted">(no text output)</p>}
      {message.error ? (
        <div className="mt-2 rounded-lg border border-[color-mix(in_oklab,var(--danger)_45%,transparent)] bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] p-2 text-xs text-danger">
          {message.error}
        </div>
      ) : null}
      {message.events?.length ? <ToolEvents events={message.events} /> : null}
      {message.citations?.length ? <Citations citations={message.citations} /> : null}
      {onRetry && (message.status === "error" || message.status === "stopped") ? (
        <button type="button" onClick={onRetry} disabled={retryDisabled} className="cp-btn cp-btn-ghost mt-2 !py-1 !text-xs">
          Retry
        </button>
      ) : null}
    </div>
  );
}
