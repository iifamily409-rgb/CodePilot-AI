# Architecture

## Runtime shape

One Next.js (App Router) process, one SQLite database in WAL mode, and a data directory with per-user workspaces and diff
baselines. No queue, object store, or external auth service in the default setup.

```
Browser (React client components)
  │  fetch + SSE, session cookie, x-csrf-token
  ▼
Next.js route handlers (Node runtime)
  ├─ session/CSRF/rate-limit/ownership checks
  ├─ domain services (auth, projects, chats, tasks, git, providers)
  ├─ AI adapters ───────► configured provider (OpenRouter / compatible / Ollama / OpenCode)
  ├─ research adapters ─► SearXNG / Brave / Tavily / DuckDuckGo
  ├─ GitHub client ─────► GitHub REST (installation or user token)
  └─ execution runner ──► allowlisted process in data/workspaces/<user>/<project>
  ▼
SQLite + data/workspaces + data/baselines
```

## Layers

| Path | Responsibility |
| --- | --- |
| `src/app/api/**` | HTTP boundary: auth, Zod validation, rate limits, ownership, audit |
| `src/lib/ai/**` | Provider adapters, SSE parsing, eligibility policy, agent loop, tool schemas |
| `src/lib/projects.ts` | Project lifecycle, baselines, diffs, change records |
| `src/lib/workspace/fs.ts` | Confined filesystem operations, tree, search, secret denylist |
| `src/lib/execution/runner.ts` | Command allowlist and bounded process execution |
| `src/lib/git.ts` + `src/lib/github/**` | Review gate and branch/PR publishing |
| `src/lib/security/**` | SSRF policy, pinned-DNS client, rate limiter |
| `src/lib/db/**` | Migrations and query helpers |

## Free-only enforcement

`resolveEligibleModel(userId, ref)` verifies ownership, provider/model enablement and pricing status (`verified_free` or
`local` only). It runs in chat sends, retries, every agent step, and background task creation. Fallbacks iterate only over
`eligibleModels(userId)`, are capped at two, and emit a visible `fallback` event. OpenRouter requests disable router
fallbacks.

## Execution isolation

- `spawn` without a shell; tokenised argument allowlist.
- Environment rebuilt from an allowlist, stripped of `APP_SECRET`, `DATABASE_PATH`, provider/GitHub keys and token-like variables.
- Working directory is the project root; timeout kills the process group; output is capped.
- `unshare -n` network namespace isolation when available; every run reports whether it was applied.

Bounded runner, not a hardened sandbox. See `SECURITY.md`.

## Data model

`users`, `sessions`, `password_resets`, `oauth_states`, `github_connections`, `repositories`, `providers`, `provider_models`,
`projects`, `chats`, `messages`, `research_queries`, `tasks`, `executions`, `changes`, `rate_limits`, `audit_logs`,
`schema_migrations`. Migrations are versioned and applied at startup and by `npm run db:migrate`.

## Known limitations

- Background tasks are in-process; a restart interrupts them.
- Password reset requires operator-supplied email delivery.
- OpenCode's message endpoint is request/response, so output arrives as one chunk.
- SQLite supports a single writer; do not share one file across instances on a network filesystem.
