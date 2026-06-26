import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

async function verifySuperAdmin() {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (!authtoken) {
      return { ok: false, status: 401, message: "Unauthorized: Missing authtoken" };
    }

    const result = await query(
      "SELECT userid, issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = 'SUPER' AND isactive = true",
      [authtoken]
    );

    if (result.rows.length === 0 || !result.rows[0].issuperadmin) {
      return { ok: false, status: 403, message: "Forbidden: Super Admin access required" };
    }

    return { ok: true, status: 200, message: "Authorized" };
  } catch (error: any) {
    return { ok: false, status: 500, message: error.message || "Internal server error" };
  }
}

export async function GET() {
  const auth = await verifySuperAdmin();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  try {
    // 1. Subscription Payments Report
    const subRes = await query(`
      SELECT 
        c.orgcode, 
        c.orgname, 
        COALESCE(SUM(ph.amount), 0) AS total_paid,
        COUNT(ph.id) AS payments_count
      FROM public.company c
      LEFT JOIN public.payment_history ph ON c.orgcode = ph.orgcode
      GROUP BY c.orgcode, c.orgname
      ORDER BY total_paid DESC
    `);

    // 2. Referral Rewards Report
    const refRes = await query(`
      SELECT 
        c.orgcode, 
        c.orgname, 
        COALESCE(SUM(ph.points_earned), 0) AS total_earned,
        COUNT(ph.id) AS referrals_count
      FROM public.company c
      LEFT JOIN public.payment_history ph ON c.orgcode = ph.referred_by
      GROUP BY c.orgcode, c.orgname
      ORDER BY total_earned DESC
    `);

    // 3. Software Usage Report
    const usageRes = await query(`
      SELECT 
        c.orgcode, 
        c.orgname, 
        (SELECT COUNT(*) FROM public.slips s WHERE s.orgcode = c.orgcode) AS slips_count,
        (SELECT COUNT(*) FROM public.payments p WHERE p.orgcode = c.orgcode) AS payments_count
      FROM public.company c
      ORDER BY slips_count DESC, payments_count DESC
    `);

    // 4. Summaries
    const summaryRes = await query(`
      SELECT 
        COALESCE(SUM(amount), 0) AS total_revenue,
        COALESCE(SUM(points_earned), 0) AS total_referrals_rewarded
      FROM public.payment_history
    `);

    const clientCountRes = await query("SELECT COUNT(*) as count FROM public.company");

    return NextResponse.json({
      success: true,
      subscriptionsReport: subRes.rows,
      referralsReport: refRes.rows,
      usageReport: usageRes.rows,
      summary: {
        totalRevenue: parseFloat(summaryRes.rows[0]?.total_revenue || "0"),
        totalReferralsRewarded: parseFloat(summaryRes.rows[0]?.total_referrals_rewarded || "0"),
        clientCount: parseInt(clientCountRes.rows[0]?.count || "0", 10)
      }
    });
  } catch (error: any) {
    console.error("Super Admin Reports GET Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
