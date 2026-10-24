"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { Badge, Card, EmptyState, Spinner } from "../ui";

type Project = { id: string; name: string; template: string; description: string | null; repositoryName: string | null; updated_at: string };
type Template = { id: string; name: string; description: string; preview: boolean; language: string };

export function ProjectList({ githubConfigured }: { githubConfigured: boolean }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [repos, setRepos] = useState<Array<{ id: string; full_name: string; private: number; default_branch: string }>>([]);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("website");
  const [description, setDescription] = useState("");
  const [repoId, setRepoId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ projects: Project[]; templates: Template[] }>("/api/projects");
      setProjects(data.projects);
      setTemplates(data.templates);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    api<{ repositories: any[] }>("/api/github/repos").then((data) => setRepos(data.repositories)).catch(() => setRepos([]));
  }, []);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const data = await api<{ project: Project }>("/api/projects", { method: "POST", body: { name, template, description } });
      router.push(`/app/projects/${data.project.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function importRepo() {
    if (!repoId) return;
    setBusy(true);
    try {
      const data = await api<{ project: Project; files: number; truncated: boolean }>("/api/projects/import", { method: "POST", body: { repositoryId: repoId } });
      router.push(`/app/projects/${data.project.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(project: Project) {
    if (!window.confirm(`Delete "${project.name}" and all of its files? This cannot be undone.`)) return;
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      void load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="mt-1 text-sm text-muted">Each project is a real on-disk workspace. No GitHub connection is required.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setShowCreate((v) => !v); setShowImport(false); }} className="cp-btn cp-btn-primary">New project</button>
          <button type="button" onClick={() => { setShowImport((v) => !v); setShowCreate(false); }} className="cp-btn cp-btn-ghost" disabled={!repos.length}>Import repository</button>
        </div>
      </div>
      {error ? <p className="rounded-lg border border-border bg-surface p-3 text-sm text-danger">{error}</p> : null}
      {showCreate ? (
        <Card>
          <h2 className="font-semibold">Create a project</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className="cp-label" htmlFor="project-name">Name</label>
              <input id="project-name" className="cp-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My website" maxLength={80} />
            </div>
            <div>
              <label className="cp-label" htmlFor="project-template">Template</label>
              <select id="project-template" className="cp-input" value={template} onChange={(e) => setTemplate(e.target.value)}>
                {templates.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.description}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="cp-label" htmlFor="project-description">Idea (optional)</label>
              <textarea id="project-description" className="cp-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A dashboard for tracking reading habits…" maxLength={1000} />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={create} disabled={busy || !name.trim()} className="cp-btn cp-btn-primary">{busy ? <Spinner /> : null}Create</button>
            <button type="button" onClick={() => setShowCreate(false)} className="cp-btn cp-btn-ghost">Cancel</button>
          </div>
        </Card>
      ) : null}
      {showImport ? (
        <Card>
          <h2 className="font-semibold">Import a repository</h2>
          <p className="mt-1 text-sm text-muted">Copies accessible text files (up to 120 files, 200 KB each) into a new project workspace.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select className="cp-input max-w-md" value={repoId} onChange={(e) => setRepoId(e.target.value)}>
              <option value="">Select a repository</option>
              {repos.map((repo) => <option key={repo.id} value={repo.id}>{repo.full_name}{repo.private ? " (private)" : ""}</option>)}
            </select>
            <button type="button" onClick={importRepo} disabled={busy || !repoId} className="cp-btn cp-btn-primary">{busy ? <Spinner /> : null}Import</button>
          </div>
          {!githubConfigured ? <p className="mt-2 text-xs text-warning">GitHub is not configured on this server, so no repositories can be imported yet.</p> : null}
        </Card>
      ) : null}
      {loading ? <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Loading projects…</div> : null}
      {!loading && projects.length === 0 ? (
        <EmptyState title="No projects yet" description="Create one from a template to get real starter files, or import a repository you authorized." action={<button type="button" onClick={() => setShowCreate(true)} className="cp-btn cp-btn-primary">Create a project</button>} />
      ) : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id} className="flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2">
                <Link href={`/app/projects/${project.id}`} className="font-semibold hover:text-accent">{project.name}</Link>
                <Badge>{project.template}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted">{project.description || "No description."}</p>
              <p className="mt-2 text-xs text-muted">{project.repositoryName ? `GitHub: ${project.repositoryName}` : "Not linked to GitHub"}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/app/projects/${project.id}`} className="cp-btn cp-btn-subtle !py-1 !text-xs">Open</Link>
              <Link href={`/app/editor/${project.id}`} className="cp-btn cp-btn-ghost !py-1 !text-xs">Editor</Link>
              <a href={`/api/projects/${project.id}/download`} className="cp-btn cp-btn-ghost !py-1 !text-xs">ZIP</a>
              <button type="button" onClick={() => remove(project)} className="cp-btn cp-btn-danger !py-1 !text-xs">Delete</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
