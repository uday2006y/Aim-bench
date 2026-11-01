-- ============================================================
-- FRESH SUPABASE DATABASE — DROP ALL + RECREATE
-- ============================================================

-- 1. Drop all dependent tables (fresh start)
DROP TABLE IF EXISTS public.benchmark_scores CASCADE;
DROP TABLE IF EXISTS public.easyaim_pbs CASCADE;
DROP TABLE IF EXISTS public.benchmark_scenarios CASCADE;
DROP TABLE IF EXISTS public.benchmark_tiers CASCADE;
DROP TABLE IF EXISTS public.easyaim_links CASCADE;
DROP TABLE IF EXISTS public.benchmarks CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;

-- 2. Recreate accounts
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  discord_id TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- 3. Recreate benchmarks
CREATE TABLE public.benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  platform TEXT DEFAULT 'easyaim',
  difficulty TEXT,
  rank_names TEXT[] DEFAULT '{"Bronze","Silver","Gold","Platinum","Diamond","Champion","Radiant","Immortal"}',
  rank_colors TEXT[] DEFAULT '{"#b87333","#c0c0c0","#ffd700","#e5e4e2","#b9f2fe","#ffd700","#ff0000","#9f9f9f"}',
  rank_thresholds JSONB DEFAULT '{}',
  category_defs JSONB DEFAULT '[]',
  scenario_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.benchmarks ENABLE ROW LEVEL SECURITY;

-- 4. Recreate benchmark_tiers
CREATE TABLE public.benchmark_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_id UUID REFERENCES public.benchmarks(id) ON DELETE CASCADE NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  rank_names TEXT[] NOT NULL DEFAULT '{"Bronze","Silver","Gold","Platinum","Diamond","Champion","Radiant","Immortal"}',
  rank_colors TEXT[] NOT NULL DEFAULT '{"#b87333","#c0c0c0","#ffd700","#e5e4e2","#b9f2fe","#ffd700","#ff0000","#9f9f9f"}',
  is_official BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (benchmark_id, slug)
);
CREATE INDEX benchmark_tiers_benchmark_idx ON public.benchmark_tiers (benchmark_id, position);
ALTER TABLE public.benchmark_tiers ENABLE ROW LEVEL SECURITY;

-- 5. Recreate benchmark_scenarios
CREATE TABLE public.benchmark_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id UUID REFERENCES public.benchmark_tiers(id) ON DELETE CASCADE NOT NULL,
  easyaim_scenario_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'Other',
  sub_category TEXT DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  cutoffs JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tier_id, easyaim_scenario_id)
);
CREATE INDEX benchmark_scenarios_tier_idx ON public.benchmark_scenarios (tier_id, position);
ALTER TABLE public.benchmark_scenarios ENABLE ROW LEVEL SECURITY;

-- 6. Recreate easyaim_links
CREATE TABLE public.easyaim_links (
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  easyaim_player_id BIGINT NOT NULL,
  easyaim_username TEXT,
  avatar_url TEXT,
  last_run_id BIGINT,
  backfill_cursor TEXT,
  backfill_done BOOLEAN DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (account_id)
);
ALTER TABLE public.easyaim_links ENABLE ROW LEVEL SECURITY;

-- 7. Recreate easyaim_pbs
CREATE TABLE public.easyaim_pbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  scenario_id TEXT NOT NULL,
  score NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, scenario_id)
);
ALTER TABLE public.easyaim_pbs ENABLE ROW LEVEL SECURITY;

-- 8. Recreate benchmark_scores
CREATE TABLE public.benchmark_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  benchmark_id UUID REFERENCES public.benchmarks(id) ON DELETE CASCADE NOT NULL,
  score NUMERIC NOT NULL,
  rank TEXT,
  rank_index INTEGER,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.benchmark_scores ENABLE ROW LEVEL SECURITY;

-- 9. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- DONE: Fresh empty database ready.
-- ============================================================