"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cx, Logo } from "./ui";
import { ThemeToggle } from "./theme-toggle";
import { useSession } from "./session-context";
import { api } from "@/lib/client/api";

const NAV = [
  { href: "/app", label: "Dashboard", icon: "\u25a6" },
  { href: "/app/chat", label: "AI Chat", icon: "\u25c8" },
  { href: "/app/history", label: "Chat history", icon: "\u25f4" },
  { href: "/app/projects", label: "Projects", icon: "\u25ab" },
  { href: "/app/repositories", label: "Repositories", icon: "\u2387" },
  { href: "/app/models", label: "Model explorer", icon: "\u25ce" },
  { href: "/app/providers", label: "Providers", icon: "\u2699" },
  { href: "/app/research", label: "Web research", icon: "\u2315" },
  { href: "/app/tasks", label: "Agent tasks", icon: "\u25a3" },
  { href: "/app/integrations", label: "Integrations", icon: "\u26ad" },
  { href: "/app/settings", label: "Settings", icon: "\u2692" },
  { href: "/app/help", label: "Help", icon: "?" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, github } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await api("/api/auth/signout", { method: "POST", body: {} });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cx(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-fg ring-1 ring-[color-mix(in_oklab,var(--accent)_35%,transparent)]"
                : "text-muted hover:bg-surface2 hover:text-fg",
            )}
          >
            <span aria-hidden className="w-4 text-center text-[13px] opacity-80">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-border bg-bgsoft p-4 lg:flex lg:flex-col lg:gap-4">
        <Link href="/app" className="px-1 py-1"><Logo /></Link>
        <div className="cp-scroll flex-1 overflow-y-auto">{nav}</div>
        <div className="rounded-xl border border-border bg-surface p-3 text-xs text-muted">
          <p className="font-semibold text-fg">{user.name}</p>
          <p className="truncate">{user.email}</p>
          <p className="mt-2 flex items-center gap-1.5">
            <span className={cx("h-1.5 w-1.5 rounded-full", github ? "bg-success" : "bg-muted")} />
            {github ? `GitHub: ${github.login}` : "GitHub not connected"}
          </p>
          <button type="button" onClick={signOut} disabled={busy} className="cp-btn cp-btn-ghost mt-3 w-full !py-1.5 !text-xs">
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-bg/85 px-4 py-2.5 backdrop-blur lg:px-6">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setOpen((v) => !v)} className="cp-btn cp-btn-ghost !px-2.5 lg:hidden" aria-label="Toggle navigation">
              {"\u2630"}
            </button>
            <Link href="/app" className="lg:hidden"><Logo size="sm" /></Link>
            <span className="hidden text-xs text-muted lg:block">Free-only policy active \u00b7 verified free or local models only</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app/chat" className="cp-btn cp-btn-primary !py-1.5 !text-xs">New chat</Link>
            <ThemeToggle />
          </div>
        </header>
        {open ? (
          <div className="border-b border-border bg-bgsoft p-3 lg:hidden">{nav}</div>
        ) : null}
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
