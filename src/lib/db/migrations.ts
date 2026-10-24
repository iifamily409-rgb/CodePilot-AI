import type { Migration } from "./migrations/001-core.ts";
import { initMigration } from "./migrations/001-core.ts";
import { appMigration } from "./migrations/002-app.ts";

export type { Migration } from "./migrations/001-core.ts";

export const migrations: Migration[] = [initMigration, appMigration];
