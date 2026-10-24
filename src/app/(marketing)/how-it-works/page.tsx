import type { Metadata } from "next";
import Link from "next/link";
import { CTA, PageHero, Section, Steps, Table } from "@/components/marketing";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "How it works" };

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="You stay in control of every consequential step"
        description="CodePilot AI splits work into small, inspectable stages. Reads and local edits are automatic inside a scoped workspace; publishing is never automatic."
      />
      <Section title="The loop">
        <Steps
          steps={[
            { title: "Authorize narrowly", body: "Sign in with a CodePilot AI account. Separately authorize GitHub. With a GitHub App you choose which repositories are installed; read-only versus write permission is visible in the app and re-checked before publishing." },
            { title: "Pick a workspace and model", body: "Open a project or import a repository branch. Only models whose pricing is verified zero or whose runtime is local can be selected." },
            { title: "Let the agent work", body: "The agent receives a system policy, a compact file tree and tool access. Web content and repository text are wrapped as untrusted data so they cannot override platform rules." },
            { title: "Verify with real commands", body: "Tests, lint, typecheck and builds run through an argument allowlist with no shell, scrubbed secrets, a timeout, an output cap and network isolation when available." },
            { title: "Review and approve", body: "A change record stores the diff and test output. Approval snapshots the workspace baseline; rejection leaves it untouched." },
            { title: "Publish to a new branch", body: "Publishing commits to a new branch and optionally opens a pull request. The default branch is refused, and secrets such as .env are excluded." },
          ]}
        />
      </Section>
      <Section title="Who can do what" className="border-y border-border bg-bgsoft">
        <Table
          head={["Action", "Requires", "Guardrail"]}
          rows={[
            ["Read a repository", "GitHub authorization for that installation", "Repository must belong to your account row"],
            ["Write workspace files", "Project ownership", "Path stays inside the project root"],
            ["Run a command", "EXECUTION_ENABLED=1 on the server", "Allowlisted binary and argument shape"],
            ["Publish", "Approved change + push permission", "New branch only, never the default branch"],
            ["Delete a project", "CSRF token + ownership", "Workspace and baseline directories removed"],
          ]}
        />
        <div className="mt-6">
          <Alert tone="info" title="What the agent cannot do">
            It cannot read your provider keys, call a paid model, access another account&apos;s workspace, bypass GitHub permissions, force-push,
            or mark its own change as approved. Those boundaries are enforced by the server, not by prompt wording.
          </Alert>
        </div>
      </Section>
      <Section title="Research behaviour">
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          When a question depends on current information — a library version, a migration path, a security advisory — the agent can call the
          research tool. Results come from a configured provider (SearXNG, Brave, Tavily, or DuckDuckGo&apos;s public HTML endpoint). If nothing is
          configured, the tool reports the setup requirement rather than inventing a source. Citations are stored with the message and can be
          opened directly. Pages are wrapped as untrusted data: instructions found inside them are ignored.
        </p>
        <p className="mt-4 text-sm text-muted">
          Read the deployment and configuration reference in the <Link href="/docs" className="cp-link">documentation</Link>.
        </p>
      </Section>
      <CTA />
    </>
  );
}
