import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section } from "@/components/marketing";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Getting started" };

const STEPS = [
  {
    title: "1. Run it locally",
    body: "Requires Node.js 22.5 or newer (Node 24 recommended) and npm.",
    code: `git clone https://github.com/iifamily409-rgb/CodePilot-AI.git\ncd CodePilot-AI\nnpm install\ncp .env.example .env\n# set APP_SECRET\nnpm run db:migrate\nnpm run dev`,
  },
  {
    title: "2. Create your account",
    body: "Open http://localhost:3000/sign-up. Product authentication is separate from GitHub authorization; you can create projects without GitHub.",
  },
  {
    title: "3. Add an eligible model",
    body: "Open Providers → Add provider. For OpenRouter paste a key and press Discover: only zero-price models stay eligible. For Ollama, use base URL http://localhost:11434 and start ollama serve.",
  },
  {
    title: "4. (Optional) connect GitHub",
    body: "Register a GitHub App with Contents read/write, Metadata read and Pull requests read/write plus the user-authorization callback. Fill GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and GITHUB_APP_SLUG, then restart and connect from Integrations.",
  },
  {
    title: "5. (Optional) enable commands",
    body: "Set EXECUTION_ENABLED=1 only on a host or container you control. Commands run inside the project workspace with a timeout, an output cap and secret-scrubbed environment.",
  },
  {
    title: "6. Create a project and chat",
    body: "Create a project from a template, open it in the editor, then ask the agent in Code mode to extend it. Run npm test from the project page, review the diff, and download a ZIP or publish to a new branch.",
  },
];

export default function GettingStartedPage() {
  return (
    <>
      <PageHero
        eyebrow="Getting started"
        title="A working instance in about ten minutes"
        description="The default deployment is a single Next.js process with a SQLite database and an encrypted-secret directory. No paid service is required."
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
          <Alert tone="warning" title="No mandatory credit card">
            CodePilot AI itself never charges you. Some providers you may choose (for example certain hosted inference APIs) require their
            own account, and some may ask for payment details on their side. Local runtimes and OpenRouter&apos;s zero-price models do not
            require payment to CodePilot AI. Check each provider&apos;s real terms before configuring it.
          </Alert>
        </div>
      </Section>
    </>
  );
}
