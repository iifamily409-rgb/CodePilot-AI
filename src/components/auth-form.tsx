"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { Alert, Spinner } from "./ui";

export function AuthForm({
  mode,
  initialToken = "",
}: {
  mode: "signin" | "signup" | "reset" | "forgot";
  initialToken?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    setDevLink(null);
    try {
      if (mode === "signup") {
        await api("/api/auth/signup", { method: "POST", body: { name, email, password } });
        router.push("/app");
        router.refresh();
        return;
      }
      if (mode === "signin") {
        await api("/api/auth/signin", { method: "POST", body: { email, password } });
        router.push("/app");
        router.refresh();
        return;
      }
      if (mode === "forgot") {
        const data = await api<{ message: string; devResetLink: string | null }>("/api/auth/password/forgot", {
          method: "POST",
          body: { email },
        });
        setNotice(data.message);
        setDevLink(data.devResetLink);
        return;
      }
      await api("/api/auth/password/reset", { method: "POST", body: { token, password } });
      setNotice("Password updated. Sign in with your new password.");
      setTimeout(() => router.push("/sign-in"), 800);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Alert tone="danger" title="Could not continue">{error}</Alert> : null}
      {notice ? (
        <Alert tone="success">
          {notice}
          {devLink ? (
            <p className="mt-2 break-all text-xs">
              Development reset link: <Link href={devLink} className="cp-link">{devLink}</Link>
            </p>
          ) : null}
        </Alert>
      ) : null}
      {mode === "signup" ? (
        <div>
          <label className="cp-label" htmlFor="name">Name</label>
          <input id="name" className="cp-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoComplete="name" />
        </div>
      ) : null}
      {mode !== "reset" ? (
        <div>
          <label className="cp-label" htmlFor="email">Email</label>
          <input id="email" type="email" className="cp-input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
      ) : null}
      {mode === "reset" ? (
        <div>
          <label className="cp-label" htmlFor="token">Reset token</label>
          <input id="token" className="cp-input font-mono text-xs" value={token} onChange={(e) => setToken(e.target.value)} required />
        </div>
      ) : null}
      {mode !== "forgot" ? (
        <div>
          <label className="cp-label" htmlFor="password">
            {mode === "reset" ? "New password" : "Password"}
          </label>
          <input
            id="password"
            type="password"
            className="cp-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "signin" ? 1 : 10}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
          {mode !== "signin" ? (
            <p className="mt-1 text-xs text-muted">At least 10 characters with letters and numbers.</p>
          ) : null}
        </div>
      ) : null}
      <button type="submit" className="cp-btn cp-btn-primary w-full" disabled={busy}>
        {busy ? <Spinner /> : null}
        {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "reset" ? "Set new password" : "Create reset request"}
      </button>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
        {mode === "signin" ? (
          <>
            <Link href="/sign-up" className="cp-link">Create an account</Link>
            <Link href="/forgot-password" className="cp-link">Forgot password?</Link>
          </>
        ) : (
          <Link href="/sign-in" className="cp-link">Back to sign in</Link>
        )}
      </div>
    </form>
  );
}
