import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LEGAL_DOCS, legalIsFinal, unresolvedPlaceholders } from "@/content/legal";
import { Markdown } from "@/components/markdown";
import { Alert } from "@/components/ui";

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const entry = LEGAL_DOCS[doc];
  return { title: entry ? entry.title : "Legal" };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const entry = LEGAL_DOCS[doc];
  if (!entry) notFound();
  const missing = unresolvedPlaceholders(entry.body);
  const finalized = legalIsFinal(entry.body);
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <nav className="mb-6 flex flex-wrap gap-2 text-xs text-muted">
        {Object.values(LEGAL_DOCS).map((item) => (
          <Link
            key={item.slug}
            href={`/legal/${item.slug}`}
            className={item.slug === entry.slug ? "cp-badge !text-accent" : "cp-badge hover:text-fg"}
          >
            {item.title}
          </Link>
        ))}
      </nav>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{entry.title}</h1>
        <p className="mt-2 text-sm text-muted">{entry.description}</p>
        <p className="mt-1 text-xs text-muted">
          Status: {finalized ? "finalized by this deployment" : "draft — placeholders must be completed before public launch"}
        </p>
      </div>
      {!finalized ? (
        <div className="mb-6">
          <Alert tone="warning" title="Unfinished legal placeholders">
            This document is an implementation-ready draft. The operator must complete the placeholders and obtain jurisdiction-specific
            review. Unresolved placeholders: {missing.length ? missing.join(", ") : "none — set LEGAL_PLACEHOLDERS_RESOLVED=1 after review to mark this document final"}.
          </Alert>
        </div>
      ) : null}
      <div className="cp-card p-6 md:p-8">
        <Markdown>{entry.body}</Markdown>
      </div>
      <p className="mt-6 text-xs text-muted">
        This document is a first draft, not legal advice, and does not guarantee compliance. The MIT License for the source code is a
        separate grant and does not require any hosted service to be free.
      </p>
    </div>
  );
}
