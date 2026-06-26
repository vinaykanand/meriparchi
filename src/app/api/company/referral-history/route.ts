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

    // Verify user: must be admin of same org or super admin
    const userCheck = await query(
      "SELECT isadmin, issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
      [authtoken, sessionOrgcode]
    );
    if (userCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const { isadmin, issuperadmin } = userCheck.rows[0];
    if (!issuperadmin && (!isadmin || sessionOrgcode !== orgcode)) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    // Read from payment_history joined with company referred_by
    const txnRes = await query(
      `SELECT
         ph.id,
         ph.timestamp AS created_at,
         ph.orgcode AS referred_orgcode,
         c.orgname AS referred_orgname,
         ph.amount AS payment_amount,
         ph.points_earned AS reward_points
       FROM public.payment_history ph
       LEFT JOIN public.company c ON c.orgcode = ph.orgcode
       WHERE ph.referred_by = $1
       ORDER BY ph.timestamp DESC
       LIMIT 200`,
      [orgcode]
    );

    const rewards = txnRes.rows.map((row) => ({
      id: row.id,
      date: row.created_at,
      referredCompany: row.referred_orgcode,
      referredOrgname: row.referred_orgname,
      paymentAmount: parseFloat(row.payment_amount),
      rewardPoints: parseFloat(row.reward_points),
    }));

    // Aggregates — total earned from payment_history table
    const aggRes = await query(
      `SELECT
         COUNT(DISTINCT ph.orgcode) AS referred_count,
         COALESCE(SUM(ph.points_earned), 0) AS total_earned
       FROM public.payment_history ph
       WHERE ph.referred_by = $1`,
      [orgcode]
    );

    const referredCount = parseInt(aggRes.rows[0]?.referred_count || "0", 10);
    const totalEarned   = parseFloat(aggRes.rows[0]?.total_earned || "0");

    // Total redeemed — from payment_history points_redeemed column
    const redeemedRes = await query(
      `SELECT COALESCE(SUM(points_redeemed), 0) AS total_redeemed
       FROM public.payment_history
       WHERE orgcode = $1`,
      [orgcode]
    );
    const totalRedeemed = parseFloat(redeemedRes.rows[0]?.total_redeemed || "0");

    // Current referral_code from company table
    const companyRes = await query(
      "SELECT referral_code FROM public.company WHERE orgcode = $1",
      [orgcode]
    );
    const referralCode = companyRes.rows[0]?.referral_code || null;
    const referralPoints = Math.max(0, totalEarned - totalRedeemed);

    return NextResponse.json({
      success: true,
      referralCode,
      referralPoints,   // current spendable balance
      referredCount,
      totalEarned,      // gross points ever earned
      totalRedeemed,    // points spent as discounts
      rewards,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch referral history" },
      { status: 500 }
    );
  }
}
