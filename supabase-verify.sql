-- ============================================================
-- Schema verification — READ ONLY, changes nothing.
--
-- Answers one question: is the database actually current?
--
-- Schema drift has bitten this project repeatedly — a missing
-- category_defs column, a missing sub_category column, a pins table
-- that was never created. Each time the symptom was identical (a
-- feature silently doing nothing) and the cause was invisible without
-- a database console.
--
-- Paste the whole thing into the Supabase SQL Editor and run it.
-- Every statement is a SELECT. Nothing is created, altered or dropped.
-- ============================================================


-- ------------------------------------------------------------
-- 1. TABLES
-- ------------------------------------------------------------
with expected(table_name) as (
  values
    ('accounts'),
    ('profiles'),
    ('benchmarks'),
    ('benchmark_scenarios'),
    ('benchmark_scores'),
    ('benchmark_edits'),
    ('easyaim_links'),
    ('easyaim_pbs'),
    ('benchmark_pins')
)
select
  case when t.table_name is null then 'MISSING' else 'ok' end as status,
  e.table_name,
  case
    when t.table_name is null then 'not created — run the matching .sql file'
    else to_char(t.table_size, '9990 "rows"') || ', rls: ' || t.rls
  end as detail
from expected e
left join (
  select
    c.relname as table_name,
    c.reltuples::bigint as table_size,
    c.relrowsecurity as rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
) t on t.table_name = e.table_name
order by status desc, e.table_name;


-- ------------------------------------------------------------
-- 2. COLUMNS THE APP READS
-- Missing columns surface as "column does not exist" 500s, or as
-- features that quietly do nothing if the query tolerates them.
-- ------------------------------------------------------------
with expected(table_name, column_name, why) as (
  values
    ('benchmarks',           'rank_names',        'rank ladder'),
    ('benchmarks',           'rank_colors',       'rank colours on cards and the leaderboard'),
    ('benchmarks',           'rank_thresholds',   'fallback ladder for older rows'),
    ('benchmarks',           'scenario_count',    'card subtitle'),
    ('benchmarks',           'category_defs',     'category/sub-category grouping'),
    ('benchmark_scenarios',  'sub_category',      'sub-group rows on the benchmark table'),
    ('benchmark_scenarios',  'cutoffs',           'per-rank score requirements'),
    ('benchmark_scenarios',  'easyaim_scenario_id','links a row to EasyAim'),
    ('accounts',             'discord_id',        'auto-links your EasyAim account at login'),
    ('easyaim_links',        'easyaim_player_id', 'the linked player'),
    ('easyaim_pbs',          'achieved_at',       'leaderboard "last improved" column'),
    ('easyaim_pbs',          'score',             'every rank is derived from this')
)
select
  case
    when c.table_name is null then 'MISSING TABLE'
    when c.column_name is null then 'MISSING'
    else 'ok'
  end as status,
  e.table_name || '.' || e.column_name as column,
  e.why
from expected e
left join information_schema.columns c
  on c.table_schema = 'public'
  and c.table_name = e.table_name
  and c.column_name = e.column_name
order by status desc, column;


-- ------------------------------------------------------------
-- 3. THE PIN VIEW
-- The star silently fails without this. It is a view, not a table,
-- so the check above cannot see it.
-- ------------------------------------------------------------
select
  case when v.view_name is null then 'MISSING' else 'ok' end as status,
  'benchmark_pin_totals' as object,
  case
    when v.view_name is null
      then 'not created — run supabase-pins.sql'
    else 'security_invoker: ' || coalesce(v.security_invoker::text, 'unknown')
  end as detail
from (select 1) as _
left join (
  select
    c.relname as view_name,
    (select option_value from pg_options_to_table(c.reloptions)
      where option_name = 'security_invoker') = 'true' as security_invoker
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
) v on v.view_name = 'benchmark_pin_totals';


-- ------------------------------------------------------------
-- 4. ROLES AND POLICIES
-- Every table here should have RLS on and NO policies. That is what
-- makes the browser key useless against the database while the
-- service-role key still works. A policy added by accident exposes
-- that table to anyone holding the anon key.
-- ------------------------------------------------------------
select
  c.relname as table,
  c.relrowsecurity as rls_enabled,
  coalesce(p.policies, 0) as policy_count,
  case
    when not c.relrowsecurity then 'RLS OFF — anon key can read this'
    when coalesce(p.policies, 0) > 0 then 'HAS POLICIES — check they are intentional'
    else 'ok'
  end as verdict
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join (
  select tablename, count(*)::int as policies
  from pg_policies
  where schemaname = 'public'
  group by tablename
) p on p.tablename = c.relname
where n.nspname = 'public' and c.relkind = 'r'
order by verdict, c.relname;


-- ------------------------------------------------------------
-- 5. DATA SANITY
-- Counts only. If benchmark_pins is 0 and you have starred
-- something, section 3 will say why.
-- ------------------------------------------------------------
select 'benchmarks' as object, count(*) as rows from public.benchmarks
union all select 'benchmark_scenarios', count(*) from public.benchmark_scenarios
union all select 'benchmark_scores (history)', count(*) from public.benchmark_scores
union all select 'accounts', count(*) from public.accounts
union all select 'easyaim_links', count(*) from public.easyaim_links
union all select 'easyaim_pbs', count(*) from public.easyaim_pbs
union all select 'benchmark_pins', count(*) from public.benchmark_pins
order by object;


-- ------------------------------------------------------------
-- 6. THE THING MOST LIKELY TO DISAGREE WITH ITSELF
-- benchmark_scores is history; easyaim_pbs is the live source both
-- the cards and the leaderboard now read. A score row with no
-- matching PB means the sync recorded something the live path
-- cannot reproduce, so a card and a history entry can diverge.
-- ------------------------------------------------------------
select
  bs.user_id,
  count(*) as score_rows,
  count(ep.account_id) as rows_backed_by_a_pb,
  count(*) - count(ep.account_id) as rows_with_no_pb
from public.benchmark_scores bs
left join public.easyaim_pbs ep
  on ep.account_id = bs.user_id
group by bs.user_id
having count(*) - count(ep.account_id) > 0
order by rows_with_no_pb desc
limit 20;
