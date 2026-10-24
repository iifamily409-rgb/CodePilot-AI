import type { Migration } from "./001-core";

export const appMigration: Migration = {
  version: 2,
  name: "providers_projects_chats",
  sql: `
CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  base_url TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'bearer',
  api_key_enc TEXT,
  headers_enc TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  allow_private INTEGER NOT NULL DEFAULT 0,
  last_check_at TEXT,
  last_check_ok INTEGER,
  last_check_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_providers_user ON providers(user_id);

CREATE TABLE provider_models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  pricing_status TEXT NOT NULL,
  input_price_per_mtok REAL,
  output_price_per_mtok REAL,
  context_length INTEGER,
  capabilities_json TEXT,
  source TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  last_checked_at TEXT NOT NULL,
  UNIQUE(provider_id, model_id)
);
CREATE INDEX idx_provider_models_user ON provider_models(user_id);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'blank',
  description TEXT,
  repository_id TEXT REFERENCES repositories(id) ON DELETE SET NULL,
  default_branch TEXT,
  execution_method TEXT NOT NULL DEFAULT 'local_runner',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_projects_user ON projects(user_id);

CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  repository_id TEXT REFERENCES repositories(id) ON DELETE SET NULL,
  branch TEXT,
  title TEXT NOT NULL DEFAULT 'New chat',
  mode TEXT NOT NULL DEFAULT 'ask',
  model_ref TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_chats_user_time ON chats(user_id, updated_at DESC);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model_ref TEXT,
  citations_json TEXT,
  events_json TEXT,
  status TEXT NOT NULL DEFAULT 'complete',
  error TEXT,
  seq INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_messages_chat ON messages(chat_id, seq);

CREATE TABLE research_queries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT,
  query TEXT NOT NULL,
  provider TEXT NOT NULL,
  results_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_research_user_time ON research_queries(user_id, created_at DESC);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  chat_id TEXT REFERENCES chats(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'agent',
  status TEXT NOT NULL DEFAULT 'queued',
  model_ref TEXT,
  plan_json TEXT,
  logs_json TEXT,
  result TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_tasks_user_time ON tasks(user_id, created_at DESC);

CREATE TABLE executions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  exit_code INTEGER,
  output TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX idx_exec_project ON executions(project_id, created_at DESC);

CREATE TABLE changes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  diff TEXT NOT NULL,
  test_output TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  branch TEXT,
  commit_message TEXT,
  pr_url TEXT,
  files_json TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  published_at TEXT
);
CREATE INDEX idx_changes_project ON changes(project_id, created_at DESC);

CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
`,
};
