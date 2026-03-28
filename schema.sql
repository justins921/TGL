-- TGL Database Schema
-- Run this in your Neon SQL Editor to set up the database

-- ── Schedules table ──
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL,
  stats JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS schedules_saved_at_idx ON schedules (saved_at DESC);

-- ── Players table ──
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  handicap NUMERIC NOT NULL DEFAULT 0 CHECK (handicap >= 0 AND handicap <= 10),
  previous_season_avg NUMERIC,
  is_sub BOOLEAN NOT NULL DEFAULT FALSE,
  weekly_results JSONB NOT NULL DEFAULT '[]'::JSONB
);

CREATE INDEX IF NOT EXISTS players_name_idx ON players (name);
