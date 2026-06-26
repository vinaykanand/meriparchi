import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

// Helper to verify that the request is made by a super admin
async function verifySuperAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    const orgcode = cookieStore.get("orgcode")?.value;

    if (!authtoken || !orgcode) return false;

    const result = await query(
      "SELECT issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
      [authtoken, orgcode]
    );
    return result.rows.length > 0 && result.rows[0].issuperadmin;
  } catch {
    return false;
  }
}

// GET: Get all usage logs for a coupon code
export async function GET(request: Request) {
  const isSuperAdmin = await verifySuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.json({ success: false, message: "Forbidden: Super Admin access required" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ success: false, message: "Missing code parameter" }, { status: 400 });
    }

    const result = await query(
      `SELECT u.orgcode, c.orgname, u.timestamp
       FROM public.coupon_uses u
       LEFT JOIN public.company c ON u.orgcode = c.orgcode
       WHERE u.code = $1
       ORDER BY u.timestamp DESC`,
      [code.trim().toUpperCase()]
    );

    return NextResponse.json({ success: true, usage: result.rows });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch coupon usage" },
      { status: 500 }
    );
  }
}
