import "server-only";
import crypto from "node:crypto";
import { githubEnv } from "../env";

const API = "https://api.github.com";
export const GITHUB_API = API;

export type GithubMode = "github_app" | "oauth_app";

export function githubMode(): GithubMode | null {
  const env = githubEnv();
  if (env.appId && env.privateKey && env.clientId && env.clientSecret) return "github_app";
  if (env.clientId && env.clientSecret) return "oauth_app";
  return null;
}

export function githubConfigured(): boolean {
  return githubMode() !== null;
}

export function githubConfigError(): string | null {
  if (githubConfigured()) return null;
  return "GitHub is not configured on this server. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET (plus GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY for GitHub App mode) and restart.";
}

export function githubRedirectUri(): string {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/api/github/callback`;
}

export function authorizeUrl(state: string): string {
  const env = githubEnv();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.clientId ?? "");
  url.searchParams.set("redirect_uri", githubRedirectUri());
  url.searchParams.set("state", state);
  if (githubMode() === "oauth_app") url.searchParams.set("scope", "repo read:user");
  return url.toString();
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** RS256 JWT used to authenticate as the GitHub App (max 10 minute lifetime). */
export function appJwt(): string {
  const env = githubEnv();
  if (!env.appId || !env.privateKey) {
    throw new Error("GitHub App credentials are not configured (GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY).");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.appId }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(env.privateKey, "base64url");
  return `${signingInput}.${signature}`;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function installationToken(installationId: string): Promise<{
  token: string;
  expiresAt: string;
  permissions: Record<string, string>;
}> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt - Date.now() > 60_000) {
    return { token: cached.token, expiresAt: new Date(cached.expiresAt).toISOString(), permissions: {} };
  }
  const res = await fetch(`${API}/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${appJwt()}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
    },
    body: "{}",
    signal: AbortSignal.timeout(20_000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    throw new Error(
      data.message ??
        `GitHub did not issue an installation token (HTTP ${res.status}). Reinstall the app or check its permissions.`,
    );
  }
  const expiresAt = new Date(data.expires_at).getTime();
  tokenCache.set(installationId, { token: data.token, expiresAt });
  return { token: data.token, expiresAt: data.expires_at, permissions: data.permissions ?? {} };
}

export type TokenExchange = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeCode(code: string): Promise<TokenExchange> {
  const env = githubEnv();
  if (!env.clientId || !env.clientSecret) {
    throw new Error("GitHub OAuth credentials are not configured (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET).");
  }
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      code,
      redirect_uri: githubRedirectUri(),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json()) as TokenExchange;
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "GitHub authorization failed.");
  }
  return data;
}

export async function refreshUserToken(refreshToken: string): Promise<TokenExchange> {
  const env = githubEnv();
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json()) as TokenExchange;
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(data.error_description ?? "Could not refresh the GitHub authorization.");
  }
  return data;
}

export function installationSetupUrl(): string {
  const slug = githubEnv().appSlug;
  return slug ? `https://github.com/apps/${slug}/installations/new` : "";
}
