import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { connectionSummary } from "@/lib/github/connection";
import { SessionProvider } from "@/components/session-context";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  let auth;
  try {
    auth = await requireAuth();
  } catch {
    redirect("/sign-in");
  }
  const github = connectionSummary(auth.user.id);
  return (
    <SessionProvider user={auth.user} csrfToken={auth.csrfToken} github={github}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
