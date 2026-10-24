import Link from "next/link";
import type { Metadata } from "next";
import { CTA, FeatureGrid, Section, Steps, Table } from "@/components/marketing";
import { Alert } from "@/components/ui";

export const metadata: Metadata = {
  title: "CodePilot AI — free-only, GitHub-connected AI coding platform",
};

export default function HomePage() {
  return (
    <>
      <section className="cp-grid-bg border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Free-only policy enforced in the backend
            </p>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl">
              Imagine. Code. <span className="bg-linear-to-r from-accent to-violet bg-clip-text text-transparent">Verify.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              CodePilot AI is a working, self-hostable coding workspace: chat with an agent, read the repositories you
              authorize, edit real files, run real test commands, inspect the diff, and publish only after you approve it.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/sign-up" className="cp-btn cp-btn-primary">Create a free account</Link>
              <Link href="/getting-started" className="cp-btn cp-btn-ghost">Self-host in minutes</Link>
            </div>
            <p className="mt-4 text-xs text-muted">
              No subscription, no ads, no checkout. You supply the model provider (a verified-free API or a local runtime).
            </p>
          </div>
          <div className="cp-card overflow-hidden p-0">
            <div className="flex items-center gap-1.5 border-b border-border bg-surface2 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
              <span className="ml-2 text-xs text-muted">agent task · verify</span>
            </div>
            <div className="space-y-3 p-4 font-mono text-xs leading-relaxed">
              <p className="text-muted">$ plan: fix failing test in src/router.js</p>
              <p><span className="text-accent">read_file</span> src/router.js <span className="text-success">ok</span></p>
              <p><span className="text-accent">run_command</span> npm test <span className="text-danger">exit 1</span></p>
              <p className="text-muted">Expected 200, received 404 — route table missing /api/health.</p>
              <p><span className="text-accent">write_file</span> src/router.js <span className="text-success">ok</span></p>
              <p><span className="text-accent">run_command</span> npm test <span className="text-success">exit 0</span></p>
              <p className="text-muted">3 files changed · awaiting your approval before publishing</p>
            </div>
          </div>
        </div>
      </section>

      <Section
        title="A complete loop, not a landing page"
        description="Each part of CodePilot AI maps to a real capability in this repository. Nothing here is a mock-up, and the platform never claims work succeeded unless a command actually returned zero."
      >
        <FeatureGrid
          items={[
            { title: "Persistent AI chat", body: "Streaming responses, markdown with highlighted code, conversation history you can rename, archive and delete. Ask, Code and Agent modes with visible tool activity." },
            { title: "Authorized GitHub access", body: "Connect through a GitHub App or OAuth app, pick repositories, browse branches and import a repo into an isolated workspace. Write access is optional and checked again at publish time." },
            { title: "Free-model enforcement", body: "A server-side eligibility engine classifies every model as verified free, local, unverified or paid. Unverified and paid models are blocked on every path, including retries and background tasks." },
            { title: "Real workspace editing", body: "Monaco editor, file tree, multi-file search, autosave, rename and delete, plus ZIP export. Files live on disk in your own deployment." },
            { title: "Bounded execution", body: "Run an allowlist of test, lint, typecheck and build commands with timeouts, output caps, a scrubbed environment, and network-namespace isolation where the host supports it." },
            { title: "Review before publish", body: "Every change is a real unified diff with test output. Publishing creates a new branch and an optional pull request. Direct commits to the default branch are refused." },
          ]}
        />
      </Section>

      <Section title="Three modes, one conversation" description="Switch modes without losing context. The same chat can explain a repository, then implement a fix, then verify it." className="border-y border-border bg-bgsoft">
        <Table
          head={["Mode", "What it can do", "What it cannot do"]}
          rows={[
            [<strong key="a">Ask</strong>, "Explain code, research live documentation, review a repository, suggest a plan.", "Write files or execute commands."],
            [<strong key="b">Code</strong>, "Read and write workspace files, run allowed checks, and present the diff for review.", "Delete files, publish to GitHub, or bypass the review step."],
            [<strong key="c">Agent</strong>, "Plan multi-step work, research when needed, edit, test, repair failures, and prepare a change record.", "Publish, force-push, or widen repository permissions."],
          ]}
        />
      </Section>

      <Section title="How a task actually runs" description="No hidden execution layer. Every tool call is visible in the chat, including failures.">
        <Steps
          steps={[
            { title: "Choose a workspace", body: "Select a project or an authorized repository branch. The agent receives a compact file tree, not your credentials." },
            { title: "Select an eligible model", body: "Pick a verified-free or local model. If none exists, the request is refused with setup instructions instead of falling back to a paid one." },
            { title: "Work with real tools", body: "Read, search, write, and run an allowlisted command in the workspace. Outputs, exit codes and research citations appear inline." },
            { title: "Approve the diff", body: "The review screen shows changed files, added/removed lines, test output and the destination branch before anything leaves your server." },
          ]}
        />
        <div className="mt-6">
          <Alert tone="warning" title="Honest limitations">
            Execution is a local runner on the CodePilot AI host, not a hardened multi-tenant sandbox. Run the platform in a
            container or dedicated machine, keep <code>EXECUTION_ENABLED</code> off on shared hosts, and use the browser preview
            only for static HTML. Third-party providers impose their own quotas and can remove free models at any time.
          </Alert>
        </div>
      </Section>

      <Section title="Built for a real deployment" description="A single Next.js application with SQLite persistence, so you can run it locally, on a small VPS, or in a container without a mandatory paid service.">
        <FeatureGrid
          columns={2}
          items={[
            { title: "One process, one database file", body: "SQLite in WAL mode with versioned migrations. No managed database subscription required, and no external queue in the default architecture." },
            { title: "Local runtimes welcome", body: "Ollama and OpenAI-compatible local endpoints are supported directly. Loopback hosts are allowlisted for providers, while SSRF protection blocks other private ranges and metadata endpoints." },
            { title: "Credentials encrypted at rest", body: "Provider keys and GitHub tokens are encrypted with AES-256-GCM derived from APP_SECRET. They are never returned to the browser or written to logs." },
            { title: "MIT licensed", body: "Read, modify and self-host the source. The free-only operating policy is a product commitment, not a license restriction." },
          ]}
        />
      </Section>

      <CTA />
    </>
  );
}
