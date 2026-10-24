import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Password recovery" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Password recovery" subtitle="Request a single-use reset token.">
      <div className="mb-4">
        <Alert tone="warning" title="Email delivery is not configured by default">
          This build has no mail provider. In development the reset link is shown here. In production, the operator must configure an
          email delivery channel before recovery can work for users.
        </Alert>
      </div>
      <AuthForm mode="forgot" />
    </AuthShell>
  );
}
