import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { checkAndTriggerBackup } from "@/lib/scheduler";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");
    const weekOffset = parseInt(searchParams.get("weekOffset") || "0", 10);

    if (!orgcode) {
      return NextResponse.json({ success: false, message: "Missing orgcode" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    const sessionOrgcode = cookieStore.get("orgcode")?.value;

    if (!authtoken || !sessionOrgcode) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Verify user is active
    const userCheck = await query(
      "SELECT issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
      [authtoken, sessionOrgcode]
    );

    if (userCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { issuperadmin } = userCheck.rows[0];
    if (!issuperadmin && sessionOrgcode !== orgcode) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    // Trigger lazy automatic backup check
    checkAndTriggerBackup(orgcode).catch((err) => console.error("Scheduler trigger failed:", err));

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
          SELECT generate_series((CURRENT_DATE + ($2 * 7)) - INTERVAL '6 days', CURRENT_DATE + ($2 * 7), '1 day')::date AS d
       ),
       daily_slips AS (
          SELECT date::date as d, SUM(netamount) as revenue 
          FROM public.slips 
          WHERE orgcode = $1 AND date::date BETWEEN (CURRENT_DATE + ($2 * 7)) - INTERVAL '6 days' AND CURRENT_DATE + ($2 * 7)
          GROUP BY date::date
       ),
       daily_payments AS (
          SELECT date::date as d, SUM(amount) as payment 
          FROM public.payments 
          WHERE orgcode = $1 AND date::date BETWEEN (CURRENT_DATE + ($2 * 7)) - INTERVAL '6 days' AND CURRENT_DATE + ($2 * 7)
          GROUP BY date::date
       ),
       daily_returns AS (
          SELECT s.date::date as d, SUM(ABS(i.amount)) as returns
          FROM public.slipitems i
          JOIN public.slips s ON i.id = s.id
          WHERE s.orgcode = $1 
            AND s.date::date BETWEEN (CURRENT_DATE + ($2 * 7)) - INTERVAL '6 days' AND CURRENT_DATE + ($2 * 7) 
            AND i.qty < 0
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
      [orgcode, weekOffset]
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

    // Check subscription / inventory
    const subCheck = await query(
      "SELECT subscription_type FROM public.company_subscriptions WHERE orgcode = $1",
      [orgcode]
    );
    const subscriptionType = subCheck.rows[0]?.subscription_type || "trial";
    const hasInventory = subscriptionType === "trial" || subscriptionType.endsWith("_inventory");

    let vouchers: any[] = [];
    let lowStockItems: any[] = [];

    if (hasInventory) {
      // 1. Last 20 vouchers
      const vouchersResult = await query(
        `SELECT 
          h.id, 
          h.transaction_date, 
          h.party_name, 
          h.reference_no, 
          t.name as type_name, 
          t.stock_effect,
          fl.name as from_location_name,
          tl.name as to_location_name,
          (SELECT COUNT(*) FROM public.inventory_transaction_details d WHERE d.transaction_header_id = h.id) as items_count,
          (SELECT COALESCE(SUM(qty), 0) FROM public.inventory_transaction_details d WHERE d.transaction_header_id = h.id) as total_qty
        FROM public.inventory_transaction_headers h
        JOIN public.inventory_transaction_types t ON h.transaction_type_id = t.id
        LEFT JOIN public.inventory_locations fl ON h.from_location_id = fl.id
        LEFT JOIN public.inventory_locations tl ON h.to_location_id = tl.id
        WHERE h.orgcode = $1
        ORDER BY h.transaction_date DESC, h.id DESC
        LIMIT 20`,
        [orgcode]
      );
      vouchers = vouchersResult.rows.map(row => ({
        id: row.id,
        date: row.transaction_date,
        partyName: row.party_name,
        referenceNo: row.reference_no,
        typeName: row.type_name,
        stockEffect: row.stock_effect,
        fromLocationName: row.from_location_name,
        toLocationName: row.to_location_name,
        itemsCount: parseInt(row.items_count, 10),
        totalQty: parseFloat(row.total_qty)
      }));

      // 2. Items at/below reorder level
      const lowStockResult = await query(
        `WITH item_balances AS (
          SELECT i.id, i.sku, i.name, i.reorder_level,
                 COALESCE(
                   (SELECT SUM(opening_qty) FROM public.inventory_balances WHERE orgcode = $1 AND item_id = i.id),
                   0
                 ) +
                 COALESCE(
                   (SELECT SUM(d.qty) 
                    FROM public.inventory_transaction_details d 
                    JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id 
                    WHERE h.orgcode = $1 AND d.item_id = i.id AND h.to_location_id IS NOT NULL),
                   0
                 ) -
                 COALESCE(
                   (SELECT SUM(d.qty) 
                    FROM public.inventory_transaction_details d 
                    JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id 
                    WHERE h.orgcode = $1 AND d.item_id = i.id AND h.from_location_id IS NOT NULL),
                   0
                 ) as current_balance
          FROM public.inventory_items i 
          WHERE i.orgcode = $1
        )
        SELECT sku, name, reorder_level, current_balance
        FROM item_balances
        WHERE current_balance <= reorder_level
        ORDER BY name ASC`,
        [orgcode]
      );
      lowStockItems = lowStockResult.rows.map(row => ({
        sku: row.sku,
        name: row.name,
        reorderLevel: parseFloat(row.reorder_level),
        currentBalance: parseFloat(row.current_balance)
      }));
    }

    // 8. Debt Aging Analysis Summary
    const slipsAgingResult = await query(
      `SELECT phone, date, netamount 
       FROM public.slips 
       WHERE orgcode = $1 
       ORDER BY phone, date ASC, id ASC`,
      [orgcode]
    );
    const paymentsAgingResult = await query(
      `SELECT phone, COALESCE(SUM(amount), 0) as total_payments 
       FROM public.payments 
       WHERE orgcode = $1 
       GROUP BY phone`,
      [orgcode]
    );

    const paymentsAgingMap: Record<string, number> = {};
    paymentsAgingResult.rows.forEach((row: any) => {
      paymentsAgingMap[row.phone] = parseFloat(row.total_payments) || 0;
    });

    const customerAgingSlips: Record<string, any[]> = {};
    slipsAgingResult.rows.forEach((slip: any) => {
      const phone = slip.phone;
      if (!customerAgingSlips[phone]) {
        customerAgingSlips[phone] = [];
      }
      customerAgingSlips[phone].push({
        date: new Date(slip.date),
        netamount: parseFloat(slip.netamount) || 0
      });
    });

    const agingToday = new Date();
    let aging_0_30 = 0;
    let aging_31_60 = 0;
    let aging_61_90 = 0;
    let aging_90_plus = 0;

    for (const phone of Object.keys(customerAgingSlips)) {
      const slips = customerAgingSlips[phone];
      let remainingPayments = paymentsAgingMap[phone] || 0;

      for (const slip of slips) {
        if (remainingPayments >= slip.netamount) {
          remainingPayments -= slip.netamount;
        } else {
          const unpaid = slip.netamount - remainingPayments;
          remainingPayments = 0;

          const diffTime = agingToday.getTime() - slip.date.getTime();
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
    }

    const debtAgingSummary = {
      aging_0_30,
      aging_31_60,
      aging_61_90,
      aging_90_plus,
      total: aging_0_30 + aging_31_60 + aging_61_90 + aging_90_plus
    };

    return NextResponse.json({
      success: true,
      hasInventory,
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
      })),
      vouchers,
      lowStockItems,
      debtAgingSummary
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
