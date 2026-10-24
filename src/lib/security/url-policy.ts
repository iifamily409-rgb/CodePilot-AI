import "server-only";
import dns from "node:dns/promises";
import net from "node:net";
import { providerEnv } from "../env";

export class NetworkPolicyError extends Error {
  status = 400;
  code: string;
  constructor(message: string, code = "network_policy") {
    super(message);
    this.code = code;
  }
}

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "::1", "host.docker.internal"];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inCidr(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

/** Loopback, private, link-local, CGNAT, multicast, reserved and metadata ranges. */
export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return BLOCKED_V4.some(([base, bits]) => inCidr(address, base, bits));
  if (family === 6) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) return isBlockedAddress(lower.slice(7));
    return false;
  }
  return true;
}

export type UrlPolicy = {
  /** undefined = trust any host (dangerous, explicit opt-in only). */
  allowPrivateHosts?: string[];
  allowHttp?: boolean;
};

export const DEFAULT_LOCAL_HOSTS = LOCAL_HOSTNAMES;

/**
 * Local runtimes (Ollama, OpenCode server) are loopback/host-network services.
 * Custom third-party endpoints stay on the public-internet-only path unless an
 * operator explicitly opts in with ALLOW_PRIVATE_CUSTOM_ENDPOINTS=1.
 */
export function providerUrlPolicy(): UrlPolicy {
  const env = providerEnv();
  return {
    allowPrivateHosts: env.allowPrivateCustomEndpoints
      ? undefined
      : [...LOCAL_HOSTNAMES, ...env.allowedPrivateHosts],
    allowHttp: true,
  };
}

export async function assertUrlAllowed(
  rawUrl: string,
  policy: UrlPolicy = { allowPrivateHosts: [] },
): Promise<{ url: URL; addresses: string[]; isLocal: boolean }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new NetworkPolicyError("The provided URL is not valid.", "invalid_url");
  }
  if (url.username || url.password) {
    throw new NetworkPolicyError("URLs must not embed credentials.", "invalid_url");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new NetworkPolicyError("Only http(s) endpoints are supported.", "invalid_url");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const trustAll = policy.allowPrivateHosts === undefined;
  const isLocal =
    trustAll || (policy.allowPrivateHosts ?? []).some((host) => host === hostname);

  if (url.protocol === "http:" && !(isLocal && policy.allowHttp !== false)) {
    throw new NetworkPolicyError(
      "Plain HTTP is only allowed for explicitly configured local runtimes. Use HTTPS.",
      "insecure_transport",
    );
  }

  if (isLocal && !trustAll) {
    if (LOCAL_HOSTNAMES.includes(hostname)) {
      return { url, addresses: [hostname], isLocal: true };
    }
    if (net.isIP(hostname) && !isBlockedAddress(hostname)) {
      throw new NetworkPolicyError(
        "Allowlisted private providers must use a loopback or private host name, not that address.",
      );
    }
    return { url, addresses: [hostname], isLocal: true };
  }

  const addresses: string[] = [];
  if (net.isIP(hostname)) {
    addresses.push(hostname);
  } else {
    try {
      const records = await dns.lookup(hostname, { all: true, verbatim: true });
      addresses.push(...records.map((r) => r.address));
    } catch {
      throw new NetworkPolicyError(`Could not resolve host "${hostname}".`, "dns_failure");
    }
  }
  if (addresses.length === 0) {
    throw new NetworkPolicyError(`Could not resolve host "${hostname}".`, "dns_failure");
  }
  for (const address of addresses) {
    if (isBlockedAddress(address)) {
      throw new NetworkPolicyError(
        `Requests to private or reserved addresses (${address}) are blocked.`,
        "private_address",
      );
    }
  }
  return { url, addresses, isLocal: false };
}
