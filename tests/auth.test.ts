import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { authenticate, createUser, validatePasswordStrength } from "@/lib/auth";
import { hashPassword, verifyPassword, encryptSecret, decryptSecret, redactSecrets } from "@/lib/crypto";
import { createPasswordReset, consumePasswordReset } from "@/lib/auth/users";

beforeEach(() => {
  getDb().exec("DELETE FROM users");
});

describe("password hashing", () => {
  it("hashes with scrypt and verifies without storing plaintext", () => {
    const hash = hashPassword("correcthorse123");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("correcthorse123");
    expect(verifyPassword("correcthorse123", hash)).toBe(true);
    expect(verifyPassword("wrongpassword1", hash)).toBe(false);
  });

  it("enforces password strength", () => {
    expect(validatePasswordStrength("short1")).toMatch(/10 characters/);
    expect(validatePasswordStrength("alllettersonly")).toMatch(/letter and one number/);
    expect(validatePasswordStrength("longenough1")).toBeNull();
  });
});

describe("accounts", () => {
  it("creates and authenticates a user", () => {
    const user = createUser({ email: "Dev@Example.com", name: "Dev", password: "supersecret1" });
    expect(user.email).toBe("dev@example.com");
    expect(authenticate("dev@example.com", "supersecret1").id).toBe(user.id);
  });

  it("rejects duplicate emails and wrong passwords", () => {
    createUser({ email: "a@example.com", name: "A", password: "supersecret1" });
    expect(() => createUser({ email: "a@example.com", name: "B", password: "supersecret1" })).toThrow(/already exists/);
    expect(() => authenticate("a@example.com", "nottheright1")).toThrow(/Invalid/);
  });

  it("stores a single-use password reset that revokes old credentials", () => {
    const user = createUser({ email: "reset@example.com", name: "R", password: "supersecret1" });
    const token = createPasswordReset(user.id);
    consumePasswordReset(token, "brandnewpass1");
    expect(authenticate("reset@example.com", "brandnewpass1").id).toBe(user.id);
    expect(() => consumePasswordReset(token, "anotherpass1")).toThrow(/invalid or has expired/);
  });
});

describe("credential protection", () => {
  it("encrypts and decrypts with authenticated encryption", () => {
    const cipher = encryptSecret("sk-or-v1-secret-value");
    expect(cipher.startsWith("v1.")).toBe(true);
    expect(cipher).not.toContain("sk-or-v1-secret-value");
    expect(decryptSecret(cipher)).toBe("sk-or-v1-secret-value");
  });

  it("redacts common token formats", () => {
    const text = "key sk-or-v1-abcdefghijklmnopqrstuvwx and ghp_abcdefghijklmnopqrstuvwxyz123456";
    const redacted = redactSecrets(text);
    expect(redacted).not.toContain("sk-or-v1-abcdefghijklmnopqrstuvwx");
    expect(redacted).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz123456");
    expect(redacted).toContain("REDACTED");
  });
});
