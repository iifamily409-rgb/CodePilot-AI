import "server-only";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { executionEnv } from "../env";
import { getDb, newId, nowIso } from "../db";
import { workspaceRoot } from "../workspace/fs";

const SHELL_META = /[|&;<>()$`\\\n\r]/;
const ALLOWED_BINARIES = new Set(["npm", "npx", "node", "python3", "python", "pytest"]);
const NPM_SCRIPTS = new Set([
  "test",
  "build",
  "lint",
  "typecheck",
  "format",
  "start",
  "dev",
  "check",
  "test:unit",
  "test:e2e",
]);

export type CommandSpec = { bin: string; args: string[]; label: string };

export class CommandRejected extends Error {
  status = 400;
}

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (const char of command.trim()) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  if (quote) throw new CommandRejected("Unbalanced quotes in command.");
  return tokens;
}

/** Strict command allowlist. No shell, no pipes, no redirection. */
export function parseCommand(command: string): CommandSpec {
  if (!command || command.length > 200) throw new CommandRejected("Command must be 1-200 characters.");
  if (SHELL_META.test(command)) {
    throw new CommandRejected("Shell operators, pipes, redirection and variable expansion are not allowed.");
  }
  const tokens = tokenize(command);
  if (!tokens.length) throw new CommandRejected("Command is empty.");
  const [bin, ...args] = tokens;
  if (!ALLOWED_BINARIES.has(bin)) {
    throw new CommandRejected(
      `"${bin}" is not an allowed executable. Allowed: ${[...ALLOWED_BINARIES].join(", ")}.`,
    );
  }
  if (bin === "npm") {
    if (args[0] === "test" && args.length === 1) return { bin, args, label: "npm test" };
    if (args[0] === "run" && args[1] && NPM_SCRIPTS.has(args[1])) {
      return { bin, args: ["run", args[1]], label: `npm run ${args[1]}` };
    }
    throw new CommandRejected(
      `Only \`npm test\` or \`npm run <${[...NPM_SCRIPTS].join("|")}>\` are allowed.`,
    );
  }
  if (bin === "npx") {
    if (args[0] === "tsc" && args.includes("--noEmit")) return { bin, args: ["tsc", "--noEmit"], label: "npx tsc --noEmit" };
    throw new CommandRejected("Only `npx tsc --noEmit` is allowed.");
  }
  if (bin === "node") {
    if (args[0] === "--test") return { bin, args: ["--test"], label: "node --test" };
    if (args[0] === "--version") return { bin, args, label: "node --version" };
    if (args[0] && /\.(m?js|cjs)$/.test(args[0])) return { bin, args: [args[0]], label: `node ${args[0]}` };
    throw new CommandRejected("Allowed node commands: `node --test`, `node --version`, `node <file.js>`.");
  }
  if (bin === "python" || bin === "python3" || bin === "pytest") {
    if (args[0] === "-m" && (args[1] === "unittest" || args[1] === "pytest")) {
      return { bin, args, label: `${bin} -m ${args[1]}` };
    }
    if (args[0] === "--version") return { bin, args, label: `${bin} --version` };
    if (bin !== "pytest" && args[0] && /\.py$/.test(args[0])) return { bin, args: [args[0]], label: `${bin} ${args[0]}` };
    if (bin === "pytest" && args.length === 0) return { bin, args: [], label: "pytest" };
    throw new CommandRejected("Allowed Python commands: `python3 -m unittest`, `python3 -m pytest`, `python3 <file.py>`, `pytest`.");
  }
  throw new CommandRejected("Unsupported command.");
}

let networkIsolation: boolean | null = null;
function hasUnshare(): boolean {
  if (networkIsolation !== null) return networkIsolation;
  try {
    execFileSync("unshare", ["-n", "--", "true"], { stdio: "ignore", timeout: 3000 });
    networkIsolation = true;
  } catch {
    networkIsolation = false;
  }
  return networkIsolation;
}

function safeEnv(workspace: string): Record<string, string> {
  const blocked = /^(APP_SECRET|DATABASE_PATH|GITHUB_|SEARXNG_|BRAVE_|TAVILY_|OPENCODE_|NODE_OPTIONS|AWS_|AZURE_|GOOGLE_)/i;
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (blocked.test(key)) continue;
    if (/KEY|SECRET|TOKEN|PASSWORD/i.test(key)) continue;
    if (value !== undefined) env[key] = value;
  }
  env.HOME = workspace;
  env.TMPDIR = path.join(workspace, ".tmp");
  env.NODE_ENV = "test";
  env.PYTHONDONTWRITEBYTECODE = "1";
  env.CI = "1";
  return env;
}

export type ExecutionResult = {
  command: string;
  status: "passed" | "failed" | "timeout" | "rejected";
  exitCode: number | null;
  output: string;
  durationMs: number;
  networkIsolated: boolean;
  limits: { timeoutMs: number; maxOutputBytes: number };
};

export async function runCommand(
  userId: string,
  projectId: string,
  command: string,
): Promise<ExecutionResult> {
  const config = executionEnv();
  const limits = { timeoutMs: config.timeoutMs, maxOutputBytes: config.maxOutputBytes };
  if (!config.enabled) {
    throw Object.assign(
      new Error(
        "Code execution is disabled on this server. Set EXECUTION_ENABLED=1 to enable the local runner (run CodePilot AI in a container or dedicated host).",
      ),
      { status: 403 },
    );
  }
  const spec = parseCommand(command);
  const workspace = workspaceRoot(userId, projectId);
  await fs.mkdir(path.join(workspace, ".tmp"), { recursive: true });
  const isolated = !config.allowNetwork && hasUnshare();
  const bin = isolated ? "unshare" : spec.bin;
  const args = isolated ? ["-n", "--", spec.bin, ...spec.args] : spec.args;
  const id = newId("exe");
  getDb()
    .prepare(
      "INSERT INTO executions (id, project_id, user_id, command, status, created_at) VALUES (?, ?, ?, ?, 'running', ?)",
    )
    .run(id, projectId, userId, spec.label, nowIso());
  const started = Date.now();
  const result = await new Promise<ExecutionResult>((resolve) => {
    let output = "";
    let truncated = false;
    let settled = false;
    const child = spawn(bin, args, {
      cwd: workspace,
      env: safeEnv(workspace) as NodeJS.ProcessEnv,
      shell: false,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    }) as import("node:child_process").ChildProcess;
    const finish = (status: ExecutionResult["status"], exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        command: spec.label,
        status,
        exitCode,
        output: truncated ? `${output}\n[output truncated at ${limits.maxOutputBytes} bytes]` : output,
        durationMs: Date.now() - started,
        networkIsolated: isolated,
        limits,
      });
    };
    const append = (chunk: Buffer) => {
      if (output.length >= limits.maxOutputBytes) {
        truncated = true;
        killGroup(child.pid);
        return;
      }
      output += chunk.toString("utf8");
    };
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    const timer = setTimeout(() => {
      killGroup(child.pid);
      finish("timeout", null);
    }, limits.timeoutMs);
    child.on("error", (error) => {
      output += `\nFailed to start command: ${error.message}`;
      finish("failed", null);
    });
    child.on("close", (code) => finish(code === 0 ? "passed" : "failed", code));
  });
  getDb()
    .prepare(
      "UPDATE executions SET status = ?, exit_code = ?, output = ?, duration_ms = ?, finished_at = ? WHERE id = ?",
    )
    .run(result.status, result.exitCode, result.output.slice(0, 200_000), result.durationMs, nowIso(), id);
  return result;
}

function killGroup(pid: number | undefined) {
  if (!pid) return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
}

export function executionCapabilities(): {
  enabled: boolean;
  networkIsolation: "unshare" | "none";
  allowNetwork: boolean;
  timeoutMs: number;
  commands: string[];
} {
  const config = executionEnv();
  return {
    enabled: config.enabled,
    networkIsolation: hasUnshare() ? "unshare" : "none",
    allowNetwork: config.allowNetwork,
    timeoutMs: config.timeoutMs,
    commands: [
      "npm test",
      "npm run build|lint|typecheck|format",
      "npx tsc --noEmit",
      "node --test",
      "node <file.js>",
      "python3 -m unittest",
      "python3 -m pytest",
      "python3 <file.py>",
      "pytest",
    ],
  };
}
