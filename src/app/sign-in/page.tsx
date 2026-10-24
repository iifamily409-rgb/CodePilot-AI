import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuth } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getAuth()) redirect("/app");
  return (
    <AuthShell
      title="Sign in"
      subtitle="Your CodePilot AI account is separate from GitHub authorization."
      footer={<>By continuing you accept the <Link href="/legal/terms" className="cp-link">Terms</Link> and <Link href="/legal/privacy" className="cp-link">Privacy Policy</Link>.</>}
    >
      <AuthForm mode="signin" />
    </AuthShell>
  );
}
