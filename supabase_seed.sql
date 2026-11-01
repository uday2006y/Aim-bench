-- ============================================================
-- SUPABASE SEED — Insert account + EasyAim link + benchmark
-- ============================================================

-- 1. Insert YOUR account (replace values)
-- Get the generated UUID after insert to use below, or query it
INSERT INTO public.accounts (username, discord_id, avatar_url)
VALUES ('YourDiscordName', '123456789012345678', 'https://cdn.discordapp.com/avatar/123456789012345678/abc123.webp')
ON CONFLICT (discord_id) DO NOTHING;

-- 2. Link EasyAim player 1762939800 to this account
INSERT INTO public.easyaim_links (account_id, easyaim_player_id, easyaim_username, avatar_url)
SELECT id, 1762939800, 'Player1762939800', 'https://cdn.easyaim.com/avatars/1762939800.webp'
FROM public.accounts
WHERE discord_id = '123456789012345678'
ON CONFLICT (account_id) DO NOTHING;

-- 3. Create "Dynamic - Dih" benchmark
INSERT INTO public.benchmarks (user_id, title, description, difficulty)
SELECT id, 'Dynamic - Dih', 'Dynamic aim benchmark with current EasyAim scenarios', 'Medium'
FROM public.accounts
WHERE discord_id = '123456789012345678'
ON CONFLICT (title) DO NOTHING;

-- 4. Create 4 tiers
INSERT INTO public.benchmark_tiers (benchmark_id, slug, name, position)
VALUES
  ((SELECT id FROM public.benchmarks WHERE title = 'Dynamic - Dih'), 'tier-1', 'Tier 1', 0),
  ((SELECT id FROM public.benchmarks WHERE title = 'Dynamic - Dih'), 'tier-2', 'Tier 2', 1),
  ((SELECT id FROM public.benchmarks WHERE title = 'Dynamic - Dih'), 'tier-3', 'Tier 3', 2),
  ((SELECT id FROM public.benchmarks WHERE title = 'Dynamic - Dih'), 'tier-4', 'Tier 4', 3)
ON CONFLICT (benchmark_id, slug) DO NOTHING;

-- 5. Insert 4 benchmark_scenarios with YOUR current EasyAim scenario IDs
-- REPLACE the 4 scenario IDs below with actual 10-digit IDs from EasyAim
-- that match: dom 3T, eth Pasu Switch Micro Easier [MOBILE], 1w4 PASU 80% Larger Switch, Sky Switch
-- (Run the get_scenario_titles.ps1 script or query EasyAim API to find the correct IDs)

-- Scenario 1 (tier-1) - REPLACE ID
INSERT INTO public.benchmark_scenarios (tier_id, easyaim_scenario_id, title, category, sub_category, position)
VALUES (
  (SELECT id FROM public.benchmark_tiers WHERE slug = 'tier-1' AND benchmark_id = (SELECT id FROM public.benchmarks WHERE title = 'Dynamic - Dih')),
  'REPLACE_WITH_ACTUAL_SCENARIO_ID_1', 'dom 3T', 'Other', '', 0
)
ON CONFLICT (tier_id, easyaim_scenario_id) DO NOTHING;

-- Scenario 2 (tier-2) - REPLACE ID
INSERT INTO public.benchmark_scenarios (tier_id, easyaim_scenario_id, title, category, sub_category, position)
VALUES (
  (SELECT id FROM public.benchmark_tiers WHERE slug = 'tier-2' AND benchmark_id = (SELECT id FROM public.benchmarks WHERE title = 'Dynamic - Dih')),
  'REPLACE_WITH_ACTUAL_SCENARIO_ID_2', 'eth Pasu Switch Micro Easier [MOBILE]', 'Other', '', 1
)
ON CONFLICT (tier_id, easyaim_scenario_id) DO NOTHING;

-- Scenario 3 (tier-3) - REPLACE ID
INSERT INTO public.benchmark_scenarios (tier_id, easyaim_scenario_id, title, category, sub_category, position)
VALUES (
  (SELECT id FROM public.benchmark_tiers WHERE slug = 'tier-3' AND benchmark_id = (SELECT id FROM public.benchmarks WHERE title = 'Dynamic - Dih')),
  'REPLACE_WITH_ACTUAL_SCENARIO_ID_3', '1w4 PASU 80% Larger Switch', 'Other', '', 2
)
ON CONFLICT (tier_id, easyaim_scenario_id) DO NOTHING;

-- Scenario 4 (tier-4) - REPLACE ID
INSERT INTO public.benchmark_scenarios (tier_id, easyaim_scenario_id, title, category, sub_category, position)
VALUES (
  (SELECT id FROM public.benchmark_tiers WHERE slug = 'tier-4' AND benchmark_id = (SELECT id FROM public.benchmarks WHERE title = 'Dynamic - Dih')),
  'REPLACE_WITH_ACTUAL_SCENARIO_ID_4', 'Sky Switch', 'Other', '', 3
)
ON CONFLICT (tier_id, easyaim_scenario_id) DO NOTHING;