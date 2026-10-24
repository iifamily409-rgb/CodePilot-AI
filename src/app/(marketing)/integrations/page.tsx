import type { Metadata } from "next";
import { CTA, PageHero, Section, Table } from "@/components/marketing";
import { Alert, Badge } from "@/components/ui";

export const metadata: Metadata = { title: "Integrations" };

const INTEGRATIONS = [
  { name: "GitHub App", kind: "Authorization", status: "Supported", detail: "User authorization plus installation tokens scoped to the repositories you select. Read-only by default; write permissions are optional and checked at publish time." },
  { name: "GitHub OAuth App", kind: "Authorization", status: "Supported", detail: "Fallback when an App registration is not available. Uses the repo scope, which is broader — prefer a GitHub App in production." },
  { name: "OpenRouter", kind: "Model provider", status: "Supported", detail: "Live model catalog with per-model input/output pricing. Only zero-price models are eligible by default. Router fallbacks are disabled in requests." },
  { name: "OpenAI-compatible endpoints", kind: "Model provider", status: "Supported", detail: "Configurable base URL, auth style and extra headers. Models are classified unverified until you confirm zero cost, or local when the endpoint is loopback." },
  { name: "Ollama", kind: "Local runtime", status: "Supported", detail: "Discovers installed models from /api/tags. All models are classified local and run on your hardware." },
  { name: "OpenCode server", kind: "Local runtime", status: "Supported with limits", detail: "Uses the documented opencode serve HTTP API (/global/health, /config/providers, /session). Response is non-streaming on that endpoint, so agent tool loops use another provider." },
  { name: "SearXNG", kind: "Research", status: "Self-host recommended", detail: "Metasearch with JSON output. No API key, runs on your own infrastructure. This is the most reliable free research option." },
  { name: "Brave Search API", kind: "Research", status: "Optional key", detail: "Official API with a free tier and its own quota terms. Provide BRAVE_SEARCH_API_KEY." },
  { name: "Tavily", kind: "Research", status: "Optional key", detail: "Agent-oriented search with a monthly credit limit on the free tier." },
  { name: "DuckDuckGo HTML", kind: "Research", status: "Fallback, unofficial", detail: "No key required, but the endpoint is undocumented, may rate-limit, and returns no publication dates. Disable with RESEARCH_DISABLE_DUCKDUCKGO=1." },
  { name: "Local command runner", kind: "Execution", status: "Opt-in", detail: "Allowlisted npm, node, python and pytest commands with timeouts and output caps. Not a hardened sandbox; run the platform in a container." },
  { name: "Browser preview", kind: "Execution", status: "Static only", detail: "Sandboxed iframe with local CSS/JS inlined. Not a terminal and not a substitute for running tests." },
];

export default function IntegrationsPage() {
  return (
    <>
      <PageHero
        eyebrow="Integrations"
        title="Your accounts, your keys, your runtimes"
        description="CodePilot AI ships no shared inference account. Each integration is configured by the operator or by you, and each keeps its own limits and terms of service."
      />
      <Section>
        <div className="grid gap-3">
          {INTEGRATIONS.map((item) => (
            <div key={item.name} className="cp-card flex flex-col gap-2 p-4 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{item.name}</h3>
                  <Badge>{item.kind}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{item.detail}</p>
              </div>
              <Badge tone={item.status.includes("Supported") ? "success" : item.status.includes("Optional") ? "neutral" : "warning"}>
                {item.status}
              </Badge>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Limits we do not hide" className="border-t border-border bg-bgsoft">
        <Alert tone="warning" title="Free tiers change">
          Provider quotas, model availability and free-tier eligibility are controlled by those providers. CodePilot AI refreshes
          catalogs on demand and shows the last check time, but it cannot promise that a free model stays free. Nothing on this site
          promises unlimited computation.
        </Alert>
        <div className="mt-6">
          <Table
            head={["Service", "Who pays", "Minimum requirement"]}
            rows={[
              ["CodePilot AI", "Nobody — MIT source, no subscription", "A host for Node.js and a writable data directory"],
              ["AI inference", "The provider you configure", "A verified-free API key or local hardware"],
              ["GitHub", "Free for public and private repos within GitHub limits", "A GitHub account and app registration"],
              ["Web research", "Free with SearXNG self-hosted or DuckDuckGo fallback", "Optional: an API key for Brave or Tavily"],
              ["Hosting", "Your choice", "Self-host locally or on any Node-capable host; no paid service is mandatory"],
            ]}
          />
        </div>
      </Section>
      <CTA />
    </>
  );
}
