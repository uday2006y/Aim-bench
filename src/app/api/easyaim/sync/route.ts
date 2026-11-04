import { NextResponse } from "next/server";
import { syncSiteScenarios } from "@/lib/easyaimSiteSync";
import { getSessionAccountId } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const accountId = await getSessionAccountId();

    if (!accountId) {
      return NextResponse.json(
        { error: "You must be logged in to sync" },
        { status: 401 }
      );
    }

    // Optional: limit the scan to one benchmark's scenarios. Only ever used
    // to filter rows already read from the database, never to build a query.
    const rawBenchmarkId = new URL(request.url).searchParams.get("benchmarkId");
    const benchmarkId =
      rawBenchmarkId && rawBenchmarkId.length <= 64 ? rawBenchmarkId : undefined;

    return NextResponse.json(
      await syncSiteScenarios(accountId, benchmarkId ? { benchmarkId } : {})
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";

    if (message === "No EasyAim account linked") {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("EASYAIM SYNC ERROR:", error);
    return NextResponse.json(
      { error: "Failed to sync with EasyAim" },
      { status: 500 }
    );
  }
}