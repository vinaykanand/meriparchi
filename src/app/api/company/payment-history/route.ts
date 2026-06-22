import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");

    if (!orgcode) {
      return NextResponse.json({ success: false, message: "Missing orgcode parameter" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    const sessionOrgcode = cookieStore.get("orgcode")?.value;

    if (!authtoken || !sessionOrgcode) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Verify user authorization: must be admin in the same org, or a super admin
    const userCheck = await query(
      "SELECT isadmin, issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
      [authtoken, sessionOrgcode]
    );

    if (userCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { isadmin, issuperadmin } = userCheck.rows[0];

    // Block non-admins unless they are super admins
    if (!issuperadmin) {
      if (!isadmin || sessionOrgcode !== orgcode) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
      }
    }

    const result = await query(
      `SELECT id, order_id, payment_id, plan_key, amount, coupon_code, timestamp, invoice_url 
       FROM public.payment_history 
       WHERE orgcode = $1 
       ORDER BY timestamp DESC`,
      [orgcode]
    );

    return NextResponse.json({ success: true, history: result.rows });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch payment history" },
      { status: 500 }
    );
  }
}
