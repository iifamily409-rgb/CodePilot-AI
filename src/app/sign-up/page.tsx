import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuth } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage() {
  if (await getAuth()) redirect("/app");
  return (
    <AuthShell
      title="Create your account"
      subtitle="No card, no subscription. You bring your own eligible model provider."
      footer={<>By creating an account you accept the <Link href="/legal/terms" className="cp-link">Terms</Link>, <Link href="/legal/privacy" className="cp-link">Privacy Policy</Link> and <Link href="/legal/acceptable-use" className="cp-link">Acceptable Use Policy</Link>.</>}
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
