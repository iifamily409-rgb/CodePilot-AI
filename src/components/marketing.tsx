import Link from "next/link";
import type { ReactNode } from "react";
import { Card, cx } from "./ui";

export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="cp-grid-bg border-b border-border">
      <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        {eyebrow ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
        ) : null}
        <h1 className="max-w-3xl text-3xl font-bold leading-tight md:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted md:text-lg">{description}</p>
        {children ? <div className="mt-7 flex flex-wrap gap-3">{children}</div> : null}
      </div>
    </section>
  );
}

export function Section({
  title,
  description,
  children,
  id,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} className={cx("mx-auto max-w-6xl px-5 py-14", className)}>
      {title ? (
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-semibold md:text-3xl">{title}</h2>
          {description ? <p className="mt-3 text-muted">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function FeatureGrid({
  items,
  columns = 3,
}: {
  items: Array<{ title: string; body: string; meta?: string }>;
  columns?: 2 | 3;
}) {
  return (
    <div className={cx("grid gap-4", columns === 2 ? "md:grid-cols-2" : "md:grid-cols-3")}>
      {items.map((item) => (
        <Card key={item.title} className="h-full">
          <h3 className="text-base font-semibold">{item.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
          {item.meta ? <p className="mt-3 text-xs text-muted/80">{item.meta}</p> : null}
        </Card>
      ))}
    </div>
  );
}

export function Steps({ steps }: { steps: Array<{ title: string; body: string }> }) {
  return (
    <ol className="grid gap-4 md:grid-cols-2">
      {steps.map((step, index) => (
        <li key={step.title} className="cp-card flex gap-4 p-5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface2 text-sm font-bold text-accent">
            {index + 1}
          </span>
          <div>
            <h3 className="font-semibold">{step.title}</h3>
            <p className="mt-1 text-sm text-muted">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function CTA() {
  return (
    <section className="border-t border-border bg-bgsoft">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-5 py-14 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Start with your own providers.</h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Create an account, add a verified-free model or a local runtime, and connect only the repositories you choose.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/sign-up" className="cp-btn cp-btn-primary">Create an account</Link>
          <Link href="/getting-started" className="cp-btn cp-btn-ghost">Read the setup guide</Link>
        </div>
      </div>
    </section>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-surface2 text-left text-xs uppercase tracking-wide text-muted">
          <tr>{head.map((cell) => <th key={cell} className="px-4 py-3 font-semibold">{cell}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 text-muted">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
