import Link from "next/link";
import type { Metadata } from "next";
import { Alert, Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "X-Flex — a personal AI coding workspace",
};

const CAPABILITIES = [
  {
    title: "Chat that can actually work on code",
    body: "Ask, Code and Agent modes stream over SSE, call real tools, show every tool result, and persist the conversation.",
  },
  {
    title: "Your providers, your keys",
    body: "OpenRouter, OpenAI-compatible endpoints, Ollama, or a local OpenCode server. Multiple providers and models per account.",
  },
  {
    title: "Free-only model guard",
    body: "Every model is classified verified free, local, unverified or paid. Paid and unverified models are blocked in the backend.",
  },
  {
    title: "Only the repositories you pick",
    body: "GitHub App or OAuth authorization, installation-scoped repositories, branch-aware reads, and publishing to a new branch only.",
  },
  {
    title: "Real files, real checks",
    body: "Monaco editor, file tree, search, autosave, ZIP export, unified diffs, and an allowlisted local runner for tests and builds.",
  },
  {
    title: "Projects without GitHub",
    body: "Nine starter templates with working files and tests. Import a repository later if you want to publish.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="cp-grid-bg border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Personal-use build · free-only policy enforced server-side
            </p>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl">
              Your own AI coding workspace.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              X-Flex is a self-hosted coding assistant you run for yourself. Chat with an agent, connect the repositories
              you authorize, edit real files, run tests, and review the diff before anything leaves your machine.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/sign-up" className="cp-btn cp-btn-primary">Create your account</Link>
              <Link href="/getting-started" className="cp-btn cp-btn-ghost">Set it up locally</Link>
            </div>
            <p className="mt-4 text-xs text-muted">
              No subscription, ads, checkout, or mandatory hosted service. You bring a free model or a local runtime.
            </p>
          </div>

          <div className="cp-card overflow-hidden p-0">
            <div className="flex items-center gap-1.5 border-b border-border bg-surface2 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
              <span className="ml-2 text-xs text-muted">local run · agent mode</span>
            </div>
            <div className="space-y-2.5 p-4 font-mono text-[11px] leading-relaxed sm:text-xs">
              <p className="text-muted">you: find the bug and make the tests pass</p>
              <p><span className="text-accent">read_file</span> src/router.js</p>
              <p><span className="text-accent">run_command</span> npm test <span className="text-danger">exit 1</span></p>
              <p className="text-muted">route table is missing /api/health</p>
              <p><span className="text-accent">write_file</span> src/router.js</p>
              <p><span className="text-accent">run_command</span> npm test <span className="text-success">exit 0</span></p>
              <p className="text-muted">1 file changed · awaiting your approval</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-semibold md:text-3xl">What works today</h2>
        <p className="mt-3 max-w-2xl text-muted">
          Everything below maps to real code in this repository. Nothing is a placeholder button, and no result is reported
          as successful unless a command actually returned zero.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((item) => (
            <Card key={item.title}>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-bgsoft">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold">Free-only by construction</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Classification uses provider metadata, and the eligibility check runs in the backend for chat, retries,
              agent steps and background tasks. A direct API call naming a paid model receives HTTP 403.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li><span className="text-success">●</span> Verified free — catalog reports 0 input and 0 output price.</li>
              <li><span className="text-accent">●</span> Local — Ollama or a loopback compatible runtime.</li>
              <li><span className="text-warning">●</span> Unverified pricing — blocked, with an explanation.</li>
              <li><span className="text-danger">●</span> Paid — blocked on every path.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Local first, publishing later</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Development only needs Node.js and a writable data directory. Nothing has to be exposed to the internet,
              and no hosting or email service is required. Deployment advice lives in the docs, separate from the local
              setup, so you can decide later whether to publish an instance.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-[var(--code-bg)] p-4 text-xs leading-relaxed"><code>{`npm install\ncp .env.example .env\nnpm run db:migrate\nnpm run dev`}</code></pre>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-4 md:grid-cols-2">
          <Alert tone="warning" title="Honest limits">
            Execution is a bounded local runner on the host, not a hardened multi-tenant sandbox. Keep it disabled on any
            machine you share. Background tasks run in-process and do not survive a restart. Third-party providers can
            change quotas or withdraw free models at any time.
          </Alert>
          <Alert tone="info" title="What you need to configure">
            GitHub is optional, and so is web research. Chat needs at least one eligible model: an OpenRouter key with a
            zero-price model, or a local Ollama/OpenCode runtime. Everything else works without external accounts.
          </Alert>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/sign-up" className="cp-btn cp-btn-primary">Create an account</Link>
          <Link href="/docs" className="cp-btn cp-btn-ghost">Read the documentation</Link>
        </div>
      </section>
    </>
  );
}
