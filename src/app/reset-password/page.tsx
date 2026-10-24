import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Set a new password" subtitle="Paste the reset token you received, then choose a new password.">
      <AuthForm mode="reset" initialToken={token ?? ""} />
    </AuthShell>
  );
}
