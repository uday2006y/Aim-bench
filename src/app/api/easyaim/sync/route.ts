import { NextResponse } from "next/server";
import { syncSiteScenarios } from "@/lib/easyaimSiteSync";
import { getSessionAccountId } from "@/lib/session";

export async function POST() {
  try {
    const accountId = await getSessionAccountId();

    if (!accountId) {
      return NextResponse.json(
        { error: "You must be logged in to sync" },
        { status: 401 }
      );
    }

    return NextResponse.json(await syncSiteScenarios(accountId));
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