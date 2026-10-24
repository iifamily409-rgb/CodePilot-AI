import "server-only";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { IncomingMessage } from "node:http";
import { assertUrlAllowed, NetworkPolicyError, type UrlPolicy } from "./url-policy";

export { NetworkPolicyError } from "./url-policy";

export type SafeRequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeoutMs?: number;
  policy?: UrlPolicy;
  maxRedirects?: number;
};

export type SafeResponse = {
  status: number;
  headers: IncomingMessage["headers"];
  stream: IncomingMessage;
  finalUrl: string;
};

/**
 * HTTP client with SSRF protection: validates every URL and redirect target,
 * resolves DNS once and pins the socket to the validated address (defeating
 * DNS rebinding), enforces timeouts and strips credentials on cross-origin
 * redirects.
 */
export async function safeRequest(
  rawUrl: string,
  options: SafeRequestOptions = {},
): Promise<SafeResponse> {
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 30_000;
  let current = rawUrl;
  let method = options.method ?? "GET";
  let body = options.body;
  let headers: Record<string, string> = { ...(options.headers ?? {}) };

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const { url, addresses, isLocal } = await assertUrlAllowed(current, options.policy);
    const response = await singleRequest(url, addresses, isLocal, {
      method,
      headers,
      body,
      timeoutMs,
    });
    const location = response.headers.location;
    if (response.status >= 300 && response.status < 400 && location) {
      response.stream.resume();
      const nextUrl = new URL(location, url);
      if (nextUrl.host !== url.host) {
        const { authorization: _a, cookie: _c, host: _h, ...rest } = headers;
        headers = rest;
      }
      if (response.status === 303) {
        method = "GET";
        body = undefined;
      }
      current = nextUrl.toString();
      continue;
    }
    return { ...response, finalUrl: url.toString() };
  }
  throw new NetworkPolicyError("Too many redirects.", "too_many_redirects");
}

function singleRequest(
  url: URL,
  addresses: string[],
  isLocal: boolean,
  opts: {
    method: string;
    headers: Record<string, string>;
    body?: string | Buffer;
    timeoutMs: number;
  },
): Promise<Omit<SafeResponse, "finalUrl">> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    let settled = false;
    // Pin public connections to the address that was validated above,
    // defeating DNS rebinding between validation and connection. Local
    // runtimes resolve normally (they are explicitly allowlisted loopback).
    const pinned = !isLocal ? addresses.filter((a) => net.isIP(a) > 0) : [];
    const lookup: any = pinned.length
      ? (_host: string, options: any, cb: any) => {
          const done = typeof options === "function" ? options : cb;
          done(null, pinned[0], net.isIP(pinned[0]) === 6 ? 6 : 4);
        }
      : undefined;
    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: opts.method,
        headers: { "user-agent": "X-Flex/0.1", ...opts.headers },
        ...(lookup ? { lookup } : {}),
        servername: url.protocol === "https:" ? url.hostname : undefined,
        timeout: opts.timeoutMs,
        maxHeaderSize: 64 * 1024,
      },
      (res) => {
        settled = true;
        clearTimeout(timer);
        resolve({ status: res.statusCode ?? 0, headers: res.headers, stream: res });
      },
    );
    const timer = setTimeout(() => {
      req.destroy(new NetworkPolicyError(`Request timed out after ${opts.timeoutMs}ms.`, "timeout"));
    }, opts.timeoutMs + 1000);
    req.on("timeout", () => {
      req.destroy(new NetworkPolicyError(`Request timed out after ${opts.timeoutMs}ms.`, "timeout"));
    });
    req.on("error", (err) => {
      clearTimeout(timer);
      if (!settled) reject(err);
    });
    req.on("close", () => clearTimeout(timer));
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}

export async function readStream(
  stream: NodeJS.ReadableStream,
  limitBytes = 2_000_000,
): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > limitBytes) {
      (stream as any).destroy?.();
      throw new NetworkPolicyError("Response exceeded the maximum allowed size.", "response_too_large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function safeJson(
  url: string,
  options: SafeRequestOptions & { limitBytes?: number } = {},
): Promise<{ status: number; data: any; text: string }> {
  const res = await safeRequest(url, options);
  const text = await readStream(res.stream, options.limitBytes ?? 2_000_000);
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { status: res.status, data, text };
}
