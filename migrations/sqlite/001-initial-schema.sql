-- migrations/sqlite/001-initial-schema.sql
-- Phase-2 reference migration. Sovereign cubes do not currently share
-- a database; this file exists to exercise scripts/migrate.mjs in CI.
-- Downstream products that adopt the schema versioner can copy this
-- file as their starting point.

CREATE TABLE IF NOT EXISTS phase2_release (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag TEXT NOT NULL UNIQUE,
  sha TEXT NOT NULL,
  released_at TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS phase2_feature_flag_eval (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flag TEXT NOT NULL,
  env TEXT NOT NULL,
  value INTEGER NOT NULL,
  evaluated_at TEXT NOT NULL
);