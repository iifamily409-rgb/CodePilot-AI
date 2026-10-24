import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section, Table } from "@/components/marketing";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Documentation" };

const ENV = [
  ["APP_SECRET", "Required in production", "32+ random characters. Encrypts provider keys and GitHub tokens and seeds session hashing. Generate with openssl rand -base64 48."],
  ["APP_URL", "http://localhost:3000", "Origin used for GitHub OAuth callbacks and links. Keep it localhost until you actually publish."],
  ["DATABASE_PATH", "./data/xflex.db", "SQLite database file."],
  ["XFLEX_DATA_DIR", "./data", "Root for the database, workspaces, baselines and the development secret."],
  ["GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET", "—", "GitHub authorization (App or OAuth app)."],
  ["GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY / GITHUB_APP_SLUG", "—", "Enable GitHub App mode with installation-scoped tokens (recommended)."],
  ["SEARXNG_URL", "—", "Self-hosted SearXNG base URL with JSON output enabled."],
  ["BRAVE_SEARCH_API_KEY / TAVILY_API_KEY", "—", "Optional research keys with their own quotas."],
  ["RESEARCH_DISABLE_DUCKDUCKGO", "—", "Set to 1 to remove the unofficial no-key fallback."],
  ["EXECUTION_ENABLED", "0", "Set to 1 to allow the local command runner on this host."],
  ["EXECUTION_ALLOW_NETWORK", "0", "Set to 1 to skip network namespace isolation for commands."],
  ["EXECUTION_TIMEOUT_MS / EXECUTION_MAX_OUTPUT_BYTES", "120000 / 200000", "Per-command timeout and output cap."],
  ["ALLOW_LOCAL_PROVIDER_HOSTS", "—", "Extra hostnames treated as local runtimes (comma separated)."],
  ["ALLOW_PRIVATE_CUSTOM_ENDPOINTS", "0", "Dangerous: allows any private provider URL. Keep off for personal use."],
];

export default function DocsPage() {
  return (
    <>
      <PageHero
        eyebrow="Documentation"
        title="How X-Flex works and how to configure it"
        description="A single Next.js process, a SQLite database and a data directory. Everything here can run on your own machine without a hosted service."
      />

      <Section title="Architecture">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="cp-card p-5 text-sm text-muted">
            <h3 className="mb-2 font-semibold text-fg">Request path</h3>
            <p>Next.js App Router → route handler → session, CSRF and ownership checks → domain service → SQLite or provider. Chat streams over server-sent events, and tool calls run inside the same process.</p>
          </div>
          <div className="cp-card p-5 text-sm text-muted">
            <h3 className="mb-2 font-semibold text-fg">Data layout</h3>
            <p><code>data/xflex.db</code> stores metadata. <code>data/workspaces/&lt;user&gt;/&lt;project&gt;</code> holds editable files and <code>data/baselines/...</code> holds the last approved snapshot used to compute diffs.</p>
          </div>
        </div>
      </Section>

      <Section title="Setup and configuration" className="border-y border-border bg-bgsoft">
        <div className="mb-6">
          <Alert tone="info" title="Local development is the default">
            Follow <Link href="/getting-started" className="cp-link">Getting started</Link>. Public deployment is optional and documented separately at the bottom of this page; nothing here requires a hosting account, email service or credit card.
          </Alert>
        </div>
        <Table head={["Variable", "Default", "Purpose"]} rows={ENV} />
      </Section>

      <Section title="Model providers">
        <div className="space-y-3 text-sm text-muted">
          <p><strong className="text-fg">OpenRouter</strong> — base URL <code>https://openrouter.ai/api/v1</code>, bearer key. The live catalog supplies per-model pricing; only models whose input and output prices are both zero are eligible. Requests set <code>provider.allow_fallbacks=false</code>.</p>
          <p><strong className="text-fg">Ollama</strong> — run <code>ollama serve</code>, add <code>http://localhost:11434</code>. Installed models are classified <code>local</code>. The Providers page has a one-click preset for this.</p>
          <p><strong className="text-fg">OpenCode</strong> — run <code>opencode serve</code>, add <code>http://localhost:4096</code>, and set HTTP basic auth if you configured <code>OPENCODE_SERVER_PASSWORD</code>. Its message endpoint is request/response, so output arrives as one chunk and agent tool loops use a different provider.</p>
          <p><strong className="text-fg">Custom OpenAI-compatible</strong> — must be HTTPS and resolve to a public address unless it is loopback. Discovered models start <code>unverified</code> and remain blocked until you record a written confirmation that the endpoint is zero-cost.</p>
          <p className="text-xs">All provider calls go through the SSRF-protected client: scheme checks, DNS pinning, private/metadata range blocking, and re-validated redirects.</p>
        </div>
      </Section>

      <Section title="Free-model policy" className="border-y border-border bg-bgsoft">
        <Table
          head={["State", "Determined by", "Eligible"]}
          rows={[
            ["verified_free", "Provider catalog reports 0 input and 0 output price, or an explicit owner confirmation for a non-catalog endpoint.", "Yes"],
            ["local", "Loopback or self-hosted runtime.", "Yes"],
            ["unverified", "No pricing metadata available.", "No"],
            ["paid", "Non-zero catalog price.", "No"],
          ]}
        />
        <p className="mt-4 text-sm text-muted">
          <code>resolveEligibleModel()</code> runs for chat, retries, agent steps and background tasks. Fallbacks only consider
          models already eligible in your own configuration and the switch is shown in the conversation.
        </p>
      </Section>

      <Section title="GitHub authorization">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Create a GitHub App and set the callback URL to <code>{`{APP_URL}/api/github/callback`}</code>.</li>
          <li>Permissions: repository contents read &amp; write (read-only is fine if you never publish), metadata read, pull requests read &amp; write.</li>
          <li>Install it and select repositories. Only those repositories are visible to X-Flex.</li>
          <li>Set <code>GITHUB_APP_ID</code>, <code>GITHUB_APP_PRIVATE_KEY</code> (PEM, newlines may be escaped as <code>\n</code>), <code>GITHUB_APP_SLUG</code>, <code>GITHUB_CLIENT_ID</code> and <code>GITHUB_CLIENT_SECRET</code>, then restart.</li>
          <li>Without App credentials the app runs in OAuth-app mode with the broader <code>repo</code> scope.</li>
        </ol>
        <p className="mt-3 text-sm text-muted">Publishing commits to a new branch and optionally opens a pull request. The default branch is refused, and secret files such as <code>.env</code> are excluded.</p>
      </Section>

      <Section title="Research and execution" className="border-y border-border bg-bgsoft">
        <p className="text-sm text-muted">
          Research uses SearXNG (self-hosted, recommended), Brave, Tavily, or the no-key DuckDuckGo HTML fallback. Results carry real titles, URLs and snippets; failures are reported instead of invented sources. Retrieved pages are wrapped as untrusted data so their instructions cannot override the system policy.
        </p>
        <p className="mt-3 text-sm text-muted">
          Execution is opt-in with <code>EXECUTION_ENABLED=1</code>. Commands are allowlisted (<code>npm test</code>, <code>npm run build|lint|typecheck</code>, <code>npx tsc --noEmit</code>, <code>node --test</code>, <code>python3 -m unittest|pytest</code>), run without a shell, with a scrubbed environment, a timeout, an output cap and network isolation via <code>unshare -n</code> when the host permits it. It is not a hardened multi-tenant sandbox.
        </p>
      </Section>

      <Section title="Security notes">
        <ul className="grid gap-2 text-sm text-muted md:grid-cols-2">
          <li>• Scrypt password hashes; sessions stored as SHA-256 hashes in HttpOnly cookies.</li>
          <li>• CSRF double-submit token on every mutating route, plus Origin checks.</li>
          <li>• Provider keys and GitHub tokens encrypted with AES-256-GCM.</li>
          <li>• Per-user ownership checks on every project, chat, repository and change.</li>
          <li>• Path traversal, absolute paths and symlink escapes rejected.</li>
          <li>• Secrets redacted from errors and task logs; secret files never published.</li>
        </ul>
        <p className="mt-4 text-sm text-muted">
          To report a vulnerability, use a private security advisory on the source repository. Do not open a public issue for an unpatched problem.
        </p>
      </Section>

      <Section title="Optional: publishing an instance" className="border-t border-border bg-bgsoft">
        <p className="text-sm text-muted">
          Only relevant if you later decide to share X-Flex. Run <code>npm run build</code> and <code>npm start</code> behind an
          HTTPS reverse proxy, persist the data directory, set a strong <code>APP_SECRET</code>, and keep execution disabled on any
          host you do not exclusively control. SQLite supports a single writer, so do not point multiple instances at the same file
          on a network share. There is no uptime guarantee and no support contract.
        </p>
      </Section>

      <Section title="API surface (abridged)">
        <Table
          head={["Route", "Methods", "Notes"]}
          rows={[
            ["/api/auth/*", "GET, POST", "Sign up, sign in, sign out, session, password reset"],
            ["/api/account", "PATCH, DELETE", "Profile, password change, account deletion"],
            ["/api/github/*", "GET, POST", "Status, connect, callback, sync, repositories, branches, selection"],
            ["/api/providers, /api/providers/[id]", "GET, POST, PATCH, DELETE", "Provider CRUD, health check, discovery"],
            ["/api/models, /api/models/classify", "GET, POST", "Explorer, refresh, classification"],
            ["/api/chats, /api/chats/[id]/messages", "GET, POST, PATCH, DELETE", "Persistence and SSE streaming"],
            ["/api/projects/*", "GET, POST, PATCH, DELETE", "Projects, files, preview, run, changes, ZIP, import, link"],
            ["/api/changes/[id]/decide|publish", "POST", "Approval gate and branch/PR publishing"],
            ["/api/research, /api/tasks", "GET, POST", "Research and background agent tasks"],
            ["/api/health", "GET", "Liveness and execution flag"],
          ]}
        />
      </Section>
    </>
  );
}
