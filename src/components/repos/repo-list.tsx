"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { Alert, Badge, Card, Spinner, cx } from "../ui";

const SCOPES = "A GitHub App installation grants access only to the repositories you selected on GitHub.";

export function RepoList() {
  const router = useRouter();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api<any>("/api/github/status");
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function connect() {
    setBusy("connect");
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
      const data = await api<any>("/api/github/sync", { method: "POST", body: {} });
      setNotice(`${data.synced} repositories synced from ${data.installations} installation(s).`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect GitHub? Stored tokens are deleted and repository access is removed from this instance.")) return;
    setBusy("disconnect");
    try {
      await api("/api/github/disconnect", { method: "POST", body: {} });
      setNotice("GitHub disconnected.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function toggle(repo: any) {
    try {
      await api(`/api/github/repos/${repo.id}/select`, { method: "POST", body: { selected: !repo.selected } });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function importRepo(repo: any) {
    setBusy(`import-${repo.id}`);
    try {
      const data = await api<{ project: { id: string }; files: number }>("/api/projects/import", { method: "POST", body: { repositoryId: repo.id } });
      router.push(`/app/projects/${data.project.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Loading GitHub status…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">GitHub repositories</h1>
        <p className="mt-1 text-sm text-muted">{SCOPES}</p>
      </div>
      {error ? <p className="rounded-lg border border-border bg-surface p-3 text-sm text-danger">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-border bg-surface p-3 text-sm text-success">{notice}</p> : null}
      {!status?.configured ? (
        <Alert tone="warning" title="GitHub is not configured on this server">
          The operator must register a GitHub App (or OAuth app) and set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET. Callback URL: <code>{typeof window !== "undefined" ? `${window.location.origin}/api/github/callback` : "/api/github/callback"}</code>. See the documentation for required permissions.
        </Alert>
      ) : !status?.connection ? (
        <Card>
          <h2 className="font-semibold">Connect GitHub</h2>
          <p className="mt-1 text-sm text-muted">You will be sent to GitHub to authorize this application, then choose repositories if it is installed as an App.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={connect} disabled={busy === "connect"} className="cp-btn cp-btn-primary">{busy === "connect" ? <Spinner /> : null}Authorize on GitHub</button>
            {status?.installationSetupUrl ? <a href={status.installationSetupUrl} className="cp-btn cp-btn-ghost" target="_blank" rel="noreferrer">Install the GitHub App</a> : null}
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {status.connection.avatarUrl ? <img src={status.connection.avatarUrl} alt="GitHub avatar" width={36} height={36} className="h-9 w-9 rounded-full" /> : null}
                <div>
                  <p className="font-semibold">{status.connection.login}</p>
                  <p className="text-xs text-muted">{status.connection.authKind === "github_app" ? "GitHub App" : "OAuth App"} · {status.connection.installations?.length ?? 0} installation(s){status.connection.scopes ? ` · scopes: ${status.connection.scopes}` : ""}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={sync} disabled={busy === "sync"} className="cp-btn cp-btn-primary !py-1.5 !text-xs">{busy === "sync" ? <Spinner /> : null}Sync repositories</button>
                <button type="button" onClick={disconnect} disabled={busy === "disconnect"} className="cp-btn cp-btn-danger !py-1.5 !text-xs">Disconnect</button>
              </div>
            </div>
            {status.connection.installations?.length ? (
              <p className="mt-3 text-xs text-muted">Installations: {status.connection.installations.map((i: any) => i.account.login).join(", ")}</p>
            ) : null}
          </Card>
          <div className="grid gap-2">
            {status.repositories.map((repo: any) => (
              <div key={repo.id} className={cx("cp-card flex flex-wrap items-center justify-between gap-3 p-4", repo.selected && "border-[color-mix(in_oklab,var(--accent)_40%,transparent)]")}>
                <div className="min-w-0">
                  <p className="truncate font-medium">{repo.full_name} {repo.private ? <Badge tone="warning">private</Badge> : <Badge>public</Badge>}</p>
                  <p className="mt-1 text-xs text-muted">{repo.language ?? "unknown language"} · default branch {repo.default_branch} · synced {new Date(repo.synced_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => toggle(repo)} className="cp-btn cp-btn-ghost !py-1 !text-xs">{repo.selected ? "Unselect" : "Select"}</button>
                  <button type="button" onClick={() => importRepo(repo)} disabled={busy === `import-${repo.id}`} className="cp-btn cp-btn-subtle !py-1 !text-xs">{busy === `import-${repo.id}` ? <Spinner /> : null}Import to project</button>
                  {repo.html_url ? <a href={repo.html_url} target="_blank" rel="noreferrer" className="cp-btn cp-btn-ghost !py-1 !text-xs">Open on GitHub</a> : null}
                </div>
              </div>
            ))}
            {status.repositories.length === 0 ? <Card><p className="text-sm text-muted">No repositories returned. Install the GitHub App on the account or organization that owns them, then sync again.</p></Card> : null}
          </div>
        </>
      )}
    </div>
  );
}
