"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { Badge, Card, Spinner, StatusPill, cx } from "../ui";

type TreeNode = { name: string; path: string; type: "file" | "directory"; size?: number; children?: TreeNode[] };
type Diff = { path: string; status: string; additions: number; deletions: number; patch: string; publishable: boolean };
type Change = { id: string; summary: string; status: string; created_at: string; branch: string | null; pr_url: string | null; files_json: string | null; test_output: string | null };
type Project = { id: string; name: string; template: string; description: string | null; repository_id: string | null; default_branch: string | null; execution_method: string };
type Repo = { id: string; full_name: string; default_branch: string };

function flatten(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const node of nodes) {
    out.push(node);
    if (node.children) flatten(node.children, out);
  }
  return out;
}

export function ProjectDetail({ projectId, initialTab = "overview" }: { projectId: string; initialTab?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const [project, setProject] = useState<Project | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [diffs, setDiffs] = useState<Diff[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [linkRepo, setLinkRepo] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [command, setCommand] = useState("npm test");
  const [runResult, setRunResult] = useState<any>(null);
  const [execution, setExecution] = useState<any>(null);
  const [preview, setPreview] = useState<{ available: boolean; html?: string; reason?: string } | null>(null);
  const [publish, setPublish] = useState<{ branch: string; message: string; createPr: boolean }>({ branch: "codepilot/update", message: "CodePilot AI changes", createPr: true });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [projectData, fileData, changeData, repoData, runData] = await Promise.all([
        api<{ project: Project }>(`/api/projects/${projectId}`),
        api<{ tree: TreeNode }>(`/api/projects/${projectId}/files`),
        api<{ diffs: Diff[]; changes: Change[]; repository: { id: string; fullName: string } | null; execution: any }>(`/api/projects/${projectId}/changes`),
        api<{ repositories: Repo[] }>("/api/github/repos").catch(() => ({ repositories: [] })),
        api<any>(`/api/projects/${projectId}/run`).catch(() => null),
      ]);
      setProject(projectData.project);
      setName(projectData.project.name);
      setTree(flatten(fileData.tree.children ?? []));
      setDiffs(changeData.diffs);
      setChanges(changeData.changes);
      setExecution(changeData.execution ?? runData);
      setRepos(repoData.repositories);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openFile(path: string) {
    setSelected(path);
    setContent(null);
    try {
      const data = await api<{ content: string }>(`/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`);
      setContent(data.content);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function createChange() {
    setBusy("change");
    try {
      const data = await api<{ changeId: string }>(`/api/projects/${projectId}/changes`, { method: "POST", body: { summary: summary || "Workspace changes", testOutput: testOutput || null } });
      setNotice("Change record created. Review the diff and approve it before publishing.");
      setSummary("");
      await load();
      setTab("review");
      void data;
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function decide(changeId: string, decision: "approved" | "rejected") {
    if (!window.confirm(`${decision === "approved" ? "Approve" : "Reject"} this change?`)) return;
    setBusy(changeId);
    try {
      await api(`/api/changes/${changeId}/decide`, { method: "POST", body: { decision } });
      setNotice(decision === "approved" ? "Change approved. You can publish it to a new branch." : "Change rejected. The workspace is unchanged.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function publishChange(changeId: string) {
    if (!window.confirm(`Publish to a NEW branch "${publish.branch}"? This creates a commit on GitHub.`)) return;
    setBusy(`publish-${changeId}`);
    try {
      const result = await api<{ branch: string; commitUrl: string; prUrl: string | null }>(`/api/changes/${changeId}/publish`, {
        method: "POST",
        body: { branch: publish.branch, commitMessage: publish.message, createPr: publish.createPr, prTitle: publish.message },
      });
      setNotice(`Published to ${result.branch}. ${result.prUrl ? `Pull request: ${result.prUrl}` : result.commitUrl}`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function run() {
    setBusy("run");
    setRunResult(null);
    try {
      const result = await api<any>(`/api/projects/${projectId}/run`, { method: "POST", body: { command } });
      setRunResult(result);
      setTestOutput(`${result.command}\nexit ${result.exitCode} (${result.status})\n\n${result.output}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function loadPreview() {
    setBusy("preview");
    try {
      const data = await api<any>(`/api/projects/${projectId}/preview`);
      setPreview(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings() {
    setBusy("settings");
    try {
      await api(`/api/projects/${projectId}`, { method: "PATCH", body: { name } });
      setNotice("Project renamed.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function link() {
    if (!linkRepo) return;
    setBusy("link");
    try {
      await api(`/api/projects/${projectId}/link`, { method: "POST", body: { repositoryId: linkRepo } });
      setNotice("Repository linked. Publishing will target a new branch.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this project and all of its files? This cannot be undone.")) return;
    setBusy("delete");
    try {
      await api(`/api/projects/${projectId}`, { method: "DELETE" });
      router.push("/app/projects");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (!project) {
    return <div className="flex items-center gap-2 text-sm text-muted">{error ? <span className="text-danger">{error}</span> : <><Spinner /> Loading project…</>}</div>;
  }

  const tabs = ["overview", "files", "review", "run", "settings"];
  const linkedRepo = repos.find((repo) => repo.id === project.repository_id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <Badge>{project.template}</Badge>
            {linkedRepo ? <Badge tone="accent">{linkedRepo.full_name}</Badge> : <Badge tone="warning">Not linked</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">{project.description || "No description."}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/app/editor/${projectId}`} className="cp-btn cp-btn-primary">Open editor</Link>
          <Link href={`/app/chat`} className="cp-btn cp-btn-ghost">Chat</Link>
          <a href={`/api/projects/${projectId}/download`} className="cp-btn cp-btn-ghost">Download ZIP</a>
        </div>
      </div>
      {error ? <p className="rounded-lg border border-border bg-surface p-3 text-sm text-danger">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-border bg-surface p-3 text-sm text-success">{notice}</p> : null}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={cx("rounded-t-lg px-3 py-2 text-sm capitalize", tab === item ? "border-b-2 border-accent text-fg" : "text-muted hover:text-fg")}>{item}</button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="font-semibold">Workspace</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-muted">Files</dt><dd>{tree.filter((n) => n.type === "file").length}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Pending diffs</dt><dd>{diffs.length} file(s)</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Execution</dt><dd>{execution?.enabled ? <Badge tone="success">Enabled</Badge> : <Badge tone="warning">Disabled</Badge>}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Network isolation</dt><dd><Badge>{execution?.networkIsolation ?? "unknown"}</Badge></dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">Commands: {(execution?.commands ?? []).join(", ") || "run `npm test` in a Node or Python template"}</p>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Static preview</h2>
              <button type="button" onClick={loadPreview} disabled={busy === "preview"} className="cp-btn cp-btn-ghost !py-1 !text-xs">{busy === "preview" ? <Spinner /> : null}Render</button>
            </div>
            {preview ? (
              preview.available ? (
                <iframe title="Project preview" sandbox="allow-scripts" srcDoc={preview.html} className="mt-3 h-[360px] w-full rounded-lg border border-border bg-white" />
              ) : <p className="mt-2 text-sm text-muted">{preview.reason}</p>
            ) : <p className="mt-2 text-sm text-muted">Static templates can be rendered in a sandboxed iframe. This is not a running server.</p>}
          </Card>
        </div>
      ) : null}

      {tab === "files" ? (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="max-h-[70vh] overflow-y-auto p-3">
            <div className="space-y-0.5">
              {tree.map((node) => (
                <button key={node.path} type="button" onClick={() => node.type === "file" && openFile(node.path)} className={cx("block w-full truncate rounded px-2 py-1 text-left text-xs", node.type === "directory" ? "text-muted" : "hover:bg-surface2", selected === node.path && "bg-surface2 text-accent")}>
                  {node.type === "directory" ? "\u25b8 " : "\u00b7 "}{node.path}
                </button>
              ))}
            </div>
          </Card>
          <Card className="min-h-[300px]">
            {selected ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-mono text-xs">{selected}</h3>
                  <Link href={`/app/editor/${projectId}`} className="cp-btn cp-btn-ghost !py-1 !text-xs">Edit</Link>
                </div>
                <pre className="mt-3 max-h-[60vh] overflow-auto rounded-lg bg-[var(--code-bg)] p-3 text-xs">{content ?? "Loading…"}</pre>
              </>
            ) : <p className="text-sm text-muted">Select a file to preview its contents.</p>}
          </Card>
        </div>
      ) : null}

      {tab === "review" ? (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Unreviewed workspace changes ({diffs.length})</h2>
              <button type="button" onClick={createChange} disabled={!diffs.length || busy === "change"} className="cp-btn cp-btn-primary !py-1.5 !text-xs">{busy === "change" ? <Spinner /> : null}Create change record</button>
            </div>
            <div className="mt-3 space-y-2">
              <input className="cp-input" placeholder="Summary of the change (required for review)" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={400} />
            </div>
            {diffs.length === 0 ? <p className="mt-3 text-sm text-muted">No differences from the last approved baseline. Ask the agent to make a change or edit a file.</p> : null}
            <div className="mt-3 space-y-3">
              {diffs.map((diff) => (
                <details key={diff.path} className="rounded-lg border border-border bg-bgsoft" open={diff.status !== "deleted"}>
                  <summary className="cursor-pointer px-3 py-2 text-xs">
                    <span className="font-mono">{diff.path}</span> <span className="text-success">+{diff.additions}</span> <span className="text-danger">-{diff.deletions}</span>
                    {!diff.publishable ? <span className="ml-2 text-warning">excluded from publishing (secret file)</span> : null}
                  </summary>
                  <pre className="max-h-72 overflow-auto border-t border-border p-3 font-mono text-[11px] leading-relaxed">
                    {diff.patch.split("\n").map((line, index) => (
                      <div key={index} className={cx(line.startsWith("+") && !line.startsWith("+++") && "cp-diff-add", line.startsWith("-") && !line.startsWith("---") && "cp-diff-del", "whitespace-pre-wrap break-all px-1")}>{line || " "}</div>
                    ))}
                  </pre>
                </details>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold">Change history</h2>
            {changes.length === 0 ? <p className="mt-2 text-sm text-muted">No change records yet.</p> : (
              <div className="mt-3 space-y-3">
                {changes.map((change) => (
                  <div key={change.id} className="rounded-lg border border-border bg-bgsoft p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{change.summary}</span>
                      <StatusPill status={change.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted">{new Date(change.created_at).toLocaleString()}{change.branch ? ` · branch ${change.branch}` : ""}</p>
                    {change.test_output ? <pre className="mt-2 max-h-32 overflow-auto rounded bg-surface p-2 text-[11px] text-muted">{change.test_output.slice(0, 2000)}</pre> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {change.status === "pending" ? (
                        <>
                          <button type="button" onClick={() => decide(change.id, "approved")} disabled={busy === change.id} className="cp-btn cp-btn-primary !py-1 !text-xs">Approve</button>
                          <button type="button" onClick={() => decide(change.id, "rejected")} disabled={busy === change.id} className="cp-btn cp-btn-danger !py-1 !text-xs">Reject</button>
                        </>
                      ) : null}
                      {change.status === "approved" ? (
                        <div className="flex w-full flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-2">
                          <div className="min-w-[180px] flex-1"><label className="cp-label">New branch</label><input className="cp-input !py-1 !text-xs" value={publish.branch} onChange={(e) => setPublish({ ...publish, branch: e.target.value })} /></div>
                          <div className="min-w-[220px] flex-[2]"><label className="cp-label">Commit message</label><input className="cp-input !py-1 !text-xs" value={publish.message} onChange={(e) => setPublish({ ...publish, message: e.target.value })} /></div>
                          <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={publish.createPr} onChange={(e) => setPublish({ ...publish, createPr: e.target.checked })} />Open pull request</label>
                          <button type="button" onClick={() => publishChange(change.id)} disabled={busy === `publish-${change.id}`} className="cp-btn cp-btn-primary !py-1 !text-xs">{busy === `publish-${change.id}` ? <Spinner /> : null}Publish</button>
                        </div>
                      ) : null}
                      {change.pr_url ? <a href={change.pr_url} target="_blank" rel="noreferrer" className="cp-link text-xs">Pull request</a> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "run" ? (
        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold">Run a check</h2>
            <p className="mt-1 text-sm text-muted">
              {execution?.enabled ? "Commands run in this project workspace with a timeout, output cap and scrubbed environment." : "Execution is disabled on this server (EXECUTION_ENABLED is not 1). Enable it only on a host you control."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <select className="cp-input max-w-xs" value={command} onChange={(e) => setCommand(e.target.value)}>
                {["npm test", "npm run build", "npm run lint", "npm run typecheck", "npx tsc --noEmit", "node --test", "python3 -m unittest", "pytest"].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <button type="button" onClick={run} disabled={busy === "run" || !execution?.enabled} className="cp-btn cp-btn-primary">{busy === "run" ? <Spinner /> : null}Run</button>
            </div>
            {runResult ? (
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2 text-xs"><StatusPill status={runResult.status} /><span className="text-muted">exit {runResult.exitCode ?? "none"} · {runResult.durationMs} ms</span>{runResult.networkIsolated ? <Badge tone="success">network isolated</Badge> : <Badge tone="warning">no network isolation</Badge>}</div>
                <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-border bg-[var(--code-bg)] p-3 text-xs">{runResult.output || "(no output)"}</pre>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="font-semibold">Rename project</h2>
            <div className="mt-3 flex gap-2"><input className="cp-input" value={name} onChange={(e) => setName(e.target.value)} /><button type="button" onClick={saveSettings} disabled={busy === "settings"} className="cp-btn cp-btn-primary">Save</button></div>
          </Card>
          <Card>
            <h2 className="font-semibold">GitHub repository</h2>
            <p className="mt-1 text-sm text-muted">Publishing commits to a new branch in the linked repository.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <select className="cp-input max-w-xs" value={linkRepo} onChange={(e) => setLinkRepo(e.target.value)}>
                <option value="">Select repository</option>
                {repos.map((repo) => <option key={repo.id} value={repo.id}>{repo.full_name}</option>)}
              </select>
              <button type="button" onClick={link} disabled={!linkRepo || busy === "link"} className="cp-btn cp-btn-primary">Link</button>
            </div>
            {!repos.length ? <p className="mt-2 text-xs text-warning">No repositories available. Connect GitHub and sync first.</p> : null}
          </Card>
          <Card>
            <h2 className="font-semibold text-danger">Danger zone</h2>
            <p className="mt-1 text-sm text-muted">Deleting removes the workspace, baselines and project records.</p>
            <button type="button" onClick={remove} disabled={busy === "delete"} className="cp-btn cp-btn-danger mt-3">Delete project</button>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
