import { NextResponse } from "next/server";
import { syncEasyAimAccount } from "@/lib/easyaimSync";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Called by the Vercel cron (see vercel.json) with the CRON_SECRET as
// a bearer token. Can also be triggered manually for testing.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: links, error } = await supabaseAdmin
    .from("easyaim_links")
    .select("account_id")
    .limit(200);

  if (error) {
    console.error("EASYAIM SYNC-ALL ERROR:", error);
    return NextResponse.json(
      { error: "Failed to load linked accounts" },
      { status: 500 }
    );
  }

  let synced = 0;
  const failed: string[] = [];

  for (const row of links || []) {
    const accountId = (row as { account_id: string }).account_id;

    try {
      await syncEasyAimAccount(accountId);
      synced += 1;
    } catch (syncError) {
      console.error("EASYAIM SYNC-ALL ACCOUNT ERROR:", accountId, syncError);
      failed.push(accountId);
    }
  }

  return NextResponse.json({ synced, failed });
}