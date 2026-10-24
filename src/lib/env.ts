import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Central environment access. Nothing here is exposed to the browser.
 * Secrets are read lazily so that builds do not require production credentials.
 */

export const DATA_DIR = process.env.CODEPILOT_DATA_DIR
  ? path.resolve(process.env.CODEPILOT_DATA_DIR)
  : path.resolve(process.cwd(), "data");

export function dataPath(...parts: string[]): string {
  const full = path.join(DATA_DIR, ...parts);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  return full;
}

let cachedSecret: string | null = null;

/**
 * APP_SECRET protects session token hashing and credential encryption.
 * In production it is mandatory. In development a random secret is persisted
 * to the data directory so that restarts keep sessions/credentials readable.
 */
export function appSecret(): string {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.APP_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 32) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_SECRET is required in production (minimum 32 characters). Generate one with: openssl rand -base64 48",
    );
  }
  if (fromEnv && fromEnv.length > 0) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }
  const file = dataPath(".dev-secret");
  if (fs.existsSync(file)) {
    cachedSecret = fs.readFileSync(file, "utf8").trim();
    return cachedSecret;
  }
  const generated = crypto.randomBytes(48).toString("base64");
  fs.writeFileSync(file, generated, { mode: 0o600 });
  cachedSecret = generated;
  return cachedSecret;
}

export function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function appUrl(): string {
  return env("APP_URL") ?? env("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
}

export const githubEnv = () => ({
  appId: env("GITHUB_APP_ID"),
  appSlug: env("GITHUB_APP_SLUG"),
  privateKey: env("GITHUB_APP_PRIVATE_KEY")?.replace(/\\n/g, "\n"),
  clientId: env("GITHUB_CLIENT_ID"),
  clientSecret: env("GITHUB_CLIENT_SECRET"),
  webhookSecret: env("GITHUB_WEBHOOK_SECRET"),
});

export const researchEnv = () => ({
  searxngUrl: env("SEARXNG_URL"),
  braveKey: env("BRAVE_SEARCH_API_KEY"),
  tavilyKey: env("TAVILY_API_KEY"),
  allowDuckDuckGo: env("RESEARCH_DISABLE_DUCKDUCKGO") !== "1",
});

export const executionEnv = () => ({
  enabled: process.env.EXECUTION_ENABLED === "1",
  allowNetwork: process.env.EXECUTION_ALLOW_NETWORK === "1",
  timeoutMs: Number(process.env.EXECUTION_TIMEOUT_MS ?? 120_000),
  maxOutputBytes: Number(process.env.EXECUTION_MAX_OUTPUT_BYTES ?? 200_000),
});

export const providerEnv = () => ({
  allowPrivateCustomEndpoints:
    process.env.ALLOW_PRIVATE_CUSTOM_ENDPOINTS === "1",
  allowedPrivateHosts: (env("ALLOW_LOCAL_PROVIDER_HOSTS") ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean),
  opencodeServerUrl: env("OPENCODE_SERVER_URL"),
  opencodePassword: env("OPENCODE_SERVER_PASSWORD"),
});

export const isProduction = () => process.env.NODE_ENV === "production";
