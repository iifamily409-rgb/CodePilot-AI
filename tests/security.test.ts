import { describe, expect, it } from "vitest";
import { assertUrlAllowed, isBlockedAddress, providerUrlPolicy } from "@/lib/security/url-policy";
import { parseCommand, CommandRejected } from "@/lib/execution/runner";
import { sanitizeBranchName } from "@/lib/git";
import { toolAllowed } from "@/lib/ai/modes";
import { rateLimit } from "@/lib/security/rate-limit";
import { classifyOpenRouter } from "@/lib/ai/discovery";

describe("SSRF protection", () => {
  it("blocks private, loopback, link-local and metadata addresses", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "192.168.1.1", "172.16.0.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1"]) {
      expect(isBlockedAddress(address)).toBe(true);
    }
    expect(isBlockedAddress("93.184.216.34")).toBe(false);
  });

  it("rejects non-http schemes, embedded credentials and plain HTTP to public hosts", async () => {
    await expect(assertUrlAllowed("file:///etc/passwd")).rejects.toThrow(/http/);
    await expect(assertUrlAllowed("https://user:pass@example.com/")).rejects.toThrow(/credentials/);
    await expect(assertUrlAllowed("http://example.com/api")).rejects.toThrow(/Plain HTTP/);
  });

  it("allows loopback providers only when explicitly allowlisted", async () => {
    const policy = providerUrlPolicy();
    const result = await assertUrlAllowed("http://localhost:11434", policy);
    expect(result.isLocal).toBe(true);
    await expect(assertUrlAllowed("http://169.254.169.254/latest/meta-data", policy)).rejects.toThrow();
  });
});

describe("execution allowlist", () => {
  it("accepts supported development commands", () => {
    expect(parseCommand("npm test").label).toBe("npm test");
    expect(parseCommand("npm run build").label).toBe("npm run build");
    expect(parseCommand("npx tsc --noEmit").label).toContain("tsc");
    expect(parseCommand("node --test").label).toBe("node --test");
    expect(parseCommand("python3 -m unittest").bin).toBe("python3");
  });

  it("rejects shell metacharacters, unknown binaries and dangerous npm scripts", () => {
    expect(() => parseCommand("npm test && rm -rf /")).toThrow(CommandRejected);
    expect(() => parseCommand("cat /etc/passwd")).toThrow(/not an allowed executable/);
    expect(() => parseCommand("npm run postinstall")).toThrow(/Only/);
    expect(() => parseCommand("curl https://example.com")).toThrow(/not an allowed executable/);
    expect(() => parseCommand("node server.ts")).toThrow(/Allowed node/);
    expect(() => parseCommand("bash -c id")).toThrow(/not an allowed executable/);
  });
});

describe("git publishing guards", () => {
  it("sanitises branch names and rejects unsafe values", () => {
    expect(sanitizeBranchName("codepilot/fix-bug")).toBe("codepilot/fix-bug");
    expect(sanitizeBranchName("feature add stuff")).toBe("feature-add-stuff");
    expect(() => sanitizeBranchName("../evil")).toThrow();
    expect(() => sanitizeBranchName("HEAD")).toThrow();
  });
});

describe("agent modes", () => {
  it("does not expose write or command tools in Ask mode", () => {
    expect(toolAllowed("read_file", "ask")).toBe(true);
    expect(toolAllowed("web_search", "ask")).toBe(true);
    expect(toolAllowed("write_file", "ask")).toBe(false);
    expect(toolAllowed("run_command", "ask")).toBe(false);
    expect(toolAllowed("write_file", "code")).toBe(true);
    expect(toolAllowed("delete_file", "code")).toBe(false);
    expect(toolAllowed("delete_file", "agent")).toBe(true);
  });
});

describe("rate limiting", () => {
  it("blocks after the configured number of requests in a window", () => {
    const key = `test-${Date.now()}`;
    expect(rateLimit(key, 2, 60).ok).toBe(true);
    expect(rateLimit(key, 2, 60).ok).toBe(true);
    const third = rateLimit(key, 2, 60);
    expect(third.ok).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
  });
});

describe("model classification", () => {
  const base = (pricing: any, params: string[] = []) => ({
    id: "x/model",
    name: "X Model",
    description: "A coding model",
    context_length: 200000,
    pricing,
    supported_parameters: params,
    architecture: { input_modalities: ["text", "image"] },
  });

  it("marks zero-price models verified free", () => {
    const model = classifyOpenRouter(base({ prompt: "0", completion: "0" }, ["tools", "reasoning"]));
    expect(model.pricing_status).toBe("verified_free");
    expect(model.capabilities.tools).toBe(true);
    expect(model.capabilities.reasoning).toBe(true);
    expect(model.capabilities.vision).toBe(true);
    expect(model.capabilities.long_context).toBe(true);
    expect(model.input_price_per_mtok).toBe(0);
  });

  it("marks non-zero or missing pricing as paid or unverified", () => {
    expect(classifyOpenRouter(base({ prompt: "0.000001", completion: "0.000002" })).pricing_status).toBe("paid");
    expect(classifyOpenRouter(base({})).pricing_status).toBe("unverified");
  });
});
