import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Card } from "@/components/ui";

export const metadata: Metadata = { title: "Help centre" };

const FAQ = [
  {
    q: "Why can't I select a model?",
    a: "Only models classified verified free or local are eligible. Add a provider (Providers → Add provider), then press Refresh models. For OpenRouter, zero-price models appear automatically. For a generic endpoint, you must confirm zero cost before it becomes eligible.",
  },
  {
    q: "Why did the agent refuse to run a command?",
    a: "Execution uses a strict allowlist: npm test, npm run test|build|lint|typecheck|format|check|start|dev, npx tsc --noEmit, node --test, node <file>, python3 -m unittest, python3 -m pytest, pytest, and version checks. Shell operators, pipes and redirection are rejected. The operator must also set EXECUTION_ENABLED=1.",
  },
  {
    q: "Where are my files stored?",
    a: "In the server's data directory under workspaces/<your-user-id>/<project-id>. Baselines used for diffs live under baselines/. Download a ZIP before deleting a project; deletion is permanent.",
  },
  {
    q: "Can the agent push to GitHub by itself?",
    a: "No. It can edit the workspace and prepare a change record. Publishing requires you to approve the change and confirm a destination branch. Direct commits to the default branch are refused by the server.",
  },
  {
    q: "Why does research return nothing?",
    a: "Configure SEARXNG_URL (self-hosted, recommended) or a Brave/Tavily key. The DuckDuckGo fallback is unofficial and may rate-limit. The agent never invents a source when search fails.",
  },
  {
    q: "Does CodePilot AI cost anything?",
    a: "No subscription, ads or checkout. You provide model access. Third-party providers may charge you directly under their own terms — CodePilot AI cannot detect every billing arrangement, so check before configuring an endpoint.",
  },
  {
    q: "Something looks broken or unsafe.",
    a: "Report security issues privately to [SECURITY CONTACT EMAIL]. For functional bugs, open a repository issue with reproduction steps and redacted logs.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Help centre</h1>
        <p className="mt-1 text-sm text-muted">Troubleshooting for the real behaviour of this build.</p>
      </div>
      <div className="grid gap-3">
        {FAQ.map((item) => (
          <Card key={item.q}>
            <h2 className="font-semibold">{item.q}</h2>
            <p className="mt-1.5 text-sm text-muted">{item.a}</p>
          </Card>
        ))}
      </div>
      <Alert tone="info" title="Keyboard shortcuts">
        In chat: Enter sends, Shift+Enter adds a new line, the Stop button aborts generation and keeps the partial reply.
      </Alert>
      <Card>
        <h2 className="font-semibold">Setup references</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li><Link href="/docs" className="cp-link">Configuration and API reference</Link></li>
          <li><Link href="/getting-started" className="cp-link">Local installation</Link></li>
          <li><Link href="/security" className="cp-link">Security model and limitations</Link></li>
          <li><Link href="/contact" className="cp-link">Contact and support</Link></li>
        </ul>
      </Card>
    </div>
  );
}
