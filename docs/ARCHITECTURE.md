# Architecture

## Runtime shape

One Next.js (App Router) process, one SQLite database in WAL mode, and a data directory containing per-user workspaces and diff baselines. There is no message queue, object store, or external auth service in the default architecture.

```
Browser (React client components)
  │  fetch + SSE, session cookie, x-csrf-token
  ▼
Next.js route handlers (Node runtime)
  ├─ session/CSRF/rate-limit/ownership checks
  ├─ domain services (auth, projects, chats, tasks, git, providers)
  ├─ AI adapter layer ──► user-configured provider (OpenRouter / compatible / Ollama / OpenCode)
  ├─ research adapters ─► SearXNG / Brave / Tavily / DuckDuckGo
  ├─ GitHub client ─────► GitHub REST (installation or user token)
  └─ execution runner ──► allowlisted child process in data/workspaces/<user>/<project>
  ▼
SQLite + data/workspaces + data/baselines
```

## Layers

| Path | Responsibility |
| --- | --- |
| `src/app/api/**` | HTTP boundary: auth, validation (Zod), rate limits, ownership, audit |
| `src/lib/ai/**` | Provider adapters, SSE parsing, eligibility policy, agent loop, tool schemas |
| `src/lib/projects.ts` | Project lifecycle, diffs against baselines, change records |
| `src/lib/workspace/fs.ts` | Confined filesystem operations, tree, search, secrets denylist |
| `src/lib/execution/runner.ts` | Command allowlist and bounded process execution |
| `src/lib/git.ts` + `src/lib/github/**` | Review gate and branch/PR publishing |
| `src/lib/security/**` | SSRF policy, pinned-DNS HTTP client, rate limiter |
| `src/lib/db/**` | Schema migrations and query helpers |

## Free-only enforcement

`resolveEligibleModel(userId, ref)` is the single gate. It verifies ownership, provider/model enablement and pricing status (`verified_free` or `local` only) before returning a model. It is called by:

- `POST /api/chats/[id]/messages` (before any provider request),
- `runAgent` (again, for the primary model),
- `POST /api/tasks` (before a background task starts),
- model selection helpers used by the UI.

Fallbacks inside `runAgent` iterate only over `eligibleModels(userId)`, emit a visible `fallback` event, and never exceed two attempts. OpenRouter requests set `provider.allow_fallbacks = false`.

## Execution isolation

- `spawn` without a shell; tokenised argument allowlist (`npm`, `npx tsc --noEmit`, `node`, `python3`, `pytest`).
- No pipes, redirection, substitution or extra binaries.
- Environment rebuilt from an allowlist and stripped of `APP_SECRET`, `DATABASE_PATH`, provider/GitHub keys and token-like variables.
- Working directory is the project root; timeout kills the process group; output is capped.
- Network namespace isolation via `unshare -n` when available; every run reports whether isolation was applied.

This is a bounded runner, not a hardened multi-tenant sandbox. See `SECURITY.md`.

## Data model

`users`, `sessions`, `password_resets`, `oauth_states`, `github_connections`, `repositories`, `providers`, `provider_models`, `projects`, `chats`, `messages`, `research_queries`, `tasks`, `executions`, `changes`, `rate_limits`, `audit_logs`, `schema_migrations`. Migrations are versioned and applied at startup and by `npm run db:migrate`.

## Known limitations

- Background tasks are in-process; a restart interrupts them.
- Password reset requires an operator-configured email channel.
- OpenCode's message endpoint is request/response, so its output is delivered as one chunk and agent tool loops use another provider.
- Research quality and availability depend entirely on the configured provider.
- SQLite supports a single writer; do not run multiple instances against a network filesystem.
