# X-Flex

A personal-use AI coding workspace you run yourself. Chat with an agent, connect only the GitHub repositories you authorize,
edit real files, run tests, and publish only the changes you approve.

- No subscription, ads, checkout, or mandatory hosted service.
- No shared inference account: you configure a free model or a local runtime.
- Free-only enforcement lives in the backend, not just the interface.
- Local development is the default; public deployment is optional and documented separately.

## What actually works

| Area | Behaviour in this repository |
| --- | --- |
| Accounts | Email/password (scrypt), server-side sessions, CSRF on mutations, password change and reset, account deletion |
| Chat | SSE streaming, markdown + highlighted code, Ask / Code / Agent modes, stop, retry, citations, visible tool events, persisted history (rename, archive, delete) |
| Providers | OpenRouter, OpenAI-compatible endpoints, Ollama (one-click preset), OpenCode server; multiple providers and models; encrypted credentials; health checks |
| Free-only guard | Verified free / local / unverified / paid classification, backend blocking on every path, visible fallback between your own eligible models |
| Models | Live catalog refresh, capability filters from catalog metadata, optional capability-based smart selection |
| GitHub | GitHub App (installation tokens) or OAuth app, repository sync, branches, import, new-branch commits, pull requests |
| Projects | 9 templates with real files, ZIP export, path-traversal protection, static preview |
| Editor | Monaco, tabs, file tree, global search, autosave, create/rename/delete, one-click “Ask AI” |
| Execution | Allowlisted npm/node/python test and build commands, timeout, output cap, scrubbed env, optional `unshare -n` network isolation |
| Review | Unified diffs, test output, approve/reject, publish to a new branch only, optional pull request |
| Research | SearXNG, Brave, Tavily, or a no-key DuckDuckGo fallback; real titles, URLs and snippets |

Everything above maps to real code. The app never reports a command as passing unless it actually exited zero.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · SQLite via better-sqlite3 (WAL) · Monaco · Zod · Vitest.

No Redis, message queue, ORM, auth SaaS or paid database is required. Persistence is one SQLite file; credentials are
AES-256-GCM encrypted with a key derived from `APP_SECRET`.

## Run it locally

Requires Node.js **22.5+** (Node 24 recommended).

```bash
npm install
cp .env.example .env            # set APP_SECRET: openssl rand -base64 48
npm run db:migrate
npm run dev                     # http://localhost:3000
```

Then:

1. Create an account at `/sign-up`.
2. Open **Providers** and either press **Quick add Ollama** (if `ollama serve` is running) or add OpenRouter with a key.
3. Press **Test**, then refresh models. Only `verified_free` and `local` models are selectable.
4. Create a project from a template, open the editor, and chat in **Code** mode.
5. Set `EXECUTION_ENABLED=1` in `.env` and restart if you want the local test runner enabled.

You can use X-Flex entirely offline with a local model: no GitHub, no research key, no public URL.

## Providers

| Provider | Setup | Eligibility |
| --- | --- | --- |
| OpenRouter | Base `https://openrouter.ai/api/v1`, bearer key | Catalog pricing: 0 input **and** 0 output → `verified_free`; anything else is blocked |
| Ollama | `ollama serve`, base `http://localhost:11434`, no key | All installed models are `local` |
| OpenCode | `opencode serve`, base `http://localhost:4096`, basic auth if a password is set | Models are `local` when the provider is a local runtime, otherwise pricing from its config or blocked |
| Custom OpenAI-compatible | HTTPS public endpoint, or a loopback one | `unverified` until you record a written zero-cost confirmation; loopback is `local` |

OpenRouter requests set `provider.allow_fallbacks = false`, so the router cannot silently substitute another model.
Requests to provider endpoints go through an SSRF-protected client (scheme checks, DNS pinning, private/metadata range
blocking, re-validated redirects).

## GitHub (optional)

1. Create a GitHub App; callback URL `${APP_URL}/api/github/callback`.
2. Permissions: **contents: read & write** (read-only is fine if you never publish), **metadata: read**, **pull requests: read & write**.
3. Install it and pick repositories. X-Flex only sees those.
4. Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (PEM; `\n` escapes allowed), `GITHUB_APP_SLUG`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`. Restart.
5. Connect from **Integrations**. Sync repositories, import one, or open it in chat.

Without App credentials the app falls back to OAuth-app mode (`repo read:user`), which is broader. Publishing always
creates a new branch and refuses the default branch; `.env`, keys and other secret files are excluded.

## Research (optional)

Set `SEARXNG_URL` to a self-hosted instance with JSON output enabled — the best keyless option. Brave and Tavily keys work
too. The DuckDuckGo HTML fallback needs no key but is unofficial and may rate-limit. If nothing is configured, the agent
reports that instead of inventing sources. Retrieved content is treated as untrusted data.

## Execution

`EXECUTION_ENABLED=1` enables a local runner on the host:

- argument allowlist, no shell, no pipes or redirection;
- environment stripped of secrets and token-like variables;
- per-command timeout, output cap, process-group kill;
- network namespace isolation via `unshare -n` where the host permits it (reported per run).

It is **not** a hardened multi-tenant sandbox. Keep it disabled on any machine you do not exclusively control.

## Commands

```bash
npm run dev         # development server
npm run build       # production build
npm start           # production server
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest (49 tests)
npm run db:migrate  # apply SQLite migrations
```

## Configuration

All variables are placeholders in `.env.example`. Essentials:

| Variable | Purpose |
| --- | --- |
| `APP_SECRET` | Required in production; encrypts credentials. Minimum 32 characters. |
| `APP_URL` | Origin for GitHub callbacks. `http://localhost:3000` for local use. |
| `DATABASE_PATH` | SQLite file, default `./data/xflex.db`. |
| `XFLEX_DATA_DIR` | Root for database, workspaces and baselines, default `./data`. |
| `GITHUB_*` | Optional GitHub authorization. |
| `SEARXNG_URL` / `BRAVE_SEARCH_API_KEY` / `TAVILY_API_KEY` | Optional research. |
| `EXECUTION_ENABLED` | `1` to enable the local command runner. |
| `ALLOW_PRIVATE_CUSTOM_ENDPOINTS` | Dangerous opt-in. Keep `0`. |

## Upgrading from the earlier build

This is a rename/rework of the previous prototype. Database schema is unchanged; point `DATABASE_PATH` at the old
`data/codepilot.db` if you want to keep its data, and note that the previous browser session cookie is no longer used
(you will sign in again). Provider keys remain decryptable because the encryption key derivation is unchanged.

## Optional: publishing an instance

Only if you later decide to share it. Build and run behind an HTTPS reverse proxy, persist the data directory, set a
strong `APP_SECRET`, and keep execution disabled on shared hosts. SQLite supports one writer, so do not run multiple
instances against the same file on a network share. Background agent tasks run in-process and do not survive a restart.
There is no uptime guarantee or support desk.

## Tests

```bash
npm test
```

49 tests cover authentication, credential encryption and redaction, ownership isolation, free-only enforcement (paid,
unverified and foreign models), provider SSRF validation, manual zero-cost confirmation, path traversal and secret-file
publish exclusion, the execution allowlist, diff/approval guards, branch sanitisation, agent tool permissions, rate
limiting, adapter streaming against a local mock endpoint, and the trimmed public surface.

## License and known limits

MIT — see `LICENSE` (copyright holder placeholder). Third-party attributions are in `THIRD_PARTY_NOTICES.md`.

Known limits: the local runner is bounded, not sandboxed; background tasks are in-process; OpenCode output is delivered
as one chunk; research quality depends on the provider you configure; password reset needs an email channel you supply.
