import { NextResponse } from "next/server";
import { syncEasyAimAccount, syncLatestRun } from "@/lib/easyaimSync";
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

    const mode = new URL(request.url).searchParams.get("mode");
    const result =
      mode === "latest"
        ? await syncLatestRun(accountId)
        : await syncEasyAimAccount(accountId);

    return NextResponse.json(result);
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