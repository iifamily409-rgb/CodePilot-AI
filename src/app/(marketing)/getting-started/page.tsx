import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section } from "@/components/marketing";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Local setup" };

const STEPS = [
  {
    title: "1. Install and start",
    body: "Node.js 22.5+ (24 recommended) and npm. No hosting account is required for local use.",
    code: `npm install\ncp .env.example .env\n# set APP_SECRET: openssl rand -base64 48\nnpm run db:migrate\nnpm run dev   # http://localhost:3000`,
  },
  {
    title: "2. Create your account",
    body: "Open /sign-up. This account is local to your instance; it is separate from GitHub authorization.",
  },
  {
    title: "3. Add an eligible model",
    body: "Go to Providers. Use the Ollama preset if you have a local runtime, or add OpenRouter with an API key. Press Test, then refresh models. Only verified-free or local models stay selectable.",
  },
  {
    title: "4. Create a project and chat",
    body: "Create a project from a template, open the editor, and ask in Code mode to extend it. Run a check from the project page and review the diff.",
  },
  {
    title: "5. Optional: GitHub",
    body: "Register a GitHub App with contents, metadata and pull-request permissions, set the callback to /api/github/callback, fill the GITHUB_* variables, restart, then connect from Integrations. Access is limited to the repositories you select.",
  },
  {
    title: "6. Optional: commands and research",
    body: "Set EXECUTION_ENABLED=1 to allow the local test/build runner. Point SEARXNG_URL at a self-hosted SearXNG instance for keyless research, or add a Brave/Tavily key.",
  },
];

export default function GettingStartedPage() {
  return (
    <>
      <PageHero
        eyebrow="Local setup"
        title="Running on your own machine"
        description="X-Flex stores everything under the data directory in this repository. Local development needs no public URL and no third-party account except an AI provider."
      >
        <Link href="/sign-up" className="cp-btn cp-btn-primary">Create an account</Link>
        <Link href="/docs" className="cp-btn cp-btn-ghost">Configuration reference</Link>
      </PageHero>
      <Section>
        <div className="grid gap-4">
          {STEPS.map((step) => (
            <div key={step.title} className="cp-card p-5">
              <h2 className="font-semibold">{step.title}</h2>
              <p className="mt-1.5 text-sm text-muted">{step.body}</p>
              {step.code ? (
                <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-[var(--code-bg)] p-3 text-xs leading-relaxed"><code>{step.code}</code></pre>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Alert tone="info" title="You can stay offline">
            GitHub, research, and public deployment are optional. A local Ollama model and a new project are enough to use
            chat, editing, diffs and test execution entirely on your machine.
          </Alert>
        </div>
        <p className="mt-6 text-xs text-muted">
          Nothing in this setup requires payment to X-Flex. Providers you configure may impose their own quotas or charges;
          check their terms before adding a key.
        </p>
      </Section>
    </>
  );
}
