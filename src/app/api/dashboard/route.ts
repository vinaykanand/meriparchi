import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");

    if (!orgcode) {
      return NextResponse.json({ success: false, message: "Missing orgcode" }, { status: 400 });
    }

    // 1. Total Outstanding Ledger Balance
    const slipsTotalResult = await query(
      "SELECT SUM(netamount) as total FROM public.slips WHERE orgcode = $1",
      [orgcode]
    );
    const paymentsTotalResult = await query(
      "SELECT SUM(amount) as total FROM public.payments WHERE orgcode = $1",
      [orgcode]
    );
    const totalSlips = parseFloat(slipsTotalResult.rows[0]?.total || "0");
    const totalPayments = parseFloat(paymentsTotalResult.rows[0]?.total || "0");
    const totalOutstanding = Math.max(0, totalSlips - totalPayments);

    // 2. Today's Slips & Revenue
    const todaySlipsResult = await query(
      "SELECT SUM(netamount) as total, COUNT(*) as count FROM public.slips WHERE orgcode = $1 AND date::date = CURRENT_DATE",
      [orgcode]
    );
    const revenueToday = parseFloat(todaySlipsResult.rows[0]?.total || "0");
    const slipsToday = parseInt(todaySlipsResult.rows[0]?.count || "0", 10);

    // 3. Today's Payments
    const todayPaymentsResult = await query(
      "SELECT SUM(amount) as total FROM public.payments WHERE orgcode = $1 AND date::date = CURRENT_DATE",
      [orgcode]
    );
    const paymentsToday = parseFloat(todayPaymentsResult.rows[0]?.total || "0");

    // 4. Today's Returns
    const todayReturnsResult = await query(
      `SELECT SUM(ABS(i.amount)) as total 
       FROM public.slipitems i 
       JOIN public.slips s ON i.id = s.id 
       WHERE s.orgcode = $1 AND s.date::date = CURRENT_DATE AND i.qty < 0`,
      [orgcode]
    );
    const returnsToday = parseFloat(todayReturnsResult.rows[0]?.total || "0");

    // 5. 7-Day Trend Chart Data
    const trendResult = await query(
      `WITH dates AS (
         SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day')::date AS d
       ),
       daily_slips AS (
         SELECT date::date as d, SUM(netamount) as revenue 
         FROM public.slips 
         WHERE orgcode = $1 AND date::date >= CURRENT_DATE - INTERVAL '6 days'
         GROUP BY date::date
       ),
       daily_payments AS (
         SELECT date::date as d, SUM(amount) as payment 
         FROM public.payments 
         WHERE orgcode = $1 AND date::date >= CURRENT_DATE - INTERVAL '6 days'
         GROUP BY date::date
       ),
       daily_returns AS (
         SELECT s.date::date as d, SUM(ABS(i.amount)) as returns
         FROM public.slipitems i
         JOIN public.slips s ON i.id = s.id
         WHERE s.orgcode = $1 AND s.date::date >= CURRENT_DATE - INTERVAL '6 days' AND i.qty < 0
         GROUP BY s.date::date
       )
       SELECT 
         to_char(dates.d, 'Mon DD') as name,
         COALESCE(s.revenue, 0) as revenue,
         COALESCE(p.payment, 0) as payment,
         COALESCE(r.returns, 0) as returns
       FROM dates
       LEFT JOIN daily_slips s ON dates.d = s.d
       LEFT JOIN daily_payments p ON dates.d = p.d
       LEFT JOIN daily_returns r ON dates.d = r.d
       ORDER BY dates.d ASC`,
      [orgcode]
    );

    // 6. Top Debtors
    const debtorsResult = await query(
      `WITH slip_sums AS (
         SELECT phone, MAX(name) as name, SUM(netamount) as total_slips
         FROM public.slips
         WHERE orgcode = $1
         GROUP BY phone
       ),
       pay_sums AS (
         SELECT phone, SUM(amount) as total_payments
         FROM public.payments
         WHERE orgcode = $1
         GROUP BY phone
       )
       SELECT s.name, s.phone, (COALESCE(s.total_slips, 0) - COALESCE(p.total_payments, 0)) as outstanding
       FROM slip_sums s
       LEFT JOIN pay_sums p ON s.phone = p.phone
       WHERE (COALESCE(s.total_slips, 0) - COALESCE(p.total_payments, 0)) > 0
       ORDER BY outstanding DESC
       LIMIT 5`,
      [orgcode]
    );

    // 7. Top Selling Items
    const topItemsResult = await query(
      `SELECT i.item, SUM(i.qty) as total_qty
       FROM public.slipitems i
       JOIN public.slips s ON i.id = s.id
       WHERE s.orgcode = $1 AND i.qty > 0
       GROUP BY i.item
       ORDER BY total_qty DESC
       LIMIT 5`,
      [orgcode]
    );

    return NextResponse.json({
      success: true,
      kpis: {
        totalOutstanding,
        revenueToday,
        paymentsToday,
        returnsToday,
        slipsToday,
      },
      trend: trendResult.rows.map(row => ({
        name: row.name,
        revenue: parseFloat(row.revenue),
        payment: parseFloat(row.payment),
        returns: parseFloat(row.returns)
      })),
      topDebtors: debtorsResult.rows.map(row => ({
        name: row.name || 'Unknown',
        phone: row.phone,
        outstanding: parseFloat(row.outstanding)
      })),
      topItems: topItemsResult.rows.map(row => ({
        item: row.item,
        total_qty: parseFloat(row.total_qty)
      }))
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
