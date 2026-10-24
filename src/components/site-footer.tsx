import Link from "next/link";
import { Logo } from "./ui";

const LINKS = [
  { href: "/docs", label: "Documentation" },
  { href: "/getting-started", label: "Local setup" },
  { href: "/changelog", label: "Changelog" },
  { href: "/app/help", label: "Help centre" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-bgsoft">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:grid-cols-[1.6fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-md text-sm text-muted">
            A personal-use AI coding workspace. Chat, connect only the repositories you choose, edit real files, run
            checks, and publish only what you approve.
          </p>
          <p className="mt-3 max-w-md text-xs text-muted">
            X-Flex has no subscription, ads, or checkout. Model access comes from a provider or local runtime that you
            configure, and those services keep their own limits and terms.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Project</p>
          <ul className="mt-3 space-y-2 text-sm">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-muted hover:text-fg">{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-5 py-4 text-center text-xs text-muted">
        X-Flex · personal-use build · MIT-licensed source. Self-host it or keep it on your machine.
      </div>
    </footer>
  );
}
