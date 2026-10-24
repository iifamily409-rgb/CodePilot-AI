# Security

X-Flex is a personal-use, self-hosted build. This document describes the implemented controls and how to report a problem.

## Reporting

Use a **private security advisory** on the source repository. Do not open a public issue for an unpatched vulnerability.
Include the affected version or commit, reproduction steps, and configuration with secrets removed. This is a
best-effort personal project: there is no SLA, bug bounty, or contractual support.

## Implemented controls

- scrypt password hashing; opaque session tokens stored only as SHA-256 hashes; HttpOnly, SameSite=Lax cookies; revocation on password change.
- CSRF double-submit token plus Origin/Host checks on every mutating API route.
- Per-user ownership checks for projects, chats, repositories, providers, messages, tasks and changes.
- AES-256-GCM encryption for provider keys and GitHub tokens, derived from `APP_SECRET`; secrets never returned by the API.
- SSRF protection with scheme/host validation, single DNS resolution, private/loopback/metadata range blocking, pinned connections and re-validated redirects.
- Path confinement: traversal, absolute paths, symlink escapes and ignored directories rejected; 512 KB editor limit.
- Execution allowlist without a shell, scrubbed environment, timeout, output cap, process-group kill and optional network namespace isolation.
- Secret redaction in errors, logs and stored assistant output; secret files excluded from commits.
- Prompt-injection resistance: retrieved pages and repository content are wrapped as untrusted data and cannot grant permissions.
- Fixed-window rate limits in SQLite; audit records with hashed client IPs.

## Known boundaries (not vulnerabilities by themselves)

- The local runner is **not** a hardened multi-tenant sandbox. Do not enable it on shared infrastructure.
- Background agent tasks run in-process and do not survive a restart.
- `ALLOW_PRIVATE_CUSTOM_ENDPOINTS=1` intentionally weakens SSRF protection. Leave it off.
- The DuckDuckGo research fallback uses an unofficial endpoint.
- Model providers receive the prompts and file content you send them; choose providers you trust.
- Password recovery requires an email channel the operator configures; without it, production recovery is unavailable.

## Deployment hygiene

Use HTTPS, a unique `APP_SECRET` of 48+ random bytes, a private data directory, and encrypted backups. Rotate GitHub App
keys if a token is exposed. Keep Node.js and dependencies updated.
