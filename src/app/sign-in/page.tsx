import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getAuth()) redirect("/app");
  return (
    <AuthShell
      title="Sign in"
      subtitle="Your X-Flex account is separate from GitHub authorization."
      footer={<>Private, self-hosted instance. Sign in only to a deployment you control.</>}
    >
      <AuthForm mode="signin" />
    </AuthShell>
  );
}
