import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");
    const filter = searchParams.get("filter");
    
    if (!orgcode) {
      return NextResponse.json({ success: false, message: "Missing orgcode" }, { status: 400 });
    }

    if (!filter) {
      return NextResponse.json({ success: false, message: "Missing filter parameter" }, { status: 400 });
    }

    let results = [];

    if (filter === "zero_outstanding") {
      const dbResult = await query(
        `WITH slip_sums AS (
           SELECT phone, MAX(name) as name, MAX(address) as address, SUM(netamount) as total_slips
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
         SELECT s.phone, s.name, s.address, (COALESCE(s.total_slips, 0) - COALESCE(p.total_payments, 0)) as outstanding
         FROM slip_sums s
         LEFT JOIN pay_sums p ON s.phone = p.phone
         WHERE (COALESCE(s.total_slips, 0) - COALESCE(p.total_payments, 0)) = 0
         ORDER BY s.name ASC`,
        [orgcode]
      );
      results = dbResult.rows;
    } else if (filter === "no_activity") {
      const days = parseInt(searchParams.get("days") || "30", 10);
      
      const dbResult = await query(
        `WITH last_slips AS (
           SELECT phone, MAX(name) as name, MAX(address) as address, MAX(date) as last_slip_date, SUM(netamount) as total_slips
           FROM public.slips
           WHERE orgcode = $1
           GROUP BY phone
         ),
         last_payments AS (
           SELECT phone, MAX(date) as last_payment_date, SUM(amount) as total_payments
           FROM public.payments
           WHERE orgcode = $1
           GROUP BY phone
         )
         SELECT s.phone, s.name, s.address, s.last_slip_date, p.last_payment_date,
                GREATEST(s.last_slip_date, p.last_payment_date) as last_activity,
                (COALESCE(s.total_slips, 0) - COALESCE(p.total_payments, 0)) as outstanding
         FROM last_slips s
         LEFT JOIN last_payments p ON s.phone = p.phone
         WHERE GREATEST(s.last_slip_date, p.last_payment_date) < CURRENT_DATE - $2::interval
         ORDER BY last_activity DESC`,
        [orgcode, `${days} days`]
      );
      results = dbResult.rows;
    } else {
      return NextResponse.json({ success: false, message: "Invalid filter type" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: results
    });

  } catch (error: any) {
    console.error("Reports API Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
