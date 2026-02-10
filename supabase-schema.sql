-- TGL Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Schedules table: stores saved schedules
create table if not exists schedules (
  id text primary key,
  name text not null,
  saved_at timestamptz not null default now(),
  data jsonb not null,
  stats jsonb not null
);

-- Index for ordering by save date
create index if not exists schedules_saved_at_idx on schedules (saved_at desc);

-- Enable Row Level Security (RLS)
-- For now, allow all operations (no auth required).
-- When you add authentication later, update these policies.
alter table schedules enable row level security;

create policy "Allow all reads" on schedules
  for select using (true);

create policy "Allow all inserts" on schedules
  for insert with check (true);

create policy "Allow all deletes" on schedules
  for delete using (true);
