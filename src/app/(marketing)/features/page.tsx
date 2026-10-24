import type { Metadata } from "next";
import { CTA, FeatureGrid, PageHero, Section, Table } from "@/components/marketing";

export const metadata: Metadata = { title: "Features" };

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Everything needed to go from question to reviewed change"
        description="CodePilot AI combines a chat agent, repository access, a real workspace, bounded execution and a review gate. This page describes what the code in this repository actually does."
      />
      <Section title="Workspace and chat">
        <FeatureGrid
          items={[
            { title: "Streaming chat with history", body: "Server-sent events stream tokens and tool events. Conversations persist in SQLite and can be renamed, archived or deleted." },
            { title: "Three operating modes", body: "Ask for explanation and research, Code for edits and checks, Agent for multi-step work with planning and repair loops." },
            { title: "Markdown and code", body: "GitHub-flavoured markdown, syntax highlighting and a copy button on every code block." },
            { title: "Tool transparency", body: "Each tool call, its arguments summary, success state and output preview is shown in the conversation. Failures stay visible." },
            { title: "Stop and retry", body: "Abort a generation mid-stream; partial output is saved with a stopped status. Retry re-sends through the same eligibility checks." },
            { title: "Citations", body: "Research results carry real titles, URLs and snippets, stored with the message so you can revisit sources." },
          ]}
        />
      </Section>
      <Section title="Code workspace" description="Files are real files on disk, scoped per user and per project." className="border-y border-border bg-bgsoft">
        <FeatureGrid
          items={[
            { title: "Monaco editor", body: "Tabs, syntax highlighting, unsaved-change indicators and autosave with error reporting. Multi-file search and replace-ready editing." },
            { title: "Project explorer", body: "Create, rename and delete files with confirmation. Path traversal, symlink escapes and excluded directories are rejected server-side." },
            { title: "Starter templates", body: "Blank, website, landing page, dashboard, portfolio, blog, Node API, Python script and full-stack starter — each with real files and tests where relevant." },
            { title: "ZIP export and import", body: "Download any project as a ZIP, or import an authorized GitHub repository (size-capped) into a workspace." },
            { title: "Static preview", body: "Static HTML templates render in a sandboxed iframe with local CSS and JS inlined. Server projects use the runner instead." },
            { title: "Diff review", body: "Unified diffs per file with additions, deletions, test output and a publish dialog that requires explicit approval." },
          ]}
        />
      </Section>
      <Section title="Model governance">
        <Table
          head={["Pricing state", "How it is determined", "Default eligibility"]}
          rows={[
            ["Verified free", "OpenRouter catalog reports 0 input and 0 output price, or the owner records a written confirmation for a non-catalog endpoint.", "Eligible"],
            ["Local / self-hosted", "Ollama or an OpenAI-compatible endpoint whose base URL is loopback or explicitly allowlisted.", "Eligible"],
            ["Pricing unverified", "Generic OpenAI-compatible catalog with no pricing metadata.", "Blocked"],
            ["Paid", "Catalog reports a non-zero input or output price.", "Blocked"],
          ]}
        />
        <p className="mt-4 text-sm text-muted">
          The same check runs for chat, retries, agent steps, background tasks and automatic fallbacks. Fallbacks only consider
          models that are already eligible in your own configuration, and the switch is shown in the conversation.
        </p>
      </Section>
      <CTA />
    </>
  );
}
