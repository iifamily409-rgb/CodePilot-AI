import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section } from "@/components/marketing";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Contact and support" };

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact and support"
        title="Get help without a support contract"
        description="CodePilot AI is self-hosted open source. Support happens through the repository and the operator who runs your instance."
      />
      <Section>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="cp-card p-5">
            <h2 className="font-semibold">Bugs and feature requests</h2>
            <p className="mt-2 text-sm text-muted">
              Open an issue in the project repository with reproduction steps, your Node.js version, and the relevant server log lines
              (remove secrets first).
            </p>
            <p className="mt-3 text-sm"><a className="cp-link" href="https://github.com/iifamily409-rgb/CodePilot-AI/issues" target="_blank" rel="noreferrer">Repository issues</a></p>
          </div>
          <div className="cp-card p-5">
            <h2 className="font-semibold">Security reports</h2>
            <p className="mt-2 text-sm text-muted">
              Report vulnerabilities privately to <strong>[SECURITY CONTACT EMAIL]</strong>. Do not open a public issue for an unpatched
              vulnerability. See SECURITY.md for the coordinated disclosure process.
            </p>
          </div>
          <div className="cp-card p-5">
            <h2 className="font-semibold">Operator contact</h2>
            <p className="mt-2 text-sm text-muted">
              This instance is operated by <strong>[OPERATOR LEGAL NAME]</strong>. Legal contact: <strong>[LEGAL CONTACT EMAIL]</strong>.
              Privacy contact: <strong>[PRIVACY CONTACT]</strong>. These placeholders must be completed before public launch.
            </p>
          </div>
          <div className="cp-card p-5">
            <h2 className="font-semibold">Before you ask</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-muted">
              <li>• Check <Link href="/docs" className="cp-link">documentation</Link> for configuration.</li>
              <li>• Confirm your provider model is eligible in Model explorer.</li>
              <li>• Check <Link href="/app/help" className="cp-link">Help center</Link> inside the app.</li>
            </ul>
          </div>
        </div>
        <div className="mt-6">
          <Alert tone="warning" title="No fabricated support promise">
            There is no guaranteed response time, uptime commitment or paid support tier. If you need contractual guarantees, deploy and
            operate your own instance.
          </Alert>
        </div>
      </Section>
    </>
  );
}
