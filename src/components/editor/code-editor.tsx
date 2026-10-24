"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { Badge, Card, Spinner, cx } from "../ui";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false, loading: () => <div className="flex h-full items-center gap-2 p-4 text-sm text-muted"><Spinner /> Loading editor…</div> });

type TreeNode = { name: string; path: string; type: "file" | "directory"; children?: TreeNode[] };
type Tab = { path: string; content: string; saved: string };

function flatten(nodes: TreeNode[], depth = 0): Array<TreeNode & { depth: number }> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...(node.children ? flatten(node.children, depth + 1) : []),
  ]);
}

function languageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    json: "json", md: "markdown", css: "css", scss: "scss", html: "html", py: "python", yml: "yaml", yaml: "yaml",
    sh: "shell", sql: "sql", go: "go", rs: "rust", java: "java", rb: "ruby", php: "php", toml: "ini", txt: "plaintext",
  };
  return map[ext] ?? "plaintext";
}

export function CodeEditor({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [tree, setTree] = useState<Array<TreeNode & { depth: number }>>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = tabs.find((tab) => tab.path === activePath) ?? null;
  const dirty = useMemo(() => tabs.some((tab) => tab.content !== tab.saved), [tabs]);

  const loadTree = useCallback(async () => {
    try {
      const data = await api<{ tree: TreeNode }>(`/api/projects/${projectId}/files`);
      setTree(flatten(data.tree.children ?? []));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [projectId]);

  useEffect(() => {
    void loadTree();
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "vs-dark");
  }, [loadTree]);

  async function open(path: string) {
    if (tabs.some((tab) => tab.path === path)) {
      setActivePath(path);
      return;
    }
    try {
      const data = await api<{ content: string }>(`/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`);
      setTabs((prev) => [...prev, { path, content: data.content, saved: data.content }]);
      setActivePath(path);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function save(path: string, content: string) {
    setSaving(true);
    try {
      await api(`/api/projects/${projectId}/files`, { method: "POST", body: { action: "write", path, content } });
      setTabs((prev) => prev.map((tab) => (tab.path === path ? { ...tab, saved: content } : tab)));
      setStatus(`Saved ${path} at ${new Date().toLocaleTimeString()}`);
      setError(null);
    } catch (err) {
      setError(`Save failed: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  function update(content: string) {
    if (!active) return;
    const path = active.path;
    setTabs((prev) => prev.map((tab) => (tab.path === path ? { ...tab, content } : tab)));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void save(path, content);
    }, 1200);
  }

  async function createEntry(kind: "file" | "directory") {
    const path = window.prompt(`${kind === "file" ? "File" : "Folder"} path (relative)`, kind === "file" ? "src/new-file.js" : "src");
    if (!path) return;
    try {
      await api(`/api/projects/${projectId}/files`, { method: "POST", body: { action: "create", path, kind } });
      await loadTree();
      if (kind === "file") await open(path);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function rename(path: string) {
    const to = window.prompt("New path", path);
    if (!to || to === path) return;
    try {
      await api(`/api/projects/${projectId}/files`, { method: "POST", body: { action: "rename", from: path, to } });
      setTabs((prev) => prev.map((tab) => (tab.path === path ? { ...tab, path: to } : tab)));
      if (activePath === path) setActivePath(to);
      await loadTree();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(path: string) {
    if (!window.confirm(`Delete ${path}? This is irreversible in the workspace.`)) return;
    try {
      await api(`/api/projects/${projectId}/files`, { method: "POST", body: { action: "delete", path, confirm: true } });
      setTabs((prev) => prev.filter((tab) => tab.path !== path));
      if (activePath === path) setActivePath(null);
      await loadTree();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function search() {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    try {
      const data = await api<{ results: any[] }>(`/api/projects/${projectId}/files?q=${encodeURIComponent(query)}`);
      setResults(data.results);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={`/app/projects/${projectId}`} className="cp-btn cp-btn-ghost !py-1 !text-xs">← Project</Link>
          <h1 className="text-lg font-semibold">Code editor</h1>
          {dirty ? <Badge tone="warning">Unsaved</Badge> : <Badge tone="success">Saved</Badge>}
          {saving ? <Spinner /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className="cp-input !w-44 !py-1 !text-xs" placeholder="Search files…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
          <button type="button" onClick={search} className="cp-btn cp-btn-ghost !py-1 !text-xs">Search</button>
          <button type="button" onClick={() => createEntry("file")} className="cp-btn cp-btn-ghost !py-1 !text-xs">+ File</button>
          <button type="button" onClick={() => createEntry("directory")} className="cp-btn cp-btn-ghost !py-1 !text-xs">+ Folder</button>
          <button
            type="button"
            onClick={async () => {
              try {
                const data = await api<{ chat: { id: string } }>("/api/chats", {
                  method: "POST",
                  body: { title: `Edit ${active?.path ?? "project"}`, mode: "code", projectId },
                });
                router.push(`/app/chat/${data.chat.id}`);
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
            className="cp-btn cp-btn-primary !py-1 !text-xs"
            title="Ask the agent to edit this project"
          >
            Ask AI
          </button>
          <a href={`/api/projects/${projectId}/download`} className="cp-btn cp-btn-ghost !py-1 !text-xs">ZIP</a>
        </div>
      </div>
      {error ? <p className="rounded-lg border border-border bg-surface p-2 text-xs text-danger">{error}</p> : null}
      {status ? <p className="text-xs text-muted">{status}</p> : null}
      <div className="grid gap-3 lg:grid-cols-[240px_1fr]">
        <Card className="max-h-[74vh] overflow-y-auto p-2">
          {tree.length === 0 ? <p className="p-2 text-xs text-muted">No files yet.</p> : null}
          {tree.map((node) => (
            <div key={node.path} className="group flex items-center gap-1" style={{ paddingLeft: node.depth * 10 }}>
              <button
                type="button"
                onClick={() => node.type === "file" && open(node.path)}
                className={cx("min-w-0 flex-1 truncate rounded px-1.5 py-1 text-left text-xs", node.type === "directory" ? "text-muted" : "hover:bg-surface2", activePath === node.path && "bg-surface2 text-accent")}
              >
                {node.type === "directory" ? "\u25b8 " : "\u00b7 "}{node.name}
              </button>
              <span className="hidden shrink-0 gap-1 text-[10px] text-muted group-hover:flex">
                <button type="button" onClick={() => rename(node.path)} title="Rename" className="hover:text-fg">r</button>
                <button type="button" onClick={() => remove(node.path)} title="Delete" className="hover:text-danger">x</button>
              </span>
            </div>
          ))}
          {results ? (
            <div className="mt-2 border-t border-border pt-2">
              <p className="px-1 text-[11px] text-muted">{results.length} match(es)</p>
              {results.slice(0, 50).map((hit, index) => (
                <button key={`${hit.path}-${hit.line}-${index}`} type="button" onClick={() => open(hit.path)} className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] hover:bg-surface2">
                  {hit.path}:{hit.line} <span className="text-muted">{hit.text}</span>
                </button>
              ))}
              {results.length === 0 ? <p className="px-1 text-[11px] text-muted">No matches.</p> : null}
            </div>
          ) : null}
        </Card>
        <Card className="flex min-h-[60vh] flex-col p-0">
          <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
            {tabs.length === 0 ? <span className="px-2 text-xs text-muted">Open a file from the tree</span> : null}
            {tabs.map((tab) => (
              <div key={tab.path} className={cx("flex items-center gap-1 rounded-md px-2 py-1 text-xs", activePath === tab.path ? "bg-surface2 text-fg" : "text-muted hover:text-fg")}>
                <button type="button" onClick={() => setActivePath(tab.path)} className="max-w-[180px] truncate">{tab.path.split("/").pop()}{tab.content !== tab.saved ? " •" : ""}</button>
                <button type="button" onClick={() => { setTabs((prev) => prev.filter((t) => t.path !== tab.path)); if (activePath === tab.path) setActivePath(null); }} className="text-muted hover:text-danger">×</button>
              </div>
            ))}
            {active ? (
              <button type="button" onClick={() => save(active.path, active.content)} className="ml-auto cp-btn cp-btn-subtle !py-1 !text-xs">Save now</button>
            ) : null}
          </div>
          <div className="flex-1">
            {active ? (
              <Monaco
                height="68vh"
                path={active.path}
                language={languageFor(active.path)}
                theme={theme}
                value={active.content}
                onChange={(value) => update(value ?? "")}
                options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, wordWrap: "on", automaticLayout: true, tabSize: 2 }}
              />
            ) : (
              <div className="grid h-full place-items-center p-8 text-sm text-muted">Select a file to start editing. Changes autosave after a short delay.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
