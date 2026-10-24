import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section, Table } from "@/components/marketing";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Documentation" };

const ENV = [
  ["APP_SECRET", "Required in production", "48+ random bytes. Encrypts provider keys/GitHub tokens and is used for session hashing. Generate with openssl rand -base64 48."],
  ["APP_URL", "http://localhost:3000", "Public origin used for OAuth callbacks and links."],
  ["DATABASE_PATH", "./data/codepilot.db", "SQLite file path. Use an absolute path in production."],
  ["CODEPILOT_DATA_DIR", "./data", "Root for the database, workspaces, baselines and the development secret."],
  ["GITHUB_APP_ID", "—", "GitHub App id (enables App mode with installation tokens)."],
  ["GITHUB_APP_PRIVATE_KEY", "—", "PEM private key contents; literal newlines may be written as \\n."],
  ["GITHUB_APP_SLUG", "—", "App slug, used for the install link."],
  ["GITHUB_CLIENT_ID", "—", "OAuth client id (App or OAuth app)."],
  ["GITHUB_CLIENT_SECRET", "—", "OAuth client secret."],
  ["SEARXNG_URL", "—", "Self-hosted SearXNG base URL with JSON output enabled."],
  ["BRAVE_SEARCH_API_KEY", "—", "Optional Brave Search key."],
  ["TAVILY_API_KEY", "—", "Optional Tavily key."],
  ["RESEARCH_DISABLE_DUCKDUCKGO", "—", "Set to 1 to disable the unofficial DuckDuckGo HTML fallback."],
  ["EXECUTION_ENABLED", "0", "Set to 1 to allow the local command runner."],
  ["EXECUTION_ALLOW_NETWORK", "0", "Set to 1 to skip network namespace isolation for commands."],
  ["EXECUTION_TIMEOUT_MS", "120000", "Per-command timeout."],
  ["EXECUTION_MAX_OUTPUT_BYTES", "200000", "Output cap before the process is killed."],
  ["ALLOW_LOCAL_PROVIDER_HOSTS", "—", "Comma-separated extra hostnames treated as local runtimes."],
  ["ALLOW_PRIVATE_CUSTOM_ENDPOINTS", "0", "Dangerous: permits arbitrary private provider URLs. Keep off unless you fully trust every user."],
  ["OPENCODE_SERVER_URL / OPENCODE_SERVER_PASSWORD", "—", "Documentation-only hints; configure the OpenCode provider in the UI instead."],
];

export default function DocsPage() {
  return (
    <>
      <PageHero
        eyebrow="Documentation"
        title="Operator and developer reference"
        description="How to configure, extend and deploy CodePilot AI. The repository also contains README.md, SECURITY.md and CONTRIBUTING.md with the same details."
      />
      <Section title="Architecture">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="cp-card p-5 text-sm text-muted">
            <h3 className="mb-2 font-semibold text-fg">Request path</h3>
            <p>Next.js App Router → route handler → session/CSRF check → ownership query in SQLite → domain service → response. Streaming chat uses a server-sent event response, and each tool call is executed inside the same process.</p>
          </div>
          <div className="cp-card p-5 text-sm text-muted">
            <h3 className="mb-2 font-semibold text-fg">Data layout</h3>
            <p><code>data/codepilot.db</code> holds metadata. <code>data/workspaces/&lt;user&gt;/&lt;project&gt;</code> holds editable files and <code>data/baselines/...</code> holds the last approved snapshot used for diffs.</p>
          </div>
        </div>
        <div className="mt-6">
          <Alert tone="info" title="No message queue">
            Agent tasks run in the web process and are persisted in SQLite. They do not survive a restart and should not be used for
            guaranteed delivery. This is documented rather than simulated.
          </Alert>
        </div>
      </Section>
      <Section title="Environment variables" className="border-y border-border bg-bgsoft">
        <Table head={["Variable", "Default", "Purpose"]} rows={ENV} />
      </Section>
      <Section title="API surface (abridged)">
        <Table
          head={["Route", "Methods", "Notes"]}
          rows={[
            ["/api/auth/*", "POST, GET", "Sign up, sign in, sign out, session, password reset"],
            ["/api/account", "PATCH, DELETE", "Profile, password change, account deletion"],
            ["/api/github/*", "GET, POST", "Status, connect, callback, sync, repositories, branches, selection"],
            ["/api/providers, /api/providers/[id]", "GET, POST, PATCH, DELETE", "Provider CRUD, health check, discovery"],
            ["/api/models, /api/models/classify", "GET, POST", "Explorer, refresh all, classification changes"],
            ["/api/chats, /api/chats/[id]/messages", "GET, POST, PATCH, DELETE", "Persistence and SSE streaming"],
            ["/api/projects/*", "GET, POST, PATCH, DELETE", "Projects, files, preview, run, changes, ZIP, import, link"],
            ["/api/changes/[id]/decide|publish", "POST", "Approval gate and branch/PR publishing"],
            ["/api/research, /api/tasks", "GET, POST", "Web research and background agent tasks"],
            ["/api/health", "GET", "Liveness and execution flag"],
          ]}
        />
        <p className="mt-4 text-sm text-muted">
          All mutating routes require the <code>x-csrf-token</code> header and enforce ownership. Free-model enforcement is inside the
          shared resolver, so calling the chat API directly with a paid model reference returns HTTP 403.
        </p>
      </Section>
      <Section title="Adding a provider adapter">
        <ol className="max-w-3xl list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Add a protocol value to <code>src/lib/ai/types.ts</code>.</li>
          <li>Implement discovery in <code>src/lib/ai/discovery.ts</code> with an honest pricing classification.</li>
          <li>Implement streaming in <code>src/lib/ai/adapters.ts</code>, including a hard error path.</li>
          <li>Add request routing in <code>src/lib/ai/http.ts</code>; never bypass the SSRF-safe client.</li>
          <li>Document quotas and limitations on this page and in the changelog.</li>
        </ol>
        <p className="mt-4 text-sm text-muted">
          Read the local setup steps in <Link href="/getting-started" className="cp-link">Getting started</Link>.
        </p>
      </Section>
    </>
  );
}
