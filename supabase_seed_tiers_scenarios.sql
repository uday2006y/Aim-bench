-- ============================================================
-- STEP 3: Insert "Dynamic - Dih" benchmark + 4 scenario tiers
-- ============================================================

-- 3a. Create the benchmark
INSERT INTO public.benchmarks (user_id, title, description, difficulty)
VALUES (
  '00000000-0000-0000-0000-000000000000', -- placeholder; replace with real account id
  'Dynamic - Dih',
  'Dynamic aim benchmark with current EasyAim scenarios',
  'Medium'
)
ON CONFLICT (title) DO NOTHING;

-- 3b. Create 4 tiers (one per scenario)
-- Tier 1
INSERT INTO public.benchmark_tiers (benchmark_id, slug, name, position)
VALUES (
  (SELECT id FROM public.benchmarks WHERE title = 'Dynamic - Dih'),
  'tier-1', 'Tier 1', 0
)
ON CONFLICT (benchmark_id, slug) DO NOTHING;

-- Tier 2
INSERT INTO public.benchmark_tiers (benchmark_id, slug, name, position)
VALUES (
  (SELECT id FROM public.benchmarks WHERE title = 'Dynamic - Dih'),
  'tier-2', 'Tier 2', 1
)
ON CONFLICT (benchmark_id, slug) DO NOTHING;

-- Tier 3
INSERT INTO public.benchmark_tiers (benchmark_id, slug, name, position)
VALUES (
  (SELECT id FROM public.benchmarks WHERE title = 'Dynamic - Dih'),
  'tier-3', 'Tier 3', 2
)
ON CONFLICT (benchmark_id, slug) DO NOTHING;

-- Tier 4
INSERT INTO public.benchmark_tiers (benchmark_id, slug, name, position)
VALUES (
  (SELECT id FROM public.benchmarks WHERE title = 'Dynamic - Dih'),
  'tier-4', 'Tier 4', 3
)
ON CONFLICT (benchmark_id, slug) DO NOTHING;

-- 3c. Insert 4 benchmark_scenarios with YOUR current EasyAim scenario IDs
-- REPLACE the scenario IDs below with the actual 10-digit IDs from EasyAim
-- that match: dom 3T, eth Pasu Switch Micro Easier [MOBILE], 1w4 PASU 80% Larger Switch, Sky Switch

-- Scenario 1 (tier-1)
INSERT INTO public.benchmark_scenarios (tier_id, easyaim_scenario_id, title, category, sub_category, position)
VALUES (
  (SELECT id FROM public.benchmark_tiers WHERE slug = 'tier-1'),
  '1785533353', -- <<< REPLACE with actual scenario ID for "1w2t Micro Reflex" or your first scenario
  '1w2t Micro Reflex',
  'Other', '', 0
)
ON CONFLICT (tier_id, easyaim_scenario_id) DO NOTHING;

-- Scenario 2 (tier-2)
INSERT INTO public.benchmark_scenarios (tier_id, easyaim_scenario_id, title, category, sub_category, position)
VALUES (
  (SELECT id FROM public.benchmark_tiers WHERE slug = 'tier-2'),
  'REPLACE_ID_HERE', -- <<< REPLACE
  'Scenario 2 Title',
  'Other', '', 1
)
ON CONFLICT (tier_id, easyaim_scenario_id) DO NOTHING;

-- Scenario 3 (tier-3)
INSERT INTO public.benchmark_scenarios (tier_id, easyaim_scenario_id, title, category, sub_category, position)
VALUES (
  (SELECT id FROM public.benchmark_tiers WHERE slug = 'tier-3'),
  'REPLACE_ID_HERE', -- <<< REPLACE
  'Scenario 3 Title',
  'Other', '', 2
)
ON CONFLICT (tier_id, easyaim_scenario_id) DO NOTHING;

-- Scenario 4 (tier-4)
INSERT INTO public.benchmark_scenarios (tier_id, easyaim_scenario_id, title, category, sub_category, position)
VALUES (
  (SELECT id FROM public.benchmark_tiers WHERE slug = 'tier-4'),
  'REPLACE_ID_HERE', -- <<< REPLACE
  'Scenario 4 Title',
  'Other', '', 3
)
ON CONFLICT (tier_id, easyaim_scenario_id) DO NOTHING;