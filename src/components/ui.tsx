import type { ReactNode } from "react";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: any;
}) {
  return <Tag className={cx("cp-card p-5", className)}>{children}</Tag>;
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  title?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "",
    success: "!text-success !border-[color-mix(in_oklab,var(--success)_45%,transparent)] !bg-[color-mix(in_oklab,var(--success)_12%,transparent)]",
    warning: "!text-warning !border-[color-mix(in_oklab,var(--warning)_45%,transparent)] !bg-[color-mix(in_oklab,var(--warning)_12%,transparent)]",
    danger: "!text-danger !border-[color-mix(in_oklab,var(--danger)_45%,transparent)] !bg-[color-mix(in_oklab,var(--danger)_12%,transparent)]",
    accent: "!text-accent !border-[color-mix(in_oklab,var(--accent)_45%,transparent)] !bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]",
  };
  return (
    <span className={cx("cp-badge", tones[tone])} title={title}>
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: "success" | "warning" | "danger" | "neutral" | "accent"; label: string }> = {
    verified_free: { tone: "success", label: "Verified free" },
    local: { tone: "accent", label: "Local" },
    unverified: { tone: "warning", label: "Pricing unverified" },
    paid: { tone: "danger", label: "Paid — blocked" },
    pending: { tone: "warning", label: "Awaiting review" },
    approved: { tone: "accent", label: "Approved" },
    rejected: { tone: "danger", label: "Rejected" },
    published: { tone: "success", label: "Published" },
    queued: { tone: "neutral", label: "Queued" },
    running: { tone: "accent", label: "Running" },
    awaiting_approval: { tone: "warning", label: "Awaiting approval" },
    completed: { tone: "success", label: "Completed" },
    failed: { tone: "danger", label: "Failed" },
    cancelled: { tone: "neutral", label: "Cancelled" },
    passed: { tone: "success", label: "Passed" },
    timeout: { tone: "danger", label: "Timed out" },
    error: { tone: "danger", label: "Error" },
    stopped: { tone: "warning", label: "Stopped" },
    complete: { tone: "success", label: "Complete" },
  };
  const entry = map[status] ?? { tone: "neutral" as const, label: status };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="cp-card flex flex-col items-center gap-3 p-10 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-muted">{description}</p>
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-label="Loading"
      className={cx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]", className)}
    />
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    info: "border-[color-mix(in_oklab,var(--accent)_40%,transparent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]",
    warning: "border-[color-mix(in_oklab,var(--warning)_40%,transparent)] bg-[color-mix(in_oklab,var(--warning)_10%,transparent)]",
    danger: "border-[color-mix(in_oklab,var(--danger)_40%,transparent)] bg-[color-mix(in_oklab,var(--danger)_10%,transparent)]",
    success: "border-[color-mix(in_oklab,var(--success)_40%,transparent)] bg-[color-mix(in_oklab,var(--success)_10%,transparent)]",
  };
  return (
    <div className={cx("rounded-xl border p-4 text-sm", tones[tone])}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div className="text-muted [&_a]:text-accent [&_a]:underline">{children}</div>
    </div>
  );
}

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "text-base", md: "text-lg", lg: "text-2xl" };
  return (
    <span className={cx("inline-flex items-center gap-2 font-bold tracking-tight", sizes[size])}>
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-linear-to-br from-accent to-violet text-[13px] font-black text-[#04121a]">
        CP
      </span>
      <span>
        CodePilot<span className="text-accent"> AI</span>
      </span>
    </span>
  );
}
