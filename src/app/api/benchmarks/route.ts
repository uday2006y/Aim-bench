import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { getSessionAccountId } from "@/lib/session";

import { groupScenariosByTier, sanitizeScenarios, sanitizeCategoryDefs, syncSubCategoriesIntoDefs } from "@/lib/benchmarkScenarios";

import { resetLinkedAccountsBackfill } from "@/lib/resetBackfill";

import { recordAggregateFor } from "@/lib/easyaimSync";

import {

  computeAggregates,

  type RankSource,

  type ScenarioCutoffs,

} from "@/lib/aggregates";

import { primaryTierIds, scenariosInPrimaryTiers, sanitizeTiers, type TierRef } from "@/lib/benchmarkTiers";

import { createTiersForBenchmark, loadAllTierRefs } from "@/lib/tiers";

import { DEFAULT_RANK_NAMES, DEFAULT_RANK_COLORS } from "@/lib/benchmarkDefaults";



/**

 * Upper bound on the scenario rows read for rank cutoffs. Comfortably above

 * any realistic benchmark site, and checked below rather than trusted.

 */

const SCENARIO_SCAN_LIMIT = 5000;



export async function GET(request: Request) {

  try {

    const { searchParams } = new URL(request.url);

    // Defaults to no filter. This used to default to "easyaim", which was

    // invisible while the list page always sent an explicit "all" ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â and

    // would have silently hidden every benchmark on a second platform once

    // the page stopped sending the parameter at all.

    const platform = searchParams.get("platform") || "all";

    const q = searchParams.get("q");



    const accountId = await getSessionAccountId();



    // One round trip, not five. Every one of these used to be awaited in

    // sequence, and each await is a full HTTPS round trip to Postgres from

    // a serverless function ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â roughly a third of a second each regardless

    // of how little data comes back. Five in a row was most of the two and

    // a half seconds this endpoint took to answer.

    //

    // None of them actually depend on each other:

    //   - the caller's personal bests are keyed by account, not by scenario,

    //     so they do not need the scenario ids that come back below

    //   - the viewer's pins and the platform list are independent entirely

    // so the only ordering left is: fetch everything, then join in memory.

    const [benchmarksResult, scenarioResult, pbResult, pinResult] =

      await Promise.all([

        (() => {

          let query = supabaseAdmin.from("benchmarks").select("*");



          if (platform && platform !== "all") {

            query = query.eq("platform", platform);

          }



          if (q) {

            query = query.ilike("title", `%${q}%`);

          }



          return query;

        })(),



        // Cutoffs for every benchmark, not just the visible ones. The list

        // has no pagination, so this is the whole table. The cap is a guard

        // against a pathological dataset, and hitting it is logged rather

        // than ignored: a truncated read here would quietly produce wrong

        // ranks, which is worse than a slow page.

        supabaseAdmin
          .from("benchmark_scenarios")
          .select("benchmark_id, tier_id, easyaim_scenario_id, cutoffs")
          .limit(SCENARIO_SCAN_LIMIT),

        accountId
          ? supabaseAdmin

              .from("easyaim_pbs")

              .select("scenario_id, score")

              .eq("account_id", accountId)

          : null,



        accountId

          ? supabaseAdmin

              .from("benchmark_pins")

              .select("benchmark_id")

              .eq("account_id", accountId)

          : null,

      ]);



    if (benchmarksResult.error) throw benchmarksResult.error;

    if (scenarioResult.error) {

      console.error("BENCHMARKS: failed to load scenarios:", scenarioResult.error);

    }



    const scenarioRowCount = scenarioResult.data?.length ?? 0;



    if (scenarioRowCount >= SCENARIO_SCAN_LIMIT) {

      // Ranks derived from a truncated scenario set are wrong in a way

      // nothing on the page would reveal, so make it loud in the logs.

      console.error(

        `BENCHMARKS: hit the ${SCENARIO_SCAN_LIMIT}-row scenario cap ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ranks may be wrong. ` +

          "Raise SCENARIO_SCAN_LIMIT, or scope the query to the visible benchmarks."

      );

    }

    if (pbResult?.error) {

      console.error("BENCHMARKS: failed to load personal bests:", pbResult.error);

    }

    if (pinResult?.error) {

      console.error("BENCHMARKS: failed to load pins:", pinResult.error);

    }



    const rows = (benchmarksResult.data || []) as RankSource[];



    const pbByScenario = new Map<string, number>();

    for (const row of pbResult?.data || []) {

      const pb = row as { scenario_id: number; score: number };

      pbByScenario.set(String(pb.scenario_id), pb.score);

    }



    const myPins = new Set<string>();

    for (const row of pinResult?.data || []) {

      myPins.add((row as { benchmark_id: string }).benchmark_id);

    }



    // Scenarios belong to a tier, so a benchmark with three tiers has three
    // times the rows. Summing them all into one card would add a player's
    // Novice score to their Elite score and call the total neither, so the
    // benchmark-level views describe each benchmark's first tier.
    const primaryIds = primaryTierIds((await loadAllTierRefs()) as TierRef[]);

    const scenarios = scenariosInPrimaryTiers(
      (scenarioResult.data || []) as unknown as (ScenarioCutoffs & {
        tier_id: string | null;
      })[],
      primaryIds
    );



    const aggregates = computeAggregates(rows, scenarios, pbByScenario);



    const benchmarks = rows.map((row) => {

      const mine = aggregates.get(row.id);



      return {

        ...row,

        my_score: mine && mine.score > 0 ? mine.score : null,

        my_rank: mine?.rank ?? null,

        my_rank_index: mine?.rankIndex ?? null,

        my_maxed: mine?.maxed ?? false,

        my_pinned: myPins.has(row.id),

      };

    });



    return NextResponse.json({

      benchmarks,

      // Saves the page a separate /api/session round trip to decide which

      // empty state a card should show.

      loggedIn: Boolean(accountId),

    });

  } catch (error) {

    console.error("BENCHMARKS ERROR:", error);

    return NextResponse.json(

      { error: "Failed to fetch benchmarks" },

      { status: 500 }

    );

  }

}



export async function POST(request: Request) {

  try {

    const {

      title,

      description,

      platform,

      difficulty,

      scenarioCount,

      scenarios,

      rank_names,

      rank_colors,

      rank_thresholds,

      category_defs,

      tiers,

    } = await request.json();



    if (!title) {

      return NextResponse.json(

        { error: "Title is required" },

        { status: 400 }

      );

    }



    const accountId = await getSessionAccountId();



    if (!accountId) {

      return NextResponse.json(

        { error: "You must be logged in to create a benchmark" },

        { status: 401 }

      );

    }



    const scenarioList = sanitizeScenarios(scenarios);

    const categoryDefs =

      syncSubCategoriesIntoDefs(

        sanitizeCategoryDefs(category_defs) ?? [],

        scenarioList

      ) ?? [];



    const { data: benchmark, error } = await supabaseAdmin

      .from("benchmarks")

      .insert({

        title,

        description,

        platform: scenarioList.length > 0 ? "easyaim" : platform || "easyaim",

        difficulty: difficulty || "medium",

        rank_names: rank_names || DEFAULT_RANK_NAMES,

        rank_colors: rank_colors || DEFAULT_RANK_COLORS,

        rank_thresholds: rank_thresholds || '{"Bronze":0,"Silver":1000,"Gold":2500,"Platinum":5000,"Diamond":10000,"Champion":15000,"Radiant":20000,"Immortal":30000}',

        category_defs: categoryDefs,

        user_id: accountId,

        scenario_count:

          scenarioList.length > 0 ? scenarioList.length : scenarioCount || 1,

      })

      .select()

      .single();



    if (error) throw error;



    if (scenarioList.length > 0) {


      // The tiers first. Scenarios hang off a tier, so tier ids have to exist


      // before a scenario row can point at one ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â which is why this runs before


      // the scenario insert rather than after it.


      const createdTiers = await createTiersForBenchmark(


        benchmark.id,


        sanitizeTiers(tiers),


        DEFAULT_RANK_NAMES,


        DEFAULT_RANK_COLORS


      );





      const tierIdBySlug = new Map(createdTiers.map((tier) => [tier.slug, tier.id]));


      const fallbackTierId = createdTiers[0]?.id;





      if (fallbackTierId) {


        const grouped = groupScenariosByTier(scenarios);





        const rows = Array.from(grouped.entries()).flatMap(([slug, list]) =>


          list.map((scenario) => ({


            benchmark_id: benchmark.id,


            tier_id: tierIdBySlug.get(slug) ?? fallbackTierId,


            easyaim_scenario_id: scenario.easyaimScenarioId,


            title: scenario.title,


            position: scenario.position,


            category: scenario.category,


            sub_category: scenario.subCategory || null,


            cutoffs: scenario.cutoffs,


          }))


        );





        if (rows.length > 0) {


          const { error: scenariosError } = await supabaseAdmin


            .from("benchmark_scenarios")


            .insert(rows);





          if (scenariosError) throw scenariosError;


        }


      }





      // Existing linked players get one full re-scan so their PBs on the


      // scenarios just added show up right away.


      await resetLinkedAccountsBackfill();





      // The author's own standing is computable right now from PBs they


      // already have, so record it immediately rather than making them


      // wait for the next sync to see their rank on the new benchmark.


      await recordAggregateFor(accountId, benchmark.id);


    }



    return NextResponse.json({ benchmark }, { status: 201 });

  } catch (error) {

    console.error("CREATE BENCHMARK ERROR:", error);

    return NextResponse.json(

      { error: "Failed to create benchmark" },

      { status: 500 }

    );

  }

}

