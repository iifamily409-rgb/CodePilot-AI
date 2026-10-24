import type { Metadata } from "next";
import { PageHero, Section } from "@/components/marketing";

export const metadata: Metadata = { title: "Changelog" };

const RELEASES = [
  {
    version: "0.2.0",
    date: "2026-10-24",
    title: "X-Flex personal build",
    changes: [
      "Project renamed to X-Flex and trimmed to the application itself.",
      "Removed the legal/marketing surface: Terms, Privacy, Acceptable Use, support and sales pages are gone.",
      "Public site reduced to a landing page, documentation, local setup and this changelog.",
      "Data directory and cookie names moved to the X-Flex naming; APP_SECRET and provider credentials behave the same.",
      "One-click Ollama preset in Provider Manager.",
      "Chat falls back visibly to an eligible model when a saved conversation points at an ineligible one.",
      "Local development is documented separately from optional public deployment.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-10-24",
    title: "First functional build",
    changes: [
      "Session authentication, SQLite migrations and per-user ownership checks.",
      "GitHub authorization, repository sync, branch listing and import.",
      "Providers for OpenRouter, OpenAI-compatible endpoints, Ollama and OpenCode.",
      "Server-enforced free-only model policy with pricing classification.",
      "Streaming chat with Ask, Code and Agent modes, tool events, citations and history.",
      "Model explorer, live catalog refresh, web research adapters.",
      "Projects with templates, Monaco editor, ZIP export and static preview.",
      "Allowlisted execution runner, diff review, approval gate and branch/PR publishing.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <PageHero
        eyebrow="Changelog"
        title="What changed"
        description="Only shipped behaviour is listed. There are no fabricated benchmarks or roadmap promises."
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
