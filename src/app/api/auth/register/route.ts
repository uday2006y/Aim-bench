import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSession } from "@/lib/session";
import bcrypt from "bcryptjs";
import { checkThrottle, clearThrottle, clientKey, tooManyAttempts } from "@/lib/throttle";

export async function POST(request: Request) {
  const throttleKey = clientKey(request);

  try {
    const throttle = checkThrottle(throttleKey);
    if (throttle.limited) return tooManyAttempts(throttle.retryAfterSeconds);

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
      // The check above and this insert are not one atomic operation, so two
      // people picking the same name at the same moment can both pass the
      // check and the second insert loses on the unique constraint. That is
      // the correct outcome — but it arrives as a 500, which tells the person
      // something is broken when actually their name is simply taken.
      // 23505 is unique_violation.
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Username already exists" },
          { status: 409 }
        );
      }

      console.error("SUPABASE ERROR:", error);

      return NextResponse.json(
        { error: "Could not create account" },
        { status: 500 }
      );
    }

    clearThrottle(throttleKey);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: account.id,
        display_name: username,
      });

    if (profileError) {
      console.error("PROFILE ERROR:", profileError);
    }

    const token = await createSession(account.id);

    const response = NextResponse.json({
      success: true,
      account,
    });

    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}