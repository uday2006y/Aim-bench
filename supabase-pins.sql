-- ============================================================
-- Benchmark pins
--
-- A star on a benchmark. Clicking it turns gold for the person who
-- clicked, and the community's total decides what features on the home
-- page (top 4 by pin count).
--
-- Safe to run against an existing database: create table if not exists,
-- and the view is replaced. Nothing is dropped or rewritten. Running it
-- twice is fine.
--
-- RLS: like easyaim_links and easyaim_pbs, no policies means the anon
-- key cannot read or write this table. The server uses the service-role
-- client, which bypasses RLS.
-- ============================================================

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

-- Pin totals per benchmark. Aggregating in SQL rather than pulling every
-- pin row means the cost of a pin count does not grow with the size of
-- the community: the home page reads the top 4 from here.
--
-- The unique index on (benchmark_id, account_id) already exists as the
-- table's primary key, so two people starring the same benchmark each add
-- one row and no single person can inflate a count.
--
-- security_invoker matters. A Postgres view is SECURITY DEFINER by
-- default: it runs with the creator's permissions and ignores the RLS
-- policies on the table underneath. Since public is exposed through
-- PostgREST, that would let the anon key read every pin row despite RLS
-- being enabled — RLS that looks correct but does nothing. With
-- security_invoker the view honours the querying user instead, so the
-- service-role client still reads everything (it has BYPASSRLS) and
-- anon/authenticated read nothing, which is what "no policies" on
-- benchmark_pins is meant to mean.
create or replace view public.benchmark_pin_totals
  with (security_invoker = on) as
  select
    benchmark_id,
    count(*)::int as pin_count
  from public.benchmark_pins
  group by benchmark_id;
