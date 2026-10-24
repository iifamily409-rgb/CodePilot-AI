import Link from "next/link";
import { Logo } from "./ui";

const GROUPS = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/integrations", label: "Integrations" },
      { href: "/changelog", label: "Changelog" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/getting-started", label: "Getting started" },
      { href: "/security", label: "Security" },
      { href: "/contact", label: "Support" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms of service" },
      { href: "/legal/privacy", label: "Privacy policy" },
      { href: "/legal/acceptable-use", label: "Acceptable use" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-bgsoft">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">
            Imagine. Code. Verify. A free-only, GitHub-connected AI coding platform you can self-host.
          </p>
          <p className="mt-3 text-xs text-muted">
            CodePilot AI charges no subscription and shows no ads. Third-party services you connect have their own limits and terms.
          </p>
        </div>
        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{group.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-muted hover:text-fg">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-5 py-4 text-center text-xs text-muted">
        MIT licensed source code. Legal documents are drafts with placeholders the operator must complete before launch.
      </div>
    </footer>
  );
}
