import Link from "next/link";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { listProjects } from "@/lib/projects";
import { listChats } from "@/lib/chats";
import { listProviders, listModels } from "@/lib/providers";
import { listRepositories } from "@/lib/github/connection";
import { listTasks } from "@/lib/tasks";
import { executionCapabilities } from "@/lib/execution/runner";
import { githubConfigured } from "@/lib/github/app";
import { researchProviders } from "@/lib/research";
import { Badge, Card, SectionTitle, StatusPill } from "@/components/ui";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const auth = await requireAuth();
  const userId = auth.user.id;
  const projects = listProjects(userId);
  const chats = listChats(userId).slice(0, 5);
  const providers = listProviders(userId);
  const models = listModels(userId);
  const repositories = listRepositories(userId);
  const tasks = listTasks(userId).slice(0, 4);
  const eligible = models.filter((m) => m.pricing_status === "verified_free" || m.pricing_status === "local");
  const execution = executionCapabilities();
  const research = researchProviders();
  const counts = {
    messages: one<{ c: number }>("SELECT COUNT(*) AS c FROM messages WHERE user_id = ?", userId)?.c ?? 0,
    changes: one<{ c: number }>("SELECT COUNT(*) AS c FROM changes WHERE user_id = ?", userId)?.c ?? 0,
    pending: all<any>("SELECT id FROM changes WHERE user_id = ? AND status = 'approved'", userId).length,
  };
  const steps = [
    { done: providers.length > 0, label: "Add a model provider", href: "/app/providers", detail: "OpenRouter, a local Ollama runtime, or an OpenAI-compatible endpoint." },
    { done: eligible.length > 0, label: "Select a verified-free or local model", href: "/app/models", detail: "The agent cannot run until an eligible model exists." },
    { done: Boolean(githubConfigured()), label: "Configure GitHub (optional)", href: "/app/integrations", detail: "Needed for repositories, imports and publishing." },
    { done: projects.length > 0, label: "Create or import a project", href: "/app/projects", detail: "Start from a template or import an authorized repository." },
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {auth.user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted">Free-only policy active. Only verified-free and local models can run.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/chat" className="cp-btn cp-btn-primary">Start a chat</Link>
          <Link href="/app/projects" className="cp-btn cp-btn-ghost">New project</Link>
        </div>
      </div>

      {remaining > 0 ? (
        <Card>
          <SectionTitle title="Setup checklist" description={`${remaining} step${remaining === 1 ? "" : "s"} remaining before the agent can do useful work.`} />
          <ul className="mt-4 space-y-2">
            {steps.map((step) => (
              <li key={step.label} className="flex items-start gap-3 rounded-lg border border-border bg-bgsoft p-3 text-sm">
                <span className={step.done ? "text-success" : "text-muted"}>{step.done ? "\u2713" : "\u25cb"}</span>
                <div className="flex-1">
                  <Link href={step.href} className="font-medium hover:text-accent">{step.label}</Link>
                  <p className="text-xs text-muted">{step.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Projects", value: projects.length, href: "/app/projects" },
          { label: "Conversations", value: chats.length, href: "/app/history" },
          { label: "Eligible models", value: `${eligible.length}/${models.length}`, href: "/app/models" },
          { label: "Repositories", value: repositories.length, href: "/app/repositories" },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href} className="cp-card p-4 transition-colors hover:border-borderstrong">
            <p className="text-xs uppercase tracking-wide text-muted">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Recent conversations" action={<Link href="/app/history" className="cp-btn cp-btn-ghost !py-1 !text-xs">All chats</Link>} />
          <div className="mt-4 space-y-2">
            {chats.length === 0 ? (
              <p className="text-sm text-muted">No conversations yet.</p>
            ) : (
              chats.map((chat) => (
                <Link key={chat.id} href={`/app/chat/${chat.id}`} className="block rounded-lg border border-border bg-bgsoft p-3 hover:border-borderstrong">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{chat.title}</p>
                    <Badge>{chat.mode}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">{new Date(chat.updated_at).toLocaleString()}</p>
                </Link>
              ))
            )}
          </div>
        </Card>
        <Card>
          <SectionTitle title="Environment status" description="What this instance can actually do right now." />
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3"><dt className="text-muted">Execution runner</dt><dd>{execution.enabled ? <StatusPill status="passed" /> : <Badge tone="warning">Disabled</Badge>}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-muted">Network isolation</dt><dd><Badge>{execution.networkIsolation === "unshare" ? "unshare namespace" : "unavailable"}</Badge></dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-muted">GitHub app</dt><dd>{githubConfigured() ? <Badge tone="success">Configured</Badge> : <Badge tone="warning">Not configured</Badge>}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-muted">Research providers</dt><dd><Badge>{research.filter((r) => r.configured).map((r) => r.id).join(", ") || "none"}</Badge></dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-muted">Messages stored</dt><dd>{counts.messages}</dd></div>
          </dl>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Recent agent tasks" action={<Link href="/app/tasks" className="cp-btn cp-btn-ghost !py-1 !text-xs">Task list</Link>} />
        {tasks.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No background tasks have run yet. Open a project to start one.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {tasks.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bgsoft p-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                <StatusPill status={task.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {counts.pending > 0 ? (
        <Alert tone="warning" title="Approved changes ready to publish">
          {counts.pending} change{counts.pending === 1 ? "" : "s"} approved but not published. Open the project review tab to publish to a new branch.
        </Alert>
      ) : null}
    </div>
  );
}
