import type { Metadata } from "next";
import { PageHero, Section } from "@/components/marketing";

export const metadata: Metadata = { title: "Changelog" };

const RELEASES = [
  {
    version: "0.1.0",
    date: "2026-10-24",
    title: "First functional build",
    changes: [
      "Session authentication, SQLite migrations and per-user ownership checks.",
      "GitHub App/OAuth authorization, repository sync, branch listing and import.",
      "Provider manager for OpenRouter, OpenAI-compatible endpoints, Ollama and the OpenCode server.",
      "Server-enforced free-only model policy with verified free, local, unverified and paid classifications.",
      "Streaming chat with Ask, Code and Agent modes, tool events, citations and persisted history.",
      "Model explorer with live catalog refresh and capability filters based on catalog metadata.",
      "Web research adapters: SearXNG, Brave, Tavily and a DuckDuckGo fallback.",
      "Projects with starter templates, Monaco editor, search, autosave, ZIP export and static preview.",
      "Allowlisted execution runner with timeouts, output caps and optional network isolation.",
      "Diff review, approval gate, new-branch commits and pull request preparation.",
      "Public site, legal drafts and operator documentation."
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <PageHero
        eyebrow="Changelog"
        title="What changed, without marketing language"
        description="Only shipped work is listed here. Entries describe behaviour that exists in the repository at that version."
      />
      <Section>
        <div className="space-y-6">
          {RELEASES.map((release) => (
            <article key={release.version} className="cp-card p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">v{release.version} — {release.title}</h2>
                <span className="text-xs text-muted">{release.date}</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                {release.changes.map((change) => (
                  <li key={change} className="flex gap-2"><span className="text-accent">•</span><span>{change}</span></li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}
