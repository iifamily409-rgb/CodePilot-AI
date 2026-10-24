import "server-only";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../env";
import { migrations } from "./migrations";

export type DB = Database.Database;

declare global {
  var __codepilotDb: DB | undefined;
}

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH;
  if (configured === ":memory:") return ":memory:";
  if (configured && configured.trim().length > 0) {
    const resolved = path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    return resolved;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return path.join(DATA_DIR, "codepilot.db");
}

export function getDb(): DB {
  if (global.__codepilotDb) return global.__codepilotDb;
  const db = new Database(resolveDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  runMigrations(db);
  global.__codepilotDb = db;
  return db;
}

export function runMigrations(db: DB): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set(
    db.prepare("SELECT version FROM schema_migrations").all().map((r: any) => r.version),
  );
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    const tx = db.transaction(() => {
      db.exec(migration.sql);
      db.prepare(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
      ).run(migration.version, migration.name, new Date().toISOString());
    });
    tx();
  }
}

/** Convenience helpers used by the API layer. */
export function one<T = any>(sql: string, ...params: any[]): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

export function all<T = any>(sql: string, ...params: any[]): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function run(sql: string, ...params: any[]): Database.RunResult {
  return getDb().prepare(sql).run(...params);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix = ""): string {
  const { randomUUID } = crypto;
  const id = randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

/** Used by tests to get a clean database. */
export function resetDbForTests(): void {
  if (global.__codepilotDb) {
    global.__codepilotDb.close();
    global.__codepilotDb = undefined;
  }
}
