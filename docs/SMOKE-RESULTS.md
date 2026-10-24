# Runtime verification results

Recorded against the X-Flex 0.2.0 production build (`npm run build` → `npm start`) on 2026-10-24, using a fresh SQLite
database, `EXECUTION_ENABLED=1`, and a local mock OpenAI-compatible endpoint. No third-party AI credentials were used.

## Automated checks

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | 0 errors, 2 warnings (generated-config style, image hint) |
| `npm test` | **49 passed / 49** across 6 files |
| `npm run build` | Passed (22 pages, 39 API route handlers) |
| `npm run db:migrate` | Applied migrations 1–2 on a fresh file; idempotent on rerun |

## Live API / page checks

| Check | Request | Observed |
| --- | --- | --- |
| Health | `GET /api/health` | `200 {status:"ok",database:"ok"}` |
| Unauthenticated access | `GET /api/projects` | `401` |
| Missing CSRF | `POST /api/projects` with cookie only | `403` |
| Project creation | `POST /api/projects` (`api` template) | `201`, files written to disk |
| Test execution | `POST /api/projects/:id/run` `npm test` | `passed`, exit 0 |
| Rejected command | `{command:"rm -rf /"}` | `400 command_rejected` |
| Ollama preset | `POST /api/providers` (no runtime present) | Provider saved; discovery returned the real `ECONNREFUSED` error |
| Local model discovery | OpenAI-compatible endpoint on 127.0.0.1 | `1` model, `local`, eligible |
| Agent tool loop | agent-mode message | `tool_start` → `tool_result` → file written → diff available |
| Paid model | chat with `pricing_status=paid` | `403 model_ineligible` |
| Unverified model | chat with `pricing_status=unverified` | `403 model_ineligible` |
| Cross-user chat | `GET /api/chats/cht_not_mine` | `404` |
| Public pages | `/`, `/docs`, `/getting-started`, `/changelog` | `200` |
| Removed pages | `/legal/terms`, `/features`, `/contact` | `404` (removed as intended) |
| Auth pages while signed in | `/sign-in`, `/sign-up` | `307` → `/app` (expected) |
| App pages | `/app`, `/app/chat`, `/app/projects`, `/app/providers`, `/app/models`, `/app/repositories`, `/app/editor/:id`, `/app/integrations`, `/app/settings`, `/app/help`, `/app/history`, `/app/research`, `/app/tasks` | `200` |
| ZIP export | `GET /api/projects/:id/download` | `200`, 1,842-byte archive |

## Not verified in this environment

These are implemented but were **not** exercised against live services. The repository does not claim otherwise:

- GitHub App/OAuth authorization, repository sync, branch/PR publishing (no GitHub App registration).
- OpenRouter live catalog and inference (no API key); pricing classification logic is unit-tested.
- Real Ollama/OpenCode runtimes (the preset correctly reported a connection refusal here).
- SearXNG/Brave/Tavily research; the DuckDuckGo parser is tested with fixture HTML only.
- `unshare -n` network isolation (not permitted in this container); runs honestly report `networkIsolated: false`.
- Email delivery for password reset (no SMTP configured).
- Monaco editor rendering (loads client-side in a browser).
- Browser-level theme switching and responsive layout (CSS/theme script reviewed, not screenshot-tested).
