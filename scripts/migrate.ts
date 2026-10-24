import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { migrations } from "../src/lib/db/migrations.ts";

const dbPath =
  process.env.DATABASE_PATH && process.env.DATABASE_PATH !== ":memory:"
    ? path.resolve(process.env.DATABASE_PATH)
    : path.resolve(process.cwd(), "data", "codepilot.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`);

const applied = new Set(
  db.prepare("SELECT version FROM schema_migrations").all().map((r: any) => r.version),
);

for (const migration of migrations) {
  if (applied.has(migration.version)) {
    console.log(`skip  ${migration.version} ${migration.name}`);
    continue;
  }
  db.transaction(() => {
    db.exec(migration.sql);
    db.prepare(
      "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
    ).run(migration.version, migration.name, new Date().toISOString());
  })();
  console.log(`apply ${migration.version} ${migration.name}`);
}

console.log(`Database ready at ${dbPath}`);
db.close();
