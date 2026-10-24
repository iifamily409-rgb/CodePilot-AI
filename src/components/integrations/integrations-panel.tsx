"use client";

import { useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/client/api";
import { Alert, Badge, Card, Spinner } from "../ui";
import { useSession } from "../session-context";

export function IntegrationsPanel({ configured, mode, research, execution }: { configured: boolean; mode: string | null; research: any[]; execution: any }) {
  const { github, refresh } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy("connect");
    setError(null);
    try {
      const data = await api<{ authorizeUrl: string }>("/api/github/connect", { method: "POST", body: {} });
      window.location.href = data.authorizeUrl;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    try {
      await api("/api/github/sync", { method: "POST", body: {} });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect GitHub and delete stored tokens?")) return;
    setBusy("disconnect");
    try {
      await api("/api/github/disconnect", { method: "POST", body: {} });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="mt-1 text-sm text-muted">Connect only what you need. Each integration keeps its own permissions and limits.</p>
      </div>
      {error ? <p className="rounded-lg border border-border bg-surface p-3 text-sm text-danger">{error}</p> : null}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><h2 className="font-semibold">GitHub</h2><Badge tone={configured ? "success" : "warning"}>{configured ? mode === "github_app" ? "GitHub App mode" : "OAuth app mode" : "Not configured on server"}</Badge></div>
            <p className="mt-1 max-w-2xl text-sm text-muted">Authorization is separate from your CodePilot AI login. With a GitHub App, access is limited to the repositories you select during installation. Publishing always creates a new branch.</p>
            {github ? <p className="mt-2 text-sm">Connected as <strong>{github.login}</strong></p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {!github ? (
              <button type="button" onClick={connect} disabled={!configured || busy === "connect"} className="cp-btn cp-btn-primary">{busy === "connect" ? <Spinner /> : null}Connect GitHub</button>
            ) : (
              <>
                <button type="button" onClick={sync} disabled={busy === "sync"} className="cp-btn cp-btn-subtle">{busy === "sync" ? <Spinner /> : null}Sync repositories</button>
                <Link href="/app/repositories" className="cp-btn cp-btn-ghost">Repositories</Link>
                <button type="button" onClick={disconnect} disabled={busy === "disconnect"} className="cp-btn cp-btn-danger">Disconnect</button>
              </>
            )}
          </div>
        </div>
        {!configured ? (
          <div className="mt-3"><Alert tone="warning" title="Configuration required">Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and (for App mode) GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_SLUG. Callback URL must be <code>/api/github/callback</code> on this origin.</Alert></div>
        ) : null}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Model providers</h2>
          <p className="mt-1 text-sm text-muted">OpenRouter, OpenAI-compatible endpoints, Ollama and OpenCode are configured per user.</p>
          <Link href="/app/providers" className="cp-btn cp-btn-ghost mt-3 !py-1.5 !text-xs">Manage providers</Link>
        </Card>
        <Card>
          <h2 className="font-semibold">Web research</h2>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {research.map((provider) => (
              <li key={provider.id} className="flex items-center justify-between gap-2"><span>{provider.label}</span><Badge tone={provider.configured ? "success" : "warning"}>{provider.configured ? "ready" : "not configured"}</Badge></li>
            ))}
          </ul>
          <Link href="/app/research" className="cp-btn cp-btn-ghost mt-3 !py-1.5 !text-xs">Open research</Link>
        </Card>
        <Card>
          <h2 className="font-semibold">Execution</h2>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            <li className="flex justify-between"><span>Runner</span><Badge tone={execution.enabled ? "success" : "warning"}>{execution.enabled ? "enabled" : "disabled"}</Badge></li>
            <li className="flex justify-between"><span>Network isolation</span><Badge>{execution.networkIsolation}</Badge></li>
            <li className="flex justify-between"><span>Timeout</span><span>{execution.timeoutMs} ms</span></li>
          </ul>
          <p className="mt-2 text-[11px] text-muted">Not a hardened multi-tenant sandbox. See Security for deployment guidance.</p>
        </Card>
        <Card>
          <h2 className="font-semibold">Local runtimes</h2>
          <p className="mt-1 text-sm text-muted">Ollama and OpenCode run on hardware you control. Loopback base URLs are treated as local; other private ranges stay blocked.</p>
          <Link href="/docs#adding-a-provider-adapter" className="cp-btn cp-btn-ghost mt-3 !py-1.5 !text-xs">Adapter docs</Link>
        </Card>
      </div>
    </div>
  );
}
