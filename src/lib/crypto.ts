import "server-only";
import crypto from "node:crypto";
import { appSecret } from "./env";

const SCRYPT_N = 16384;
const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: 8,
    p: 1,
  });
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, nStr, saltHex, keyHex] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(keyHex, "hex");
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: Number(nStr),
      r: 8,
      p: 1,
    });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function encryptionKey(): Buffer {
  // The derivation context is intentionally stable across the X-Flex rename so
  // provider keys and GitHub tokens encrypted by earlier builds stay readable.
  return crypto.scryptSync(appSecret(), "codepilot-credential-encryption-v1", 32);
}

/** AES-256-GCM encryption for provider keys and GitHub tokens at rest. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, ctB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !ctB64) {
    throw new Error("Unsupported secret payload");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const out = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]);
  return out.toString("utf8");
}

export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 3)}••••${value.slice(-4)}`;
}

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-or-v1-[A-Za-z0-9_-]{16,}/g, "sk-or-v1-***REDACTED***"],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/g, "sk-***REDACTED***"],
  [/\bghp_[A-Za-z0-9]{20,}\b/g, "ghp_***REDACTED***"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "github_pat_***REDACTED***"],
  [/\bghs_[A-Za-z0-9]{20,}\b/g, "ghs_***REDACTED***"],
  [/(Bearer\s+)[A-Za-z0-9._~+/-]{12,}=*/gi, "$1***REDACTED***"],
  [/((?:api[_-]?key|token|secret|password)["'\s:=]+)[A-Za-z0-9._~+/-]{12,}/gi, "$1***REDACTED***"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "***REDACTED PRIVATE KEY***"],
];

/** Redact anything that looks like a credential before returning or logging. */
export function redactSecrets(input: string): string {
  let out = input;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
