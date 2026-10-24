# Contributing

Thanks for improving CodePilot AI. Please keep changes small, verified and aligned with the free-only policy.

## Development setup

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

Node.js 22.5+ (24 recommended). No paid service is required; tests run without network access.

## Code standards

- TypeScript strict mode; no `any` unless a third-party shape genuinely requires it and the boundary is commented.
- Server-only modules import `server-only`. Never import `src/lib/env.ts`, crypto, database or provider code into a client component.
- Validate every request body with Zod and enforce ownership in the same handler.
- Never log secrets. Use `redactSecrets` for error surfaces.
- All outbound HTTP from provider/research code goes through `safeRequest` (SSRF protection). Do not use bare `fetch` for user-supplied URLs.
- Inspect the actual API documentation before adding a provider adapter; do not invent endpoints or capabilities.
- New inference paths must call `resolveEligibleModel`. Never bypass the free-only policy.

## Tests

```bash
npm test          # vitest
npm run typecheck
npm run lint
npm run build
```

Add tests for behaviour that could regress security: ownership checks, free-model blocking, path traversal, command allowlist, CSRF, publish guards.

## Pull requests

1. Describe the problem and the user-visible change.
2. Include tests or explain why none apply.
3. List any new environment variables in `.env.example`, README and the docs page.
4. Update `THIRD_PARTY_NOTICES.md` if you add a dependency.
5. Confirm `npm run typecheck && npm run lint && npm test && npm run build` passes locally.

## Licensing

By contributing you agree your contribution is licensed under the MIT License (see `LICENSE`). Do not add dependencies with incompatible licenses. New dependencies must be listed with their license in `THIRD_PARTY_NOTICES.md`.
