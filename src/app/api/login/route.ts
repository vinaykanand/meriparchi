import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgcode, userid, password, otp } = body;

    if (!orgcode || !userid || !password) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const result = await query(
      "SELECT public.login_user($1, $2, $3, $4) as result",
      [orgcode, userid, password, otp || null]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Login failed" }, { status: 400 });
    }

    const data = result.rows[0].result;

    if (!data || !data.success) {
      return NextResponse.json(data || { success: false, message: "Login failed" }, { status: 400 });
    }

    // Set the cookie if authtoken is present in the login response
    if (data.authtoken) {
      const cookieStore = await cookies();
      cookieStore.set("authtoken", data.authtoken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });
      cookieStore.set("orgcode", data.orgcode || body.orgcode, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Login API Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
