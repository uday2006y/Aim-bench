import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (username.length < 3 || password.length < 6) {
      return NextResponse.json(
        {
          error:
            "Username must be 3+ characters and password 6+ characters",
        },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: account, error } = await supabaseAdmin
      .from("accounts")
      .insert({
        username,
        password_hash: passwordHash,
      })
      .select("id, username, role")
      .single();

    if (error) {
      console.error("SUPABASE ERROR:", error);

      return NextResponse.json(
        { error: "Could not create account" },
        { status: 500 }
      );
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: account.id,
        display_name: username,
      });

    if (profileError) {
      console.error("PROFILE ERROR:", profileError);
    }

    return NextResponse.json({
      success: true,
      account,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}