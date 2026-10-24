# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes (current development line) |

Older snapshots and unaudited forks are not supported. Operators are responsible for keeping their deployment patched.

## Reporting a vulnerability

**Do not open a public issue for an unpatched vulnerability.**

Email: **[SECURITY CONTACT EMAIL]** (placeholder — the operator must set a monitored address before public launch).

Include:

- affected version or commit,
- a clear description of the issue and its impact,
- reproduction steps (minimal, without other users' data),
- relevant configuration (redact secrets),
- whether you intend to disclose publicly and your preferred timeline.

## What to expect

- Acknowledgement target: 5 business days. This is a best-effort open-source process, not a contractual SLA.
- We will confirm the issue, discuss remediation, and coordinate disclosure.
- Do not test against other users' data, degrade availability, or access data beyond what is necessary to demonstrate the issue.
- Good-faith research conducted under this policy will not be pursued legally by the project, to the extent permitted by law.

## Known design boundaries

These are documented limitations, not vulnerabilities in themselves:

- The local command runner is **not** a hardened multi-tenant sandbox. Enable it only on a host you control.
- Background agent tasks run in-process and do not survive a restart.
- The DuckDuckGo research fallback uses an unofficial endpoint.
- Third-party providers receive prompt and file content you choose to send.
- `ALLOW_PRIVATE_CUSTOM_ENDPOINTS=1` intentionally weakens SSRF protection. Do not enable it on a multi-user instance.

## Security controls implemented

Scrypt password hashing, hashed session tokens, HttpOnly cookies, CSRF double-submit, per-user ownership checks, AES-256-GCM credential encryption, secret redaction, SSRF protection with DNS pinning, path-traversal and symlink-escape rejection, execution allowlists with resource limits, rate limiting, and audit logging with hashed IPs. See `/security` on the running instance and `src/lib/security/` in the repository.
