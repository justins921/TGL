-- TGL Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database

-- ── Schedules table ──
create table if not exists schedules (
  id text primary key,
  name text not null,
  saved_at timestamptz not null default now(),
  data jsonb not null,
  stats jsonb not null
);

create index if not exists schedules_saved_at_idx on schedules (saved_at desc);

-- ── Row Level Security ──
-- Public users can read schedules (no login required)
-- Only authenticated users (admins) can insert, update, delete
alter table schedules enable row level security;

-- Anyone can read
create policy "Public read access" on schedules
  for select using (true);

-- Only authenticated users can insert
create policy "Authenticated insert" on schedules
  for insert with check (auth.role() = 'authenticated');

-- Only authenticated users can update
create policy "Authenticated update" on schedules
  for update using (auth.role() = 'authenticated');

-- Only authenticated users can delete
create policy "Authenticated delete" on schedules
  for delete using (auth.role() = 'authenticated');

-- ══════════════════════════════════════════════════
-- ADMIN SETUP
-- ══════════════════════════════════════════════════
-- After running this schema, create your admin user:
--
-- Option A: Supabase Dashboard
--   1. Go to Authentication > Users
--   2. Click "Add User"
--   3. Enter the admin's email and password
--
-- Option B: Use the Supabase client in your browser console:
--   const { data, error } = await supabase.auth.signUp({
--     email: 'admin@yourleague.com',
--     password: 'your-secure-password'
--   });
-- ══════════════════════════════════════════════════
