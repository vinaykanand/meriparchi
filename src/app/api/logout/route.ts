import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");

    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (authtoken && orgcode) {
      // 1. Fetch user information
      const sessionCheck = await query(
        "SELECT userid FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
        [authtoken, orgcode]
      );

      if (sessionCheck.rows.length > 0) {
        const userid = sessionCheck.rows[0].userid;

        // 2. Check if security logs are enabled
        const companyCheck = await query(
          "SELECT enable_security_logs FROM public.company WHERE orgcode = $1",
          [orgcode]
        );

        if (companyCheck.rows.length > 0 && companyCheck.rows[0].enable_security_logs !== false) {
          const userAgent = request.headers.get("user-agent") || "unknown";
          const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

          await logAction({
            orgcode,
            userid,
            action: "LOGOUT",
            details: { ip, userAgent },
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (error: any) {
    console.error("Logout API Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
