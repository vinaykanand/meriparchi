import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (!authtoken) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Missing authentication token" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const orgcode = body.orgcode;
    const userids = body.userids || null;

    if (!orgcode) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters" },
        { status: 400 }
      );
    }

    const result = await query(
      "SELECT public.generate_user_otp($1, $2, $3) as result",
      [authtoken, orgcode, userids]
    );

    if (result.rows.length > 0 && result.rows[0].result) {
      const data = result.rows[0].result;
      return NextResponse.json(data, { status: data.success ? 200 : 400 });
    }

    return NextResponse.json(
      { success: false, message: "Failed to reset OTPs" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("OTP Reset Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
