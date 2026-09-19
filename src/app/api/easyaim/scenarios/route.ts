import { NextResponse } from "next/server";
import { searchScenarios } from "@/lib/easyaim";
import { getSessionAccountId } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const accountId = await getSessionAccountId();

    if (!accountId) {
      return NextResponse.json(
        { error: "You must be logged in to search scenarios" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();

    if (query.length < 2) {
      return NextResponse.json({ scenarios: [] });
    }

    const result = await searchScenarios(query, 20);

    return NextResponse.json({
      scenarios: result.data.map((scenario) => ({
        id: scenario.id,
        title: scenario.title,
        difficulty: scenario.difficulty,
        plays: scenario.plays,
        author: scenario.author?.username || null,
      })),
    });
  } catch (error) {
    console.error("EASYAIM SCENARIO SEARCH ERROR:", error);
    return NextResponse.json(
      { error: "Failed to search EasyAim scenarios" },
      { status: 502 }
    );
  }
}