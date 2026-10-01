-- ============================================================
-- AIMBENCH final schema (updated for alphanumeric/text IDs,
-- Discord login, EasyAim sync, benchmark edit, delete)
--
-- MIGRATION NOTE: this file only creates tables that don't exist yet
-- (create table if not exists). It will NOT add the category columns
-- to a database that was created before them. If you're updating an
-- existing database, run the ALTER TABLE block at the bottom of this
-- file instead of re-running the whole thing.
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
  platform text not null default 'easyaim',
  difficulty text not null default 'medium',
  rank_names text[] default '{"Bronze","Silver","Gold","Platinum","Diamond","Champion","Radiant","Immortal"}',
  rank_colors text[] default '{"#b87333","#c0c0c0","#ffd700","#e5e4e2","#b9f2fe","#ffd700","#ff0000","#9f9f9f"}',
  rank_thresholds jsonb default '{"Bronze":0,"Silver":1000,"Gold":2500,"Platinum":5000,"Diamond":10000,"Champion":15000,"Radiant":20000,"Immortal":30000}'::jsonb,
  -- Category definitions for the benchmark table's vertical rails:
  -- [{ "name": "Clicking", "color": "#ff6b35", "subCategories": ["Static"] }]
  category_defs jsonb not null default '[]'::jsonb,
  scenario_count integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.benchmark_scores (
  id uuid default gen_random_uuid() primary key,
  benchmark_id uuid references public.benchmarks(id) on delete cascade not null,
  user_id uuid references public.accounts(id) on delete cascade not null,
  score integer not null,
  rank text,
  rank_index integer,
  completed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists benchmark_scores_benchmark_idx on public.benchmark_scores (benchmark_id);
create index if not exists benchmark_scores_user_idx on public.benchmark_scores (user_id);

-- benchmark_edits used to live here to record who changed what on a
-- benchmark. Nothing ever wrote to it and nothing ever read it, so it was a
-- table that looked like an audit trail and was not one. Dropped rather than
-- left in place: an empty table named "edits" invites someone to believe the
-- app has an edit history. If a database already has it, `drop table if exists
-- public.benchmark_edits;` in the block at the bottom clears it.

-- ============================================================
-- RLS policies
-- ============================================================

alter table public.accounts enable row level security;
alter table public.profiles enable row level security;
alter table public.benchmarks enable row level security;
alter table public.benchmark_scores enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "Benchmarks are viewable by everyone" on public.benchmarks;
create policy "Benchmarks are viewable by everyone"
  on public.benchmarks for select using (true);

drop policy if exists "Scores are viewable by everyone" on public.benchmark_scores;
create policy "Scores are viewable by everyone"
  on public.benchmark_scores for select using (true);

-- ============================================================
-- EasyAim integration
-- ============================================================

create table if not exists public.benchmark_scenarios (
  id uuid default gen_random_uuid() primary key,
  benchmark_id uuid references public.benchmarks(id) on delete cascade not null,
  easyaim_scenario_id bigint not null,
  title text not null,
  position integer not null default 0,
  category text not null default 'Other',
  sub_category text,
  cutoffs jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (benchmark_id, easyaim_scenario_id)
);

create index if not exists benchmark_scenarios_benchmark_idx on public.benchmark_scenarios (benchmark_id);
create index if not exists benchmark_scenarios_scenario_idx on public.benchmark_scenarios (easyaim_scenario_id);

create table if not exists public.easyaim_links (
  account_id uuid references public.accounts(id) on delete cascade primary key,
  easyaim_player_id bigint not null unique,
  easyaim_username text not null,
  display_name text,
  avatar_url text,
  last_run_id bigint,
  backfill_cursor text,
  backfill_done boolean not null default false,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.easyaim_pbs (
  account_id uuid references public.accounts(id) on delete cascade not null,
  scenario_id bigint not null,
  score integer not null,
  run_id bigint not null,
  achieved_at timestamp with time zone not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (account_id, scenario_id)
);

alter table public.benchmark_scores add column if not exists rank_index integer;

-- ============================================================
-- Category columns
-- Added after the initial schema shipped. Safe to run against an
-- existing database: both statements are no-ops if the columns are
-- already there, and neither drops or rewrites existing data.
--
-- benchmarks.category_defs holds the category list the benchmark
-- detail table groups by and colours its vertical rails from.
-- benchmark_scenarios.sub_category holds the per-scenario grouping
-- key within its category; null means "no sub-category".
-- ============================================================
alter table public.benchmarks
  add column if not exists category_defs jsonb not null default '[]'::jsonb;

alter table public.benchmark_scenarios
  add column if not exists sub_category text;

alter table public.benchmark_scenarios enable row level security;
alter table public.easyaim_links enable row level security;
alter table public.easyaim_pbs enable row level security;

drop policy if exists "Benchmark scenarios are viewable by everyone" on public.benchmark_scenarios;
create policy "Benchmark scenarios are viewable by everyone"
  on public.benchmark_scenarios for select using (true);

-- ------------------------------------------------------------
-- Benchmark pins
-- A star on a benchmark card. Per-account, so two people starring the
-- same benchmark both count and neither can inflate the total. The
-- primary key is what stops one person producing two.
-- ------------------------------------------------------------
create table if not exists public.benchmark_pins (
  benchmark_id uuid references public.benchmarks(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (benchmark_id, account_id)
);

create index if not exists benchmark_pins_account_idx
  on public.benchmark_pins (account_id);

create index if not exists benchmark_pins_benchmark_idx
  on public.benchmark_pins (benchmark_id);

alter table public.benchmark_pins enable row level security;

-- benchmark_pins: no policies = server-only (service role).

-- Pin totals per benchmark. Aggregating in SQL rather than counting rows
-- in the app means the cost of showing a star count does not grow with
-- the size of the community.
--
-- security_invoker matters: a view is SECURITY DEFINER by default and so
-- ignores the RLS policies on the table underneath, which would let the
-- anon key read every pin row through it. With security_invoker the
-- service-role client still reads everything and anon reads nothing.
create or replace view public.benchmark_pin_totals
  with (security_invoker = on) as
  select
    benchmark_id,
    count(*)::int as pin_count
  from public.benchmark_pins
  group by benchmark_id;

-- ============================================================
-- Column types
-- Three mismatches between the schema and what the app actually stores.
-- The ALTERs are idempotent and rewrite no data, so this block is safe to
-- run against an existing database as many times as you like.
-- ============================================================

-- 1. Scores are not integers.
--
-- EasyAim scores are fractional (a real one from the test suite is
-- 1,012.667) and the app stores them faithfully: computeAggregates sums them
-- as JS numbers and the leaderboard prints them with toLocaleString. Storing
-- them in an `integer` column made Postgres round on insert, so 1,012.667
-- became 1013 and a benchmark's total drifted by a little on every re-sync.
-- Nothing noticed, because the tests exercise the pure function and never
-- touch the column.
--
-- double precision rather than numeric. These are game scores, not money, so
-- exact decimal arithmetic buys nothing — and PostgREST does not agree on how
-- to serialise `numeric`: some versions hand it back as a JSON *string* to
-- preserve precision, which would arrive in JavaScript as "1012.667" and turn
-- every `score >= cutoff` comparison into a string comparison. `float8`
-- always serialises as a JSON number. Verified with:
--   select pg_typeof(score) from easyaim_pbs limit 1;   -- double precision
alter table public.easyaim_pbs
  alter column score type double precision using score::double precision;

alter table public.benchmark_scores
  alter column score type double precision using score::double precision;

-- 2. Scenario ids are not always numeric.
--
-- EasyAim has moved ids to alphanumeric strings (692fc9afe296376b3bdceed2
-- and so on). The code has handled that for a while — the API client tries
-- both the numeric and the by-id endpoints, and sanitizeScenarios accepts
-- either shape — but the columns were still bigint, so an alphanumeric id
-- could not be stored even when the client fetched it successfully.
alter table public.benchmark_scenarios
  alter column easyaim_scenario_id type text using easyaim_scenario_id::text;

alter table public.easyaim_pbs
  alter column scenario_id type text using scenario_id::text;

-- 3. Neither is a player id.
--
-- Same story, and this one also carries a unique constraint: two accounts
-- cannot claim the same EasyAim player, which is what stops somebody squatting
-- on an identity that is already linked. That still holds in text.
alter table public.easyaim_links
  alter column easyaim_player_id type text using easyaim_player_id::text;

-- The dead table, if a previous version of this schema created it. Harmless
-- if it was never there.
drop table if exists public.benchmark_edits;

-- ============================================================
-- Tiers — a benchmark's difficulty variants
-- ============================================================
-- A benchmark can have up to six named tiers, each with its own rank ladder
-- and its own cutoffs. "Novice" might ladder Iron → Bronze → Silver → Gold
-- while "Elite" ladders Nova → Astra → Celestial → Stellaris, off the same
-- scenarios. /benchmarks/[id]/[tier] renders one of them and the switcher in
-- the header moves between them.
--
-- The scenario list stays shared: a tier is a different way to score the same
-- scenarios, not a different set of them. Only the requirements differ.
--
-- rank_names / rank_colors live here rather than on `benchmarks`, because a
-- ladder is per tier. `benchmarks` keeps its own copy only so that rows
-- written before this existed still resolve — see the migration below.
create table if not exists public.benchmark_tiers (
  id uuid default gen_random_uuid() primary key,
  benchmark_id uuid references public.benchmarks(id) on delete cascade not null,
  -- The url segment. Lower-case, hyphenated, unique per benchmark so that
  -- "Elite (Unofficial)" and "elite unofficial" cannot both exist and make
  -- /benchmarks/<id>/<slug> ambiguous.
  slug text not null,
  name text not null,
  -- Order in the switcher. Ascending; ties fall back to created_at.
  position integer not null default 0,
  rank_names text[] not null default '{"Bronze","Silver","Gold","Platinum","Diamond","Champion","Radiant","Immortal"}',
  rank_colors text[] not null default '{"#b87333","#c0c0c0","#ffd700","#e5e4e2","#b9f2fe","#ffd700","#ff0000","#9f9f9f"}',
  -- Mirrors the "(Unofficial)" suffix in the reference. A tier the author
  -- made for themselves rather than as part of the benchmark's intent; it is
  -- labelled, not hidden or gated.
  is_official boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (benchmark_id, slug)
);

create index if not exists benchmark_tiers_benchmark_idx
  on public.benchmark_tiers (benchmark_id, position);

alter table public.benchmark_tiers enable row level security;

-- benchmark_tiers: no policies = server-only (service role).

-- Cutoffs per tier per scenario. Kept out of benchmark_scenarios so the
-- scenario list stays shared and adding a tier is a row per scenario rather
-- than a copy of the whole list.
create table if not exists public.benchmark_tier_cutoffs (
  tier_id uuid references public.benchmark_tiers(id) on delete cascade not null,
  easyaim_scenario_id text not null,
  cutoffs jsonb not null default '{}'::jsonb,
  primary key (tier_id, easyaim_scenario_id)
);

create index if not exists benchmark_tier_cutoffs_scenario_idx
  on public.benchmark_tier_cutoffs (easyaim_scenario_id);

alter table public.benchmark_tier_cutoffs enable row level security;

-- Column type must match benchmark_scenarios.easyaim_scenario_id, which the
-- type block above this one has already moved to text. Declaring it bigint
-- here made the seed insert below fail with
--   42804: column "easyaim_scenario_id" is of type bigint but expression is
--   of type text
-- and, worse, the create ran before the insert, so a re-run needed this to
-- repair a table that already existed with the wrong type. Idempotent either
-- way: a no-op on a fresh table, a repair on an existing one.
alter table public.benchmark_tier_cutoffs
  alter column easyaim_scenario_id type text using easyaim_scenario_id::text;

-- benchmark_tier_cutoffs: no policies = server-only (service role).

-- ------------------------------------------------------------
-- Give every existing benchmark one tier, built from what it already has.
-- Without this a benchmark created before tiers existed would have no ladder
-- to render and every rank would silently collapse to null.
--
-- 'primary' is the slug, so /benchmarks/<id>/primary always resolves.
-- ------------------------------------------------------------
insert into public.benchmark_tiers
  (benchmark_id, slug, name, position, rank_names, rank_colors)
select
  b.id,
  'primary',
  'Standard',
  0,
  coalesce(b.rank_names, '{"Bronze","Silver","Gold","Platinum","Diamond","Champion","Radiant","Immortal"}'),
  coalesce(b.rank_colors, '{"#b87333","#c0c0c0","#ffd700","#e5e4e2","#b9f2fe","#ffd700","#ff0000","#9f9f9f"}')
from public.benchmarks b
where not exists (
  select 1 from public.benchmark_tiers t where t.benchmark_id = b.id
);

-- Move each benchmark's existing cutoffs onto its new primary tier. Done after
-- the insert above so tier_id exists.
insert into public.benchmark_tier_cutoffs
  (tier_id, easyaim_scenario_id, cutoffs)
select
  t.id,
  bs.easyaim_scenario_id,
  coalesce(bs.cutoffs, '{}'::jsonb)
from public.benchmark_scenarios bs
join public.benchmark_tiers t on t.benchmark_id = bs.benchmark_id
on conflict (tier_id, easyaim_scenario_id) do nothing;
