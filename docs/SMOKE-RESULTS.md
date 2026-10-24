# Runtime verification results

Recorded against a production build (`npm run build` → `npm start`) on 2026-10-24, using an isolated SQLite database and a local mock OpenAI-compatible endpoint. No third-party AI credentials were used.

## Automated checks

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed (no errors) |
| `npm run lint` | Passed (0 errors, 2 warnings: generated-config style and image hint) |
| `npm test` | **51 passed / 51** across 6 files |
| `npm run build` | Passed (Next.js 15.5.28, 38 route handlers, SSG legal pages) |
| `npm run db:migrate` | Applied migrations 1–2, idempotent on rerun |

## Live API / page checks

| Check | Request | Observed |
| --- | --- | --- |
| Health | `GET /api/health` | `200 {status:"ok",database:"ok"}` |
| Unauthenticated access | `GET /api/projects` | `401` |
| Missing CSRF | `POST /api/projects` with session cookie only | `403` |
| Project creation | `POST /api/projects` (template `api`) | `201`, real files on disk |
| File write | `POST /api/projects/:id/files` | `200`, file persisted |
| Diff generation | `GET /api/projects/:id/changes` | Unified diff, additions counted |
| Test execution | `POST /api/projects/:id/run` `{command:"npm test"}` | `passed`, exit 0, real node:test output |
| Rejected command | `{command:"rm -rf /"}` | `400 command_rejected`, allowlist message |
| Paid model | chat message with `pricing_status=paid` | `403 model_ineligible` |
| Unverified model | chat message with `pricing_status=unverified` | `403 model_ineligible` |
| Cross-user chat | `GET /api/chats/cht_not_mine` | `404` |
| Local provider discovery | `POST /api/providers/:id/models` | `count:1`, classified `local`, eligible |
| Streaming chat | SSE `POST /api/chats/:id/messages` | Deltas streamed, assistant message persisted |
| Agent tool loop | agent-mode message with mock tool call | `tool_start` → `tool_result` → file created → diff available |
| Public pages | `/`, `/features`, `/how-it-works`, `/docs`, `/getting-started`, `/integrations`, `/security`, `/changelog`, `/contact` | `200` |
| Legal pages | `/legal/terms`, `/legal/privacy`, `/legal/acceptable-use` | `200`, draft banner + placeholders |
| Auth pages while signed in | `/sign-in`, `/sign-up` | `307` redirect to `/app` (expected) |
| App pages | `/app`, `/app/chat`, `/app/models`, `/app/providers`, `/app/projects`, `/app/repositories`, `/app/research`, `/app/tasks`, `/app/integrations`, `/app/settings`, `/app/help`, `/app/history` | `200` |

## Not verified in this environment

These require credentials or infrastructure the sandbox does not have. They are implemented but were **not** exercised against the live services, and this repository does not claim otherwise:

- GitHub App/OAuth authorization, repository sync and branch/PR publishing (no GitHub App registration or token). The API paths and permission checks are implemented and unit-tested at the guard level only.
- OpenRouter live catalog and inference (no API key).
- Ollama and OpenCode runtimes (not installed here).
- SearXNG/Brave/Tavily research (no service or keys). The DuckDuckGo parser is unit-tested with fixture HTML, not a live request.
- `unshare -n` network isolation (not permitted in this container); runs report `networkIsolated: false` honestly.
- Email delivery for password reset (no SMTP configured; development-only link is returned).
- Monaco editor rendering (loads client-side from the packaged `monaco-editor`/loader at runtime in a browser).
