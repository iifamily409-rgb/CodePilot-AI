# CodePilot AI

**Imagine. Code. Verify.**

CodePilot AI is a free-only, GitHub-connected AI coding platform. It is a real, self-hostable application: persistent chat with a coding agent, authorized GitHub repositories, an on-disk project workspace with a Monaco editor, bounded command execution, live free-model discovery, web research, and an approval-gated path to a GitHub branch and pull request.

- No subscription, advertisements, checkout, or mandatory paid service.
- No shared inference account and no paid inference by default.
- Free-model eligibility is enforced **server-side** on every inference path.

## Verified capabilities

| Area | What works in this repository |
| --- | --- |
| Auth | Email/password accounts (scrypt), server-side sessions, CSRF, password change/reset, account deletion |
| GitHub | GitHub App or OAuth authorization, installation-scoped repository sync, branch listing, import, new-branch commits, PR creation |
| Chat | SSE streaming, markdown + highlighted code, history rename/archive/delete, Ask/Code/Agent modes, stop, retry, citations, tool events |
| Providers | OpenRouter, OpenAI-compatible, Ollama, OpenCode server; multiple providers/models; encrypted credentials; health checks |
| Free-only policy | Verified free / local / unverified / paid classification with backend blocking, visible fallbacks, manual confirmation workflow |
| Models | Live catalog refresh, capability filters from catalog metadata, smart capability-based selection |
| Research | SearXNG, Brave, Tavily, DuckDuckGo HTML fallback, page fetch, stored citations |
| Projects | 9 templates, real files, ZIP export/import, path-traversal protection, static preview, unified diffs |
| Execution | Allowlisted npm/node/python commands, timeouts, output caps, scrubbed env, optional `unshare -n` isolation |
| Review | Change records, per-file diffs, approval/rejection, publish to a new branch, optional PR, default-branch refusal |
| Legal/ops | MIT license, Terms, Privacy, AUP, SECURITY, CONTRIBUTING, Code of Conduct, third-party notices |

## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · SQLite (better-sqlite3, WAL) · Monaco Editor · Zod · Vitest.

No Redis, message queue, ORM or auth SaaS is required. Persistence is a single SQLite file; secrets are AES-256-GCM encrypted with a key derived from `APP_SECRET`.

## Local development

Requires Node.js **22.5+** (Node 24 recommended).

```bash
npm install
cp .env.example .env
#   set APP_SECRET (min 32 chars): openssl rand -base64 48
npm run db:migrate
npm run dev            # http://localhost:3000
```

Create an account at `/sign-up`, then add a provider at `/app/providers`:

- **OpenRouter** — base URL `https://openrouter.ai/api/v1`, bearer key. The live catalog marks zero-price models `verified_free`; everything else is blocked.
- **Ollama** — run `ollama serve`, add base URL `http://localhost:11434`, no key. Models are classified `local`.
- **OpenCode** — run `opencode serve`, add `http://localhost:4096`; set HTTP basic auth if `OPENCODE_SERVER_PASSWORD` is configured.
- **Custom OpenAI-compatible** — must be HTTPS and resolve publicly unless the host is allowlisted as local. Models start `unverified` and stay blocked until you confirm zero cost in the UI (a written note is stored) or the endpoint is loopback.

## Scripts

```bash
npm run dev         # development server
npm run build       # production build
npm start           # production server
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest
npm run db:migrate  # apply SQLite migrations
npm run docs:legal  # export legal markdown to docs/legal
```

## Environment

See `.env.example` for the full annotated list. Essentials:

| Variable | Purpose |
| --- | --- |
| `APP_SECRET` | **Required in production.** Encrypts credentials; also used for session hashing. |
| `APP_URL` | Public origin for OAuth callbacks. |
| `DATABASE_PATH` | SQLite file (default `./data/codepilot.db`). |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub authorization. |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_APP_SLUG` | GitHub App mode (recommended). |
| `SEARXNG_URL` / `BRAVE_SEARCH_API_KEY` / `TAVILY_API_KEY` | Research providers (optional). |
| `EXECUTION_ENABLED` | `1` to enable the local command runner. |
| `ALLOW_PRIVATE_CUSTOM_ENDPOINTS` | Dangerous opt-in; leave `0`. |

## GitHub App setup

1. Create a GitHub App at *Settings → Developer settings → GitHub Apps*.
2. Callback URL: `${APP_URL}/api/github/callback`.
3. Permissions: **Repository contents: read & write** (read-only works if you never publish), **Metadata: read**, **Pull requests: read & write**.
4. Install it on the account/organization and choose repositories.
5. Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (PEM; encode newlines as `\n` if single-line), `GITHUB_APP_SLUG`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, restart, then Connect GitHub in the app.

Without an App id/private key the app runs in OAuth-app mode using the `repo read:user` scope, which is broader. OAuth mode is documented, not recommended.

## Free-model policy

Classification comes from provider metadata:

- `verified_free` — catalog reports 0 input **and** 0 output price (OpenRouter), or the owner records an explicit confirmation for a non-catalog endpoint.
- `local` — loopback/self-hosted runtime (Ollama, local OpenAI-compatible).
- `unverified` — no pricing metadata. **Blocked.**
- `paid` — non-zero price. **Blocked.**

The resolver `resolveEligibleModel()` runs in chat, retry, agent steps, task creation and model selection. A crafted API request naming a paid model receives HTTP 403. Fallbacks only choose another model already eligible in your configuration and the switch is shown in the transcript.

OpenRouter requests set `provider.allow_fallbacks = false` so the router cannot silently substitute another model.

## Web research

Set `SEARXNG_URL` to a self-hosted instance with JSON output enabled (best free option), or a Brave/Tavily key. The DuckDuckGo HTML endpoint works without a key but is unofficial and may rate-limit. If nothing works, tools report the failure instead of fabricating sources. Retrieved content is wrapped as untrusted data.

## Execution environment

`EXECUTION_ENABLED=1` enables a **local** runner on the CodePilot AI host:

- argument allowlist, `spawn` without a shell, no pipes/redirection;
- environment scrubbed of `APP_SECRET`, database paths, provider keys and token-like variables;
- per-command timeout, output cap, process-group kill;
- network namespace isolation via `unshare -n` when the host permits it (reported honestly per run).

It is not a hardened multi-tenant sandbox. Run the platform in a container or dedicated host; keep execution disabled on shared infrastructure. Browser preview only renders static HTML in a sandboxed iframe.

## Deployment

```bash
npm ci
npm run build
APP_SECRET=... DATABASE_PATH=/srv/codepilot/data/codepilot.db npm start
```

Terminate TLS at a reverse proxy and forward to port 3000. Persist the data directory. SQLite works for a single instance; do not run multiple writers against a network filesystem. Background tasks run in-process — document that they do not survive restarts. Free hosting options exist (self-hosted VM/container, free database tiers), but every third-party service has its own limits; see `/docs` and `docs/DEPLOYMENT-CHECKLIST.md`.

## Tests

```bash
npm test
```

51 tests cover authentication and password handling, credential encryption/redaction, ownership isolation, free-only enforcement (paid/unverified/foreign models), provider SSRF validation, manual free-classification confirmation, path traversal and secret-file publish exclusion, execution allowlist, diff/approval guards, branch-name sanitisation, agent mode tool permissions, rate limiting, adapter streaming (local mock endpoint) and legal-document routing/sync. CSRF is enforced on every mutating route and verified in the live smoke run documented in `docs/SMOKE-RESULTS.md`, which also lists exactly what could not be verified without external credentials.

## License

MIT — see `LICENSE`. The copyright holder is a placeholder until the project owner sets it. Third-party attributions: `THIRD_PARTY_NOTICES.md`.

## Security

Report vulnerabilities privately per `SECURITY.md`. Do not open a public issue for an unpatched vulnerability.
