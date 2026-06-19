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
    } else if (filter === "debt_aging") {
      const slipsResult = await query(
        `SELECT phone, name, address, date, netamount 
         FROM public.slips 
         WHERE orgcode = $1 
         ORDER BY phone, date ASC, id ASC`,
        [orgcode]
      );
      const paymentsResult = await query(
        `SELECT phone, COALESCE(SUM(amount), 0) as total_payments 
         FROM public.payments 
         WHERE orgcode = $1 
         GROUP BY phone`,
        [orgcode]
      );

      const paymentsMap: Record<string, number> = {};
      paymentsResult.rows.forEach((row: any) => {
        paymentsMap[row.phone] = parseFloat(row.total_payments) || 0;
      });

      const customerSlips: Record<string, { name: string; address: string; phone: string; slips: any[] }> = {};
      slipsResult.rows.forEach((slip: any) => {
        const phone = slip.phone;
        if (!customerSlips[phone]) {
          customerSlips[phone] = {
            phone,
            name: slip.name || "Unknown",
            address: slip.address || "",
            slips: []
          };
        }
        customerSlips[phone].slips.push({
          date: new Date(slip.date),
          netamount: parseFloat(slip.netamount) || 0
        });
      });

      const today = new Date();
      const agingResults = [];

      for (const phone of Object.keys(customerSlips)) {
        const cust = customerSlips[phone];
        let remainingPayments = paymentsMap[phone] || 0;
        
        let aging_0_30 = 0;
        let aging_31_60 = 0;
        let aging_61_90 = 0;
        let aging_90_plus = 0;

        for (const slip of cust.slips) {
          if (remainingPayments >= slip.netamount) {
            remainingPayments -= slip.netamount;
          } else {
            const unpaid = slip.netamount - remainingPayments;
            remainingPayments = 0;

            const diffTime = today.getTime() - slip.date.getTime();
            const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

            if (diffDays <= 30) {
              aging_0_30 += unpaid;
            } else if (diffDays <= 60) {
              aging_31_60 += unpaid;
            } else if (diffDays <= 90) {
              aging_61_90 += unpaid;
            } else {
              aging_90_plus += unpaid;
            }
          }
        }

        const totalOutstanding = aging_0_30 + aging_31_60 + aging_61_90 + aging_90_plus;
        if (totalOutstanding > 0) {
          agingResults.push({
            phone,
            name: cust.name,
            address: cust.address,
            outstanding: totalOutstanding,
            aging_0_30,
            aging_31_60,
            aging_61_90,
            aging_90_plus
          });
        }
      }

      results = agingResults;
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
