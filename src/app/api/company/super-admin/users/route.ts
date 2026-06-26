import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    if (!authtoken) {
      return NextResponse.json({ success: false, message: "Unauthorized: Missing authtoken" }, { status: 401 });
    }

    // Verify user is superadmin
    const result = await query(
      "SELECT userid, issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = 'SUPER' AND isactive = true",
      [authtoken]
    );

    if (result.rows.length === 0 || !result.rows[0].issuperadmin) {
      return NextResponse.json({ success: false, message: "Forbidden: Super Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");

    if (!orgcode) {
      return NextResponse.json({ success: false, message: "Missing orgcode" }, { status: 400 });
    }

    const usersResult = await query(
      "SELECT userid, isadmin, isactive FROM public.users WHERE orgcode = $1 ORDER BY isadmin DESC, userid ASC",
      [orgcode.trim().toUpperCase()]
    );

    return NextResponse.json({
      success: true,
      users: usersResult.rows
    });
  } catch (error: any) {
    console.error("Super Admin Users API Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
