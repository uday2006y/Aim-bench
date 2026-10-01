import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/session";
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

    const { data: account, error } = await supabaseAdmin
      .from("accounts")
      .select("id, username, password_hash, role")
      .eq("username", username)
      .maybeSingle();

    if (error || !account) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Discord-created accounts have no password hash at all. bcrypt.compare
    // throws on null rather than returning false, which used to fall into the
    // catch below and answer 400 "Invalid request" — technically true, and
    // useless to somebody who typed a real password. There is simply no
    // password to check.
    if (!account.password_hash) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const passwordValid = await bcrypt.compare(
      password,
      account.password_hash
    );

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    clearThrottle(throttleKey);

    const token = await createSession(account.id);

    const response = NextResponse.json({
      success: true,
      account: {
        id: account.id,
        username: account.username,
        role: account.role,
      },
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
    console.error("LOGIN ERROR:", error);

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}