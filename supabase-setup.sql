-- ============================================================
-- AIMBENCH schema
-- Custom auth (username + bcrypt password + JWT cookie session),
-- NOT Supabase Auth. All writes go through the server using the
-- service-role key, so RLS below is a backstop, not the main gate.
-- ============================================================

create table if not exists public.accounts (
  id uuid default gen_random_uuid() primary key,
  username text not null unique,
  password_hash text,
  discord_id text unique,
  role text not null default 'user',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists accounts_discord_idx on public.accounts (discord_id);

create table if not exists public.profiles (
  id uuid references public.accounts(id) on delete cascade primary key,
  display_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.benchmarks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.accounts(id) on delete cascade not null,
  title text not null,
  description text,
  platform text not null default 'kovaiacks',
  difficulty text not null default 'medium',
  rank_names text[] default '{"Bronze","Silver","Gold","Platinum","Diamond","Champion","Radiant","Immortal"}',
  rank_colors text[] default '{"#b87333","#c0c0c0","#ffd700","#e5e4e2","#b9f2fe","#ffd700","#ff0000","#9f9f9f"}',
  rank_thresholds jsonb default '{"Bronze":0,"Silver":1000,"Gold":2500,"Platinum":5000,"Diamond":10000,"Champion":15000,"Radiant":20000,"Immortal":30000}'::jsonb,
  scenario_count integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- One row per submission, not per user, so score/rank history over
-- time is possible. "Best score per user per benchmark" is a query
-- (see the leaderboard route), not a table constraint.
create table if not exists public.benchmark_scores (
  id uuid default gen_random_uuid() primary key,
  benchmark_id uuid references public.benchmarks(id) on delete cascade not null,
  user_id uuid references public.accounts(id) on delete cascade not null,
  score integer not null,
  rank text,
  completed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists benchmark_scores_benchmark_idx on public.benchmark_scores (benchmark_id);
create index if not exists benchmark_scores_user_idx on public.benchmark_scores (user_id);

create table if not exists public.benchmark_edits (
  id uuid default gen_random_uuid() primary key,
  benchmark_id uuid references public.benchmarks(id) on delete cascade not null,
  user_id uuid references public.accounts(id) on delete cascade not null,
  changed_field text not null,
  old_value text,
  new_value text not null,
  changed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================
-- RLS: locked down for the anon/publishable key. All app writes
-- go through the server with the service-role key (supabaseAdmin),
-- which bypasses RLS, so these policies mainly stop someone from
-- hitting the anon key directly from the browser and reading/writing
-- things they shouldn't.
-- ============================================================

alter table public.accounts enable row level security;
alter table public.profiles enable row level security;
alter table public.benchmarks enable row level security;
alter table public.benchmark_scores enable row level security;
alter table public.benchmark_edits enable row level security;

-- accounts: never exposed to the anon key. No policies = no access
-- (password_hash lives here; only supabaseAdmin should ever touch it).

-- profiles: public read (usernames/display names for leaderboards),
-- no anon writes.
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

-- benchmarks: public read, no anon writes.
drop policy if exists "Benchmarks are viewable by everyone" on public.benchmarks;
create policy "Benchmarks are viewable by everyone"
  on public.benchmarks for select using (true);

-- benchmark_scores: public read, no anon writes.
drop policy if exists "Scores are viewable by everyone" on public.benchmark_scores;
create policy "Scores are viewable by everyone"
  on public.benchmark_scores for select using (true);

-- benchmark_edits: not exposed to anon at all (no select policy).

-- ============================================================
-- EasyAim integration
-- Run this section too if the schema above already exists.
-- ============================================================

-- One row per EasyAim scenario attached to a benchmark. The benchmark
-- creator sets the score cutoffs per rank for each scenario.
create table if not exists public.benchmark_scenarios (
  id uuid default gen_random_uuid() primary key,
  benchmark_id uuid references public.benchmarks(id) on delete cascade not null,
  easyaim_scenario_id text not null,
  title text not null,
  position integer not null default 0,
  cutoffs jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (benchmark_id, easyaim_scenario_id)
);

create index if not exists benchmark_scenarios_benchmark_idx on public.benchmark_scenarios (benchmark_id);
create index if not exists benchmark_scenarios_scenario_idx on public.benchmark_scenarios (easyaim_scenario_id);

-- Links one AIMBENCH account to one EasyAim player, plus sync bookkeeping.
create table if not exists public.easyaim_links (
  account_id uuid references public.accounts(id) on delete cascade primary key,
  easyaim_player_id text not null unique,
  easyaim_username text not null,
  display_name text,
  avatar_url text,
  last_run_id bigint,
  backfill_cursor text,
  backfill_done boolean not null default false,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Best known PB per player per EasyAim scenario. Only scenarios that
-- are attached to at least one benchmark are stored here.
create table if not exists public.easyaim_pbs (
  account_id uuid references public.accounts(id) on delete cascade not null,
  scenario_id text not null,
  score integer not null,
  run_id bigint not null,
  achieved_at timestamp with time zone not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (account_id, scenario_id)
);

-- Leaderboards for scenario benchmarks sort by rank first: rank_index
-- is the position of the achieved rank in benchmarks.rank_names.
alter table public.benchmark_scores add column if not exists rank_index integer;

alter table public.benchmark_scenarios enable row level security;
alter table public.easyaim_links enable row level security;
alter table public.easyaim_pbs enable row level security;

drop policy if exists "Benchmark scenarios are viewable by everyone" on public.benchmark_scenarios;
create policy "Benchmark scenarios are viewable by everyone"
  on public.benchmark_scenarios for select using (true);

-- easyaim_links and easyaim_pbs: no policies = server-only (service role).
