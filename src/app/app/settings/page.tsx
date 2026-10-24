import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { listAudit } from "@/lib/audit";
import { SettingsPanel } from "@/components/settings/settings-panel";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const auth = await requireAuth();
  return <SettingsPanel audit={listAudit(auth.user.id)} />;
}
