import "server-only";
import { decryptSecret } from "../crypto";
import { safeRequest, readStream, NetworkPolicyError } from "../security/safe-fetch";
import { providerUrlPolicy } from "../security/url-policy";
import type { ProviderRow } from "./types";

const FORBIDDEN_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
  "upgrade",
  "keep-alive",
  "te",
  "trailer",
  "proxy-authorization",
  "proxy-connection",
]);

export function normalizeBaseUrl(protocol: string, baseUrl: string): string {
  let value = baseUrl.trim().replace(/\/+$/, "");
  if (protocol === "openrouter" && !value) value = "https://openrouter.ai/api/v1";
  if (protocol === "ollama" && !value) value = "http://localhost:11434";
  if (protocol === "opencode" && !value) value = "http://localhost:4096";
  return value;
}

export function providerCredentials(provider: ProviderRow): {
  apiKey: string | null;
  headers: Record<string, string>;
} {
  let apiKey: string | null = null;
  if (provider.api_key_enc) {
    try {
      apiKey = decryptSecret(provider.api_key_enc);
    } catch {
      apiKey = null;
    }
  }
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey && provider.auth_type === "bearer") headers.authorization = `Bearer ${apiKey}`;
  if (apiKey && provider.auth_type === "x-api-key") headers["x-api-key"] = apiKey;
  if (apiKey && provider.auth_type === "basic") {
    headers.authorization = `Basic ${Buffer.from(`opencode:${apiKey}`).toString("base64")}`;
  }
  if (provider.headers_enc) {
    try {
      const extra = JSON.parse(decryptSecret(provider.headers_enc));
      for (const [key, value] of Object.entries(extra)) {
        const lower = key.toLowerCase();
        if (FORBIDDEN_HEADERS.has(lower) || lower.startsWith("proxy-") || lower === "cookie") continue;
        if (typeof value === "string") headers[lower] = value;
      }
    } catch {
      // Ignore malformed custom headers rather than failing the request.
    }
  }
  return { apiKey, headers };
}

export type RawResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  stream: NodeJS.ReadableStream;
};

export async function providerRequest(
  provider: ProviderRow,
  path: string,
  options: { method?: string; body?: unknown; timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<RawResponse> {
  const base = normalizeBaseUrl(provider.protocol, provider.base_url);
  const { headers } = providerCredentials(provider);
  const res = await safeRequest(`${base}${path}`, {
    method: options.method ?? "GET",
    headers: { ...headers, ...(options.headers ?? {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    timeoutMs: options.timeoutMs ?? 30_000,
    policy: providerUrlPolicy(),
  });
  return { status: res.status, headers: res.headers, stream: res.stream };
}

export async function providerJson(
  provider: ProviderRow,
  path: string,
  options: { method?: string; body?: unknown; timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<{ status: number; data: any; text: string }> {
  const res = await providerRequest(provider, path, options);
  const text = await readStream(res.stream, 4_000_000);
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { status: res.status, data, text };
}

/** Read newline-delimited data from a response stream with a hard size cap. */
export async function* readLines(
  stream: NodeJS.ReadableStream,
  limitBytes = 8_000_000,
): AsyncGenerator<string> {
  let buffer = "";
  let total = 0;
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > limitBytes) throw new NetworkPolicyError("Model response exceeded the size limit.", "response_too_large");
    buffer += chunk.toString("utf8");
    let index = buffer.indexOf("\n");
    while (index !== -1) {
      const line = buffer.slice(0, index).replace(/\r$/, "");
      buffer = buffer.slice(index + 1);
      yield line;
      index = buffer.indexOf("\n");
    }
  }
  if (buffer.trim().length > 0) yield buffer.trim();
}

export function errorMessageFromBody(text: string, status: number): string {
  try {
    const data = JSON.parse(text);
    return (
      data?.error?.message ??
      data?.error ??
      data?.message ??
      `Provider returned HTTP ${status}.`
    );
  } catch {
    return text.slice(0, 300) || `Provider returned HTTP ${status}.`;
  }
}
