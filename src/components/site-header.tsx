"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo, cx } from "./ui";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/docs", label: "Docs" },
  { href: "/integrations", label: "Integrations" },
  { href: "/security", label: "Security" },
  { href: "/changelog", label: "Changelog" },
];

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/"><Logo /></Link>
        <nav className="hidden items-center gap-5 text-sm text-muted md:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-fg">{link.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href={signedIn ? "/app" : "/sign-in"} className="cp-btn cp-btn-ghost !py-1.5 !text-xs">
            {signedIn ? "Open app" : "Sign in"}
          </Link>
          {!signedIn ? (
            <Link href="/sign-up" className="cp-btn cp-btn-primary !py-1.5 !text-xs">Get started</Link>
          ) : null}
          <button
            type="button"
            className="cp-btn cp-btn-ghost !px-2.5 md:hidden"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
          >
            {"\u2630"}
          </button>
        </div>
      </div>
      {open ? (
        <nav className={cx("flex flex-col gap-1 border-t border-border px-5 py-3 text-sm md:hidden")}>
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-md px-2 py-1.5 text-muted hover:bg-surface2 hover:text-fg" onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
