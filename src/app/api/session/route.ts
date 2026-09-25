import { NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/session";

export async function GET() {
  try {
    const accountId = await getSessionAccountId();
    return NextResponse.json({ accountId: accountId ?? null });
  } catch {
    return NextResponse.json({ accountId: null }, { status: 500 });
  }
}
