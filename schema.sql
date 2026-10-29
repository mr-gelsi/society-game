-- Run once:  npx wrangler d1 execute society-game --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS societies (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  code           TEXT NOT NULL,
  recorder       TEXT,
  gov_type       TEXT,
  goal           TEXT,
  stage          TEXT NOT NULL DEFAULT 'locked',   -- locked | decisions | activity | finished
  current_event  INTEGER NOT NULL DEFAULT 1,
  population     INTEGER NOT NULL DEFAULT 100,
  food           INTEGER NOT NULL DEFAULT 100,
  infrastructure INTEGER NOT NULL DEFAULT 100,
  points         INTEGER NOT NULL DEFAULT 0,
  adjustment     INTEGER NOT NULL DEFAULT 0,       -- teacher bonus / penalty total
  buildings      TEXT NOT NULL DEFAULT '{}',
  supplies       TEXT NOT NULL DEFAULT '[]',
  flags          TEXT NOT NULL DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_societies_name ON societies (lower(name));

CREATE TABLE IF NOT EXISTS members (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  society_id      TEXT NOT NULL,
  name            TEXT NOT NULL,
  job             TEXT NOT NULL,
  profession_item TEXT NOT NULL,
  backpack        TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_members_society ON members (society_id);

CREATE TABLE IF NOT EXISTS submissions (
  society_id TEXT NOT NULL,
  event_no   INTEGER NOT NULL,
  step       TEXT NOT NULL,                        -- decisions | activity
  data       TEXT NOT NULL,
  result     TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (society_id, event_no, step)
);

-- One row per exploration code a society has used (each code works once per society).
CREATE TABLE IF NOT EXISTS explore_used (
  society_id TEXT NOT NULL,
  code       TEXT NOT NULL,
  event_no   INTEGER NOT NULL,
  PRIMARY KEY (society_id, code)
);

CREATE TABLE IF NOT EXISTS passcodes (
  event_no INTEGER PRIMARY KEY,
  code     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS adjustments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  society_id TEXT NOT NULL,
  points     INTEGER NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
