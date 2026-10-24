import "server-only";
import { all, getDb, newId, nowIso, one } from "../db";
import { decryptSecret, encryptSecret, redactSecrets } from "../crypto";
import { exchangeCode, githubMode, installationToken, refreshUserToken } from "./app";
import {
  getViewer,
  listInstallationRepos,
  listOAuthRepos,
  listUserInstallations,
  type GhInstallation,
  type GhRepo,
} from "./api";

export type GithubConnection = {
  id: string;
  user_id: string;
  github_user_id: string;
  login: string;
  avatar_url: string | null;
  auth_kind: "github_app" | "oauth_app";
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  scopes: string | null;
  installations_json: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

export type Repository = {
  id: string;
  user_id: string;
  installation_id: string | null;
  github_id: string;
  owner: string;
  name: string;
  full_name: string;
  private: number;
  default_branch: string;
  html_url: string | null;
  description: string | null;
  language: string | null;
  permissions_json: string | null;
  selected: number;
  imported_project_id: string | null;
  synced_at: string;
};

export function getConnection(userId: string): GithubConnection | undefined {
  return one<GithubConnection>(
    "SELECT * FROM github_connections WHERE user_id = ? AND revoked_at IS NULL",
    userId,
  );
}

export function getInstallations(connection: GithubConnection): GhInstallation[] {
  try {
    return JSON.parse(connection.installations_json ?? "[]");
  } catch {
    return [];
  }
}

/** Returns a usable user-to-server token, refreshing it when close to expiry. */
export async function userToken(userId: string): Promise<{ token: string; connection: GithubConnection }> {
  const connection = getConnection(userId);
  if (!connection?.access_token_enc) {
    throw new Error("GitHub is not connected. Connect GitHub in Settings → Integrations.");
  }
  let token = decryptSecret(connection.access_token_enc);
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : null;
  if (expiresAt && expiresAt - Date.now() < 5 * 60_000 && connection.refresh_token_enc) {
    const refreshed = await refreshUserToken(decryptSecret(connection.refresh_token_enc));
    token = refreshed.access_token;
    getDb()
      .prepare(
        `UPDATE github_connections SET access_token_enc = ?, refresh_token_enc = ?, token_expires_at = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        encryptSecret(refreshed.access_token),
        refreshed.refresh_token ? encryptSecret(refreshed.refresh_token) : connection.refresh_token_enc,
        refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : null,
        nowIso(),
        connection.id,
      );
  }
  return { token, connection };
}

/** Token used for repository operations, preferring a scoped installation token. */
export async function repoToken(repo: Repository, userId: string): Promise<string> {
  if (repo.installation_id && githubMode() === "github_app") {
    const { token } = await installationToken(repo.installation_id);
    return token;
  }
  return (await userToken(userId)).token;
}

export async function connectGithub(userId: string, code: string): Promise<GithubConnection> {
  const mode = githubMode();
  if (!mode) throw new Error("GitHub is not configured on this server.");
  const exchanged = await exchangeCode(code);
  const token = exchanged.access_token;
  let installations: GhInstallation[] = [];
  if (mode === "github_app") {
    try {
      installations = await listUserInstallations(token);
    } catch {
      installations = [];
    }
  }
  const viewer = await getViewer(token);
  const ts = nowIso();
  const existing = one<GithubConnection>("SELECT * FROM github_connections WHERE user_id = ?", userId);
  const payload = {
    github_user_id: String(viewer.id),
    login: viewer.login,
    avatar_url: viewer.avatar_url ?? null,
    auth_kind: mode,
    access_token_enc: encryptSecret(token),
    refresh_token_enc: exchanged.refresh_token ? encryptSecret(exchanged.refresh_token) : null,
    token_expires_at: exchanged.expires_in
      ? new Date(Date.now() + exchanged.expires_in * 1000).toISOString()
      : null,
    scopes: exchanged.scope ?? null,
    installations_json: JSON.stringify(
      installations.map((i) => ({
        id: i.id,
        account: { login: i.account.login, type: i.account.type },
        suspended: Boolean(i.suspended),
      })),
    ),
    updated_at: ts,
    revoked_at: null,
  };
  if (existing) {
    getDb()
      .prepare(
        `UPDATE github_connections SET github_user_id=?, login=?, avatar_url=?, auth_kind=?,
         access_token_enc=?, refresh_token_enc=?, token_expires_at=?, scopes=?, installations_json=?,
         updated_at=?, revoked_at=NULL WHERE id=?`,
      )
      .run(
        payload.github_user_id,
        payload.login,
        payload.avatar_url,
        payload.auth_kind,
        payload.access_token_enc,
        payload.refresh_token_enc,
        payload.token_expires_at,
        payload.scopes,
        payload.installations_json,
        payload.updated_at,
        existing.id,
      );
  } else {
    getDb()
      .prepare(
        `INSERT INTO github_connections (id, user_id, github_user_id, login, avatar_url, auth_kind,
         access_token_enc, refresh_token_enc, token_expires_at, scopes, installations_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId("gh"),
        userId,
        payload.github_user_id,
        payload.login,
        payload.avatar_url,
        payload.auth_kind,
        payload.access_token_enc,
        payload.refresh_token_enc,
        payload.token_expires_at,
        payload.scopes,
        payload.installations_json,
        ts,
        ts,
      );
  }
  return getConnection(userId)!;
}

export function disconnectGithub(userId: string): void {
  getDb()
    .prepare("UPDATE github_connections SET revoked_at = ?, access_token_enc = NULL, refresh_token_enc = NULL, updated_at = ? WHERE user_id = ?")
    .run(nowIso(), nowIso(), userId);
  getDb().prepare("DELETE FROM repositories WHERE user_id = ?").run(userId);
}

/** Refresh the accessible repository list from GitHub. Never widens access. */
export async function syncRepositories(userId: string): Promise<{ synced: number; installations: number }> {
  const { token, connection } = await userToken(userId);
  const mode = connection.auth_kind;
  const collected: Array<{ repo: GhRepo; installationId: string | null }> = [];

  if (mode === "github_app") {
    const installations = await listUserInstallations(token);
    getDb()
      .prepare("UPDATE github_connections SET installations_json = ?, updated_at = ? WHERE id = ?")
      .run(
        JSON.stringify(
          installations.map((i) => ({ id: i.id, account: { login: i.account.login, type: i.account.type }, suspended: Boolean(i.suspended) })),
        ),
        nowIso(),
        connection.id,
      );
    for (const installation of installations) {
      if (installation.suspended) continue;
      try {
        const repos = await listInstallationRepos(token, String(installation.id));
        for (const repo of repos) collected.push({ repo, installationId: String(installation.id) });
      } catch {
        // A single installation failing must not wipe the rest of the sync.
      }
    }
  } else {
    const repos = await listOAuthRepos(token);
    for (const repo of repos) collected.push({ repo, installationId: null });
  }

  const ts = nowIso();
  const db = getDb();
  const seenIds = new Set<string>();
  const upsert = db.prepare(
    `INSERT INTO repositories (id, user_id, installation_id, github_id, owner, name, full_name, private,
      default_branch, html_url, description, language, permissions_json, selected, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(user_id, github_id) DO UPDATE SET
       installation_id = excluded.installation_id, owner = excluded.owner, name = excluded.name,
       full_name = excluded.full_name, private = excluded.private, default_branch = excluded.default_branch,
       html_url = excluded.html_url, description = excluded.description, language = excluded.language,
       permissions_json = excluded.permissions_json, synced_at = excluded.synced_at`,
  );
  for (const { repo, installationId } of collected) {
    const githubId = String(repo.id);
    if (seenIds.has(githubId)) continue;
    seenIds.add(githubId);
    upsert.run(
      newId("repo"),
      userId,
      installationId,
      githubId,
      repo.owner.login,
      repo.name,
      repo.full_name,
      repo.private ? 1 : 0,
      repo.default_branch || "main",
      repo.html_url,
      repo.description,
      repo.language,
      JSON.stringify(repo.permissions ?? {}),
      ts,
    );
  }
  const existing = all<{ id: string; github_id: string; imported_project_id: string | null }>(
    "SELECT id, github_id, imported_project_id FROM repositories WHERE user_id = ?",
    userId,
  );
  for (const row of existing) {
    if (!seenIds.has(row.github_id) && !row.imported_project_id) {
      db.prepare("DELETE FROM repositories WHERE id = ?").run(row.id);
    }
  }
  return { synced: seenIds.size, installations: mode === "github_app" ? getInstallations(connection).length : 0 };
}

export function listRepositories(userId: string): Repository[] {
  return all<Repository>(
    "SELECT * FROM repositories WHERE user_id = ? ORDER BY full_name COLLATE NOCASE",
    userId,
  );
}

export function getRepository(userId: string, repositoryId: string): Repository | undefined {
  return one<Repository>("SELECT * FROM repositories WHERE id = ? AND user_id = ?", repositoryId, userId);
}

export function connectionSummary(userId: string) {
  const connection = getConnection(userId);
  if (!connection) return null;
  return {
    login: connection.login,
    avatarUrl: connection.avatar_url,
    authKind: connection.auth_kind,
    scopes: connection.scopes,
    tokenExpiresAt: connection.token_expires_at,
    installations: getInstallations(connection),
    connectedAt: connection.created_at,
  };
}

export { redactSecrets };
