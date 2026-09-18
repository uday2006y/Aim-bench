import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionAccountId } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") || "kovaiacks";
    const q = searchParams.get("q");

    let query = supabaseAdmin.from("benchmarks").select("*");

    if (platform && platform !== "all") {
      query = query.eq("platform", platform);
    }

    if (q) {
      query = query.ilike("title", `%${q}%`);
    }

    const { data: benchmarks, error } = await query;

    if (error) throw error;

    return NextResponse.json({ benchmarks });
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
    const { title, description, platform, difficulty, scenarioCount } = await request.json();

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

    const { data: benchmark, error } = await supabaseAdmin
      .from("benchmarks")
      .insert({
        title,
        description,
        platform: platform || "kovaiacks",
        difficulty: difficulty || "medium",
        user_id: accountId,
        scenario_count: scenarioCount || 1,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ benchmark }, { status: 201 });
  } catch (error) {
    console.error("CREATE BENCHMARK ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create benchmark" },
      { status: 500 }
    );
  }
}