import type { Metadata } from "next";
import { ProviderManager } from "@/components/providers/provider-manager";

export const metadata: Metadata = { title: "Providers" };

export default function ProvidersPage() {
  return <ProviderManager />;
}
