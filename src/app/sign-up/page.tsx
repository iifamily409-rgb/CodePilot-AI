import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
      footer={<>This is a private, self-hosted instance. Prompts and file content are sent only to the model provider you configure.</>}
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
