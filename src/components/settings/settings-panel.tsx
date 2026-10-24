"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, errorMessage } from "@/lib/client/api";
import { useSession } from "../session-context";
import { Alert, Badge, Card, Spinner } from "../ui";

export function SettingsPanel({ audit }: { audit: Array<{ id: string; action: string; target: string | null; created_at: string }> }) {
  const { user, github, refresh } = useSession();
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveProfile() {
    setBusy("profile");
    try {
      await api("/api/account", { method: "PATCH", body: { name, email } });
      await refresh();
      setNotice("Profile updated.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function changePassword() {
    setBusy("password");
    try {
      await api("/api/account", { method: "PATCH", body: { currentPassword, newPassword } });
      setNotice("Password changed. All other sessions were revoked; sign in again if this browser was signed out.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    if (confirm !== "delete my account") {
      setError('Type "delete my account" exactly to confirm.');
      return;
    }
    if (!window.confirm("This permanently deletes your account, projects, chats and workspace files. Continue?")) return;
    setBusy("delete");
    try {
      await api("/api/account", { method: "DELETE", body: { password: deletePassword, confirm } });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted">Account, security and data controls. Product authentication is separate from GitHub.</p>
      </div>
      {error ? <p className="rounded-lg border border-border bg-surface p-3 text-sm text-danger">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-border bg-surface p-3 text-sm text-success">{notice}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Profile</h2>
          <div className="mt-3 space-y-3">
            <div><label className="cp-label">Name</label><input className="cp-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
            <div><label className="cp-label">Email</label><input className="cp-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <button type="button" onClick={saveProfile} disabled={busy === "profile"} className="cp-btn cp-btn-primary">{busy === "profile" ? <Spinner /> : null}Save profile</button>
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Password</h2>
          <div className="mt-3 space-y-3">
            <div><label className="cp-label">Current password</label><input className="cp-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" /></div>
            <div><label className="cp-label">New password</label><input className="cp-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" /></div>
            <button type="button" onClick={changePassword} disabled={busy === "password" || !currentPassword || newPassword.length < 10} className="cp-btn cp-btn-primary">{busy === "password" ? <Spinner /> : null}Change password</button>
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Connections</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2"><dt className="text-muted">GitHub</dt><dd>{github ? <Badge tone="success">{github.login}</Badge> : <Badge tone="warning">Not connected</Badge>}</dd></div>
            <div className="flex items-center justify-between gap-2"><dt className="text-muted">Account created</dt><dd>{new Date(user.created_at).toLocaleDateString()}</dd></div>
          </dl>
          <Link href="/app/integrations" className="cp-btn cp-btn-ghost mt-3 !py-1.5 !text-xs">Manage integrations</Link>
        </Card>
        <Card>
          <h2 className="font-semibold">Recent security activity</h2>
          {audit.length === 0 ? <p className="mt-2 text-sm text-muted">No audit records yet.</p> : (
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {audit.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-2 border-b border-border pb-1">
                  <span className="font-mono">{entry.action}</span>
                  <span>{new Date(entry.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card>
        <h2 className="font-semibold text-danger">Delete account</h2>
        <p className="mt-1 text-sm text-muted">Removes the account, chats, projects, providers, repositories and workspace files. Export anything you need first.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <input className="cp-input" type="password" placeholder="Password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} autoComplete="current-password" />
          <input className="cp-input" placeholder='Type "delete my account"' value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button type="button" onClick={deleteAccount} disabled={busy === "delete" || !deletePassword} className="cp-btn cp-btn-danger">{busy === "delete" ? <Spinner /> : null}Delete</button>
        </div>
        <div className="mt-3"><Alert tone="warning" title="Irreversible">Deletion cannot be undone. Audit records may be retained for security purposes as described in the privacy policy.</Alert></div>
      </Card>
    </div>
  );
}
