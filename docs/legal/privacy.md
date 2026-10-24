# Privacy Policy

**Effective date:** [EFFECTIVE DATE]  
**Operator:** [OPERATOR LEGAL NAME]  
**Privacy contact:** [PRIVACY CONTACT]  
**Governing law:** [GOVERNING JURISDICTION]

> Draft status: describes the data handling implemented in this repository. Complete the placeholders and review against your actual deployment before public launch. If you run a modified version, update this document to match it.

## 1. Scope

This policy covers the CodePilot AI instance operated by [OPERATOR LEGAL NAME]. It does not cover third-party services you connect (GitHub, model providers, search providers, your hosting provider), which have their own policies.

## 2. What we collect and why

### Account information
Email address, display name, a scrypt password hash (never the password itself), account creation time, and session records. Used to authenticate you and isolate your data.

### GitHub authorization and repository metadata
If you connect GitHub: your GitHub user id, login, avatar URL, an encrypted user access token (plus an encrypted refresh token when GitHub issues one), token expiry, granted scopes, and the list of installations you authorised. Repository metadata (name, owner, default branch, visibility, language, permissions) is stored to render the repository picker. We do not mirror repository contents except when you explicitly import a repository into a project workspace.

### Conversations and project files
Chat titles, messages, selected model, tool events, research citations, and error states. Project names, descriptions, file contents, baselines used for diffs, change records, test output, and commit metadata. Used to provide the workspace and to let you review changes.

### Provider configuration
Provider name, protocol, base URL, auth style, encrypted API key, encrypted custom headers, enabled state, and health-check results. Keys are decrypted only in server memory when making a request to that provider.

### Tool execution logs
Command text, exit code, duration, and captured output (capped). Stored in the database for the project history. Output may contain sensitive values printed by your own code; avoid printing secrets in tests.

### Research requests and citations
Queries you (or the agent) run, the provider used, result titles/URLs/snippets, and errors. Stored so you can revisit sources.

### Security and audit records
Sensitive actions such as connecting GitHub, changing providers, running commands, approving or publishing changes, and account deletion. Client IP addresses are stored only as SHA-256 hashes. Used to investigate abuse and secure the instance.

### Technical logs
Standard server logs may include request paths and redacted error messages. Secret patterns are redacted before logging. Configure your reverse proxy's log retention yourself.

## 3. What we do not collect

We do not use advertising trackers, third-party analytics scripts, or session-replay tools by default. If an operator adds analytics, this policy must be updated and consent obtained where required. We do not sell personal data. We do not build behavioural profiles.

## 4. Cookies and sessions

One essential cookie (`codepilot_session`) stores an opaque session token. It is HttpOnly, SameSite=Lax, Secure in production, and expires after seven days. The token is stored server-side only as a SHA-256 hash. A CSRF token is associated with the session and returned to the authenticated page, not stored in a cookie. The theme preference is stored in localStorage. No advertising cookies are set. Clearing cookies signs you out.

## 5. Where data is stored

Metadata is stored in a SQLite database on the operator's host. Workspaces and baselines are stored as files under the data directory with per-user separation. Credentials are encrypted with AES-256-GCM using a key derived from the server's APP_SECRET. Backups of that host therefore contain encrypted credentials and must be protected accordingly.

## 6. When data leaves the instance

Data is transmitted to third parties only when necessary for a feature you use:

- **Model providers:** the conversation messages, selected file contents the agent read, tool results, and system prompt are sent to the provider you configured, in order to generate a response. The exact fields depend on the provider's API. Do not select a provider you do not trust with your code.
- **GitHub:** when you sync repositories, browse branches, import a repository, or publish an approved change.
- **Search providers:** the research query string and, when the agent fetches a page, the URL. The search provider sees your server's IP address.
- **Hosting provider:** your infrastructure provider may process all data stored on the host.

Each of these is a separate controller or processor with its own terms. CodePilot AI does not control their retention or secondary use.

## 7. Legal bases (where GDPR-style rules apply)

Performance of a contract (providing the Service), legitimate interests (security, abuse prevention, service reliability), and consent where required (for optional integrations you choose to enable). You may withdraw consent by disconnecting the integration or deleting the data.

## 8. Retention

Account data, chats, projects, research history, and task logs are retained until you delete them or delete your account. Audit records may be retained longer where necessary for security investigations or legal obligations. Execution output is capped but retained with the project until deletion. Backups follow the operator's retention schedule.

## 9. Your rights

Depending on your jurisdiction you may have the right to access, correct, export, or delete your personal data, restrict or object to processing, and lodge a complaint with a supervisory authority. In the application you can:

- export project files as a ZIP;
- delete chats, projects, providers, and your account;
- update your name, email, and password in Settings.

For any other request, contact [PRIVACY CONTACT]. We may need to verify your identity. We will respond within the period required by applicable law.

## 10. Account deletion

Deleting your account requires your password and an explicit confirmation phrase. It removes your user record and cascades to sessions, GitHub connection, repositories, providers, models, projects, chats, messages, tasks, executions, changes, and research queries, and removes your workspace directories. Encrypted audit entries may remain without directly identifying content. Server and proxy logs follow their own retention.

## 11. Security measures

Scrypt password hashing, hashed session tokens, CSRF protection, per-user authorization checks, encrypted credentials, SSRF-protected outbound requests, path-traversal protection, execution allowlists with timeouts and network isolation where available, rate limiting, and secret redaction. No system is perfectly secure; report suspected incidents to [SECURITY CONTACT EMAIL].

## 12. Children

The Service is not directed to children under 16 (or the applicable minimum age). Do not create an account if you are below that age.

## 13. International transfers

If you use providers or hosting outside your country, data may be transferred internationally under those providers' safeguards. The operator's own storage location is [SERVICE ADDRESS IF REQUIRED] / the region of the chosen host.

## 14. Changes to this policy

Material changes will be announced in the application or repository with a new effective date. Continued use after the effective date constitutes acceptance.

## 15. Contact

Privacy: [PRIVACY CONTACT]  
Operator: [OPERATOR LEGAL NAME]  
Legal: [LEGAL CONTACT EMAIL]
