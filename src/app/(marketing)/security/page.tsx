import type { Metadata } from "next";
import Link from "next/link";
import { CTA, PageHero, Section } from "@/components/marketing";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Security" };

const CONTROLS = [
  ["Authentication", "Password hashing with scrypt (N=16384), opaque session tokens stored only as SHA-256 hashes, HttpOnly SameSite=Lax cookies, 7-day expiry, revocation on password change."],
  ["CSRF", "Double-submit token bound to the session, sent in a custom header and validated on every mutating API route, plus Origin/Host comparison."],
  ["Authorization", "Every project, chat, provider, repository and change query is constrained by user_id. Workspaces are separated per user on disk."],
  ["Credential storage", "Provider keys and GitHub tokens encrypted with AES-256-GCM using a key derived from APP_SECRET. Secrets are never returned by APIs."],
  ["SSRF prevention", "Provider and research requests validate scheme, host and port, resolve DNS once, reject private/loopback/link-local/metadata ranges, pin the socket to the validated IP to defeat rebinding, and re-validate every redirect."],
  ["File safety", "Path traversal, absolute paths, symlink escapes and ignored directories are rejected. Reads and writes are capped at 512 KB. Secret files are excluded from commits."],
  ["Execution", "Argument allowlist with no shell, scrubbed environment, per-command timeout, output cap, process-group kill, and optional network namespace isolation via unshare where available."],
  ["Prompt injection", "Retrieved pages and repository content are wrapped as untrusted data and the system policy states they cannot grant new permissions."],
  ["Rate limiting", "Fixed-window limits keyed by IP or user are persisted in SQLite across sign-in, chat, research, execution and publishing routes."],
  ["Audit trail", "Sensitive actions (GitHub connect, provider changes, execution, approval, publishing, account deletion) are recorded with hashed client IPs."],
  ["Transport", "Security headers (nosniff, frame denial, referrer policy, permissions policy). Set HTTPS at the reverse proxy in production and enable secure cookies."],
  ["Secret redaction", "Known token formats and private-key blocks are redacted from API errors, task logs and stored assistant output."],
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security"
        title="Security boundaries live in the server"
        description="The platform assumes the model can be wrong or manipulated. Permissions, free-model enforcement, file scoping and publishing checks do not depend on the model behaving."
      />
      <Section title="Implemented controls">
        <div className="grid gap-3 md:grid-cols-2">
          {CONTROLS.map(([title, body]) => (
            <div key={title} className="cp-card p-4">
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Deployment responsibilities" className="border-y border-border bg-bgsoft">
        <Alert tone="warning" title="Execution is not a hardened sandbox">
          The local runner is designed for a single-tenant or trusted-team deployment inside a container or dedicated host. Do not enable
          execution on a shared multi-tenant server without additional isolation (separate container, VM, or a purpose-built sandbox).
          Browser preview is limited to static assets.
        </Alert>
        <ul className="mt-6 grid gap-2 text-sm text-muted md:grid-cols-2">
          <li>• Serve over HTTPS and set a strong, unique APP_SECRET (48+ random bytes).</li>
          <li>• Restrict provider egress with a firewall if you allow custom endpoints.</li>
          <li>• Back up the data directory; it contains the database and workspaces.</li>
          <li>• Rotate GitHub App keys and reinstall the app if a token is exposed.</li>
          <li>• Review legal placeholders before exposing the instance publicly.</li>
          <li>• Keep Node.js and dependencies updated; run npm audit periodically.</li>
        </ul>
      </Section>
      <Section title="Reporting a vulnerability">
        <p className="max-w-3xl text-sm text-muted">
          Report suspected vulnerabilities privately to <strong>[SECURITY CONTACT EMAIL]</strong> with reproduction steps and affected
          version. Do not open a public issue for an unpatched vulnerability. See <code>SECURITY.md</code> in the repository for the
          current process, and <Link href="/legal/terms" className="cp-link">Terms of Service</Link> for the warranty disclaimer.
        </p>
      </Section>
      <CTA />
    </>
  );
}
