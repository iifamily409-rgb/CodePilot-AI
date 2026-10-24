"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { Badge, Card, Spinner, StatusPill } from "../ui";

type Task = { id: string; title: string; goal: string; status: string; mode: string; project_id: string | null; result: string | null; error: string | null; logs_json: string; plan_json: string | null; created_at: string };

export function TaskPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", goal: "", projectId: "", modelRef: "", mode: "agent" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ tasks: Task[] }>("/api/tasks");
      setTasks(data.tasks);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
    api<{ projects: any[] }>("/api/projects").then((d) => setProjects(d.projects)).catch(() => {});
    api<{ models: any[] }>("/api/models").then((d) => {
      const eligible = d.models.filter((m) => m.eligibility?.eligible);
      setModels(eligible);
      setForm((prev) => ({ ...prev, modelRef: prev.modelRef || eligible[0]?.ref || "" }));
    }).catch(() => {});
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (tasks.some((task) => ["queued", "running"].includes(task.status))) void load();
    }, 3000);
    return () => clearInterval(interval);
  }, [tasks, load]);

  async function create() {
    setBusy(true);
    try {
      await api("/api/tasks", { method: "POST", body: { ...form, projectId: form.projectId || null } });
      setForm({ ...form, title: "", goal: "" });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(task: Task) {
    try {
      await api(`/api/tasks/${task.id}`, { method: "POST", body: {} });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Agent tasks</h1>
        <p className="mt-1 text-sm text-muted">Background tasks run in this web process (single-node, no external queue). Progress is stored so you can review results after a reload.</p>
      </div>
      {error ? <p className="rounded-lg border border-border bg-surface p-3 text-sm text-danger">{error}</p> : null}
      <Card>
        <h2 className="font-semibold">New task</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div><label className="cp-label">Title</label><input className="cp-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={140} /></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="cp-label">Project</label><select className="cp-input" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">No project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="w-28"><label className="cp-label">Mode</label><select className="cp-input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}><option value="agent">agent</option><option value="code">code</option></select></div>
          </div>
          <div className="md:col-span-2"><label className="cp-label">Eligible model</label><select className="cp-input" value={form.modelRef} onChange={(e) => setForm({ ...form, modelRef: e.target.value })}><option value="">Select a verified-free or local model</option>{models.map((m) => <option key={m.ref} value={m.ref}>{m.provider?.name} · {m.displayName}</option>)}</select></div>
          <div className="md:col-span-2"><label className="cp-label">Goal</label><textarea className="cp-input" rows={3} value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="Add tests for the router, run npm test, fix any failures, and report the result." /></div>
        </div>
        <button type="button" onClick={create} disabled={busy || !form.title || form.goal.length < 5 || !form.modelRef} className="cp-btn cp-btn-primary mt-3">{busy ? <Spinner /> : null}Start task</button>
        {models.length === 0 ? <p className="mt-2 text-xs text-warning">No eligible models. Configure a provider first.</p> : null}
      </Card>
      <div className="space-y-3">
        {tasks.map((task) => {
          const logs = JSON.parse(task.logs_json || "[]");
          const plan = task.plan_json ? JSON.parse(task.plan_json) : null;
          return (
            <Card key={task.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{task.title}</h3><StatusPill status={task.status} /><Badge>{task.mode}</Badge></div>
                  <p className="mt-1 text-sm text-muted">{task.goal}</p>
                  <p className="mt-1 text-[11px] text-muted">{new Date(task.created_at).toLocaleString()}</p>
                </div>
                {["queued", "running", "awaiting_approval"].includes(task.status) ? (
                  <button type="button" onClick={() => cancel(task)} className="cp-btn cp-btn-danger !py-1 !text-xs">Cancel</button>
                ) : null}
              </div>
              {plan ? <ol className="mt-3 list-decimal pl-5 text-xs text-muted">{plan.map((step: string) => <li key={step}>{step}</li>)}</ol> : null}
              {logs.length ? (
                <details className="mt-3"><summary className="cursor-pointer text-xs text-muted">{logs.length} log events</summary>
                  <ul className="mt-2 max-h-56 space-y-1 overflow-auto text-[11px] text-muted">
                    {logs.map((log: any, index: number) => <li key={index} className="font-mono">{log.at?.slice(11, 19)} {log.kind}{log.tool ? ` ${log.tool}` : ""}{log.summary ? `: ${log.summary}` : ""}{log.message ? `: ${log.message}` : ""}</li>)}
                  </ul>
                </details>
              ) : null}
              {task.result ? <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--code-bg)] p-3 text-xs">{task.result}</pre> : null}
              {task.error ? <p className="mt-2 text-xs text-danger">{task.error}</p> : null}
              {task.project_id ? <a href={`/app/projects/${task.project_id}?tab=review`} className="cp-btn cp-btn-ghost mt-2 !py-1 !text-xs">Review project changes</a> : null}
            </Card>
          );
        })}
        {tasks.length === 0 ? <Card><p className="text-sm text-muted">No tasks yet.</p></Card> : null}
      </div>
    </div>
  );
}
