import type { Metadata } from "next";
import { githubConfigured, githubMode } from "@/lib/github/app";
import { researchProviders } from "@/lib/research";
import { executionCapabilities } from "@/lib/execution/runner";
import { IntegrationsPanel } from "@/components/integrations/integrations-panel";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return <IntegrationsPanel configured={githubConfigured()} mode={githubMode()} research={researchProviders()} execution={executionCapabilities()} />;
}
