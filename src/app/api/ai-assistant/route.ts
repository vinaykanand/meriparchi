import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Helper to normalize strings for comparison
const cleanString = (val: string) => val.trim().toLowerCase();

export async function POST(request: Request) {
  try {
    const { message, orgcode } = await request.json();

    if (!message || !orgcode) {
      return NextResponse.json({ success: false, message: "Missing message or orgcode" }, { status: 400 });
    }

    const cleanedMsg = cleanString(message);
    let reply = "";
    let suggestions: string[] = [];

    // --- INTENT 1: SLIP DETAILS SEARCH (e.g. "details for slip #8", "what is in slip 12") ---
    const slipNumberMatch = message.match(/(?:slip\s*(?:no|#)?\s*)(\d+)\b/i);
    if (slipNumberMatch) {
      const slipNo = parseInt(slipNumberMatch[1], 10);
      const slipDetails = await query(
        `SELECT s.id, s.name, s.phone, s.date, s.netamount, s.discount, s.totalamount
         FROM public.slips s
         WHERE s.orgcode = $1 AND s.slipno = $2
         LIMIT 1`,
        [orgcode, slipNo]
      );

      if (slipDetails.rows.length === 0) {
        reply = `I could not find any slip with number **#${slipNo}** in your organization.`;
      } else {
        const slip = slipDetails.rows[0];
        const items = await query(
          `SELECT item, qty, rate, remarks FROM public.slipitems WHERE id = $1`,
          [slip.id]
        );

        reply = `📄 **Slip #${slipNo} Details**\n`;
        reply += `- **Customer:** ${slip.name} (${slip.phone})\n`;
        reply += `- **Date:** ${new Date(slip.date).toLocaleDateString()}\n`;
        reply += `- **Subtotal:** ₹${parseFloat(slip.totalamount).toFixed(2)}\n`;
        if (parseFloat(slip.discount) > 0) {
          reply += `- **Discount:** ₹${parseFloat(slip.discount).toFixed(2)}\n`;
        }
        reply += `- **Net Amount:** **₹${parseFloat(slip.netamount).toFixed(2)}**\n\n`;
        reply += `**Items Listed:**\n`;
        
        items.rows.forEach((it: any) => {
          const amt = (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);
          reply += `- **${it.item}** (Qty: ${it.qty} | Rate: ₹${it.rate}) = **₹${amt.toFixed(2)}** ${it.remarks ? `*(${it.remarks})*` : ""}\n`;
        });
      }
      suggestions = ["Total Outstanding", "Show Top Debtors"];
    }

    // --- INTENT 2: BAD DEBTORS / RISK ANALYSIS (High outstanding over 60+ days) ---
    else if (
      cleanedMsg.includes("bad debtor") ||
      cleanedMsg.includes("worst debtor") ||
      cleanedMsg.includes("risky account") ||
      cleanedMsg.includes("bad debt") ||
      cleanedMsg.includes("overdue account")
    ) {
      // Calculate aging for all debtors
      const slipsResult = await query(
        `SELECT phone, netamount, date FROM public.slips WHERE orgcode = $1 ORDER BY phone, date ASC, id ASC`,
        [orgcode]
      );
      const paymentsResult = await query(
        `SELECT phone, COALESCE(SUM(amount), 0) as total_payments FROM public.payments WHERE orgcode = $1 GROUP BY phone`,
        [orgcode]
      );
      const customerNames = await query(
        `SELECT DISTINCT ON (phone) phone, name FROM public.slips WHERE orgcode = $1`,
        [orgcode]
      );

      const nameMap: Record<string, string> = {};
      customerNames.rows.forEach(r => { nameMap[r.phone] = r.name; });

      const paymentsMap: Record<string, number> = {};
      paymentsResult.rows.forEach((row: any) => {
        paymentsMap[row.phone] = parseFloat(row.total_payments) || 0;
      });

      const customerSlips: Record<string, any[]> = {};
      slipsResult.rows.forEach((slip: any) => {
        const phone = slip.phone;
        if (!customerSlips[phone]) customerSlips[phone] = [];
        customerSlips[phone].push({
          date: new Date(slip.date),
          netamount: parseFloat(slip.netamount) || 0
        });
      });

      const today = new Date();
      const riskyList = [];

      for (const phone of Object.keys(customerSlips)) {
        let remainingPayments = paymentsMap[phone] || 0;
        let aging_61_90 = 0;
        let aging_90_plus = 0;
        let totalDebt = 0;

        for (const slip of customerSlips[phone]) {
          if (remainingPayments >= slip.netamount) {
            remainingPayments -= slip.netamount;
          } else {
            const unpaid = slip.netamount - remainingPayments;
            remainingPayments = 0;
            totalDebt += unpaid;

            const diffDays = Math.max(0, Math.floor((today.getTime() - slip.date.getTime()) / (1000 * 60 * 60 * 24)));
            if (diffDays > 60 && diffDays <= 90) aging_61_90 += unpaid;
            else if (diffDays > 90) aging_90_plus += unpaid;
          }
        }

        const badDebtTotal = aging_61_90 + aging_90_plus;
        if (badDebtTotal > 0) {
          riskyList.push({
            name: nameMap[phone] || "Unknown",
            phone,
            totalDebt,
            badDebtTotal,
            aging_61_90,
            aging_90_plus
          });
        }
      }

      // Sort by bad debt (60+ days overdue) descending
      riskyList.sort((a, b) => b.badDebtTotal - a.badDebtTotal);

      if (riskyList.length === 0) {
        reply = "Great news! There are currently no accounts with outstanding balances overdue by more than 60 days.";
      } else {
        reply = "⚠️ **High-Risk Accounts (Overdue > 60 Days)**\n";
        reply += "These accounts require immediate follow-up as their balance remains outstanding beyond typical credit terms:\n\n";
        
        riskyList.forEach((cust, idx) => {
          reply += `${idx + 1}. **${cust.name}** (${cust.phone}):\n`;
          reply += `   - Overdue (>60 days): **₹${cust.badDebtTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}**\n`;
          if (cust.aging_90_plus > 0) {
            reply += `   - *Critical (>90 days):* ₹${cust.aging_90_plus.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
          }
          reply += `   - Total Balance: ₹${cust.totalDebt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
        });
      }
      suggestions = ["Show Aging Report", "Total Outstanding"];
    }

    // --- INTENT 3: TODAY'S RETURNS (e.g. "returns today", "returned items today") ---
    else if (
      cleanedMsg.includes("return") &&
      (cleanedMsg.includes("today") || cleanedMsg.includes("today's"))
    ) {
      const todayReturns = await query(
        `SELECT id, name, phone, netamount, date FROM public.slips 
         WHERE orgcode = $1 AND netamount < 0 AND date::date = CURRENT_DATE
         ORDER BY date DESC`,
        [orgcode]
      );

      if (todayReturns.rows.length === 0) {
        reply = "No return transactions or negative adjustments have been recorded today.";
      } else {
        reply = `💸 **Returns / Credit Adjustments Logged Today**\n\n`;
        todayReturns.rows.forEach((r: any) => {
          reply += `- **${r.name}** (${r.phone}): **₹${Math.abs(parseFloat(r.netamount)).toFixed(2)}** credited (Time: ${new Date(r.date).toLocaleTimeString()})\n`;
        });
      }
      suggestions = ["Today's Stats", "Total Outstanding"];
    }

    // --- INTENT 4: TOTAL OUTSTANDING ---
    else if (
      cleanedMsg.includes("total outstanding") ||
      cleanedMsg.includes("overall outstanding") ||
      cleanedMsg.includes("total debt") ||
      cleanedMsg.includes("overall balance")
    ) {
      const slipsSum = await query("SELECT COALESCE(SUM(netamount), 0) as total FROM public.slips WHERE orgcode = $1", [orgcode]);
      const paymentsSum = await query("SELECT COALESCE(SUM(amount), 0) as total FROM public.payments WHERE orgcode = $1", [orgcode]);
      
      const totalSlips = parseFloat(slipsSum.rows[0]?.total || "0");
      const totalPayments = parseFloat(paymentsSum.rows[0]?.total || "0");
      const outstanding = totalSlips - totalPayments;

      reply = `The total outstanding balance across all customers for your organization is **₹${outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}** (Total Slips Raised: ₹${totalSlips.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Total Payments Logged: ₹${totalPayments.toLocaleString('en-IN', { minimumFractionDigits: 2 })}).`;
      suggestions = ["Show Top Debtors", "Show Aging Report", "Today's Stats"];
    }

    // --- INTENT 5: TOP DEBTORS ---
    else if (
      cleanedMsg.includes("top debtor") ||
      cleanedMsg.includes("highest debt") ||
      cleanedMsg.includes("highest outstanding") ||
      cleanedMsg.includes("who owes the most")
    ) {
      const res = await query(
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
         SELECT s.phone, s.name, (COALESCE(s.total_slips, 0) - COALESCE(p.total_payments, 0)) as outstanding
         FROM slip_sums s
         LEFT JOIN pay_sums p ON s.phone = p.phone
         WHERE (COALESCE(s.total_slips, 0) - COALESCE(p.total_payments, 0)) > 0
         ORDER BY outstanding DESC
         LIMIT 3`,
        [orgcode]
      );

      if (res.rows.length === 0) {
        reply = "There are currently no customers with outstanding balances.";
      } else {
        reply = "Here are the top customers with the highest outstanding debt:\n\n" +
          res.rows.map((row: any, idx: number) => 
            `${idx + 1}. **${row.name}** (${row.phone}): **₹${parseFloat(row.outstanding).toLocaleString('en-IN', { minimumFractionDigits: 2 })}**`
          ).join("\n");
      }
      suggestions = ["Show Aging Report", "Total Outstanding"];
    }

    // --- INTENT 6: TODAY'S STATS ---
    else if (
      cleanedMsg.includes("today's stats") ||
      cleanedMsg.includes("today stats") ||
      cleanedMsg.includes("today's revenue") ||
      cleanedMsg.includes("today revenue") ||
      cleanedMsg.includes("created today")
    ) {
      const todaySlips = await query(
        "SELECT COALESCE(SUM(netamount), 0) as total, COUNT(*) as count FROM public.slips WHERE orgcode = $1 AND date::date = CURRENT_DATE",
        [orgcode]
      );
      const todayPayments = await query(
        "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM public.payments WHERE orgcode = $1 AND date::date = CURRENT_DATE",
        [orgcode]
      );

      const slipsTotal = parseFloat(todaySlips.rows[0]?.total || "0");
      const slipsCount = parseInt(todaySlips.rows[0]?.count || "0", 10);
      const paymentsTotal = parseFloat(todayPayments.rows[0]?.total || "0");
      const paymentsCount = parseInt(todayPayments.rows[0]?.count || "0", 10);

      reply = `Here is the activity summary for today:\n- **Revenue / New Slips:** ₹${slipsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${slipsCount} slips)\n- **Payments Logged:** ₹${paymentsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${paymentsCount} entries)`;
      suggestions = ["Total Outstanding", "Show Top Debtors"];
    }

    // --- INTENT 7: DEBT AGING REPORT ---
    else if (
      cleanedMsg.includes("aging report") ||
      cleanedMsg.includes("debt aging") ||
      cleanedMsg.includes("aging summary") ||
      cleanedMsg.includes("aging buckets")
    ) {
      const slipsResult = await query(
        `SELECT phone, netamount, date FROM public.slips WHERE orgcode = $1 ORDER BY phone, date ASC, id ASC`,
        [orgcode]
      );
      const paymentsResult = await query(
        `SELECT phone, COALESCE(SUM(amount), 0) as total_payments FROM public.payments WHERE orgcode = $1 GROUP BY phone`,
        [orgcode]
      );

      const paymentsMap: Record<string, number> = {};
      paymentsResult.rows.forEach((row: any) => {
        paymentsMap[row.phone] = parseFloat(row.total_payments) || 0;
      });

      const customerSlips: Record<string, any[]> = {};
      slipsResult.rows.forEach((slip: any) => {
        const phone = slip.phone;
        if (!customerSlips[phone]) customerSlips[phone] = [];
        customerSlips[phone].push({
          date: new Date(slip.date),
          netamount: parseFloat(slip.netamount) || 0
        });
      });

      const today = new Date();
      let aging_0_30 = 0;
      let aging_31_60 = 0;
      let aging_61_90 = 0;
      let aging_90_plus = 0;

      for (const phone of Object.keys(customerSlips)) {
        let remainingPayments = paymentsMap[phone] || 0;
        for (const slip of customerSlips[phone]) {
          if (remainingPayments >= slip.netamount) {
            remainingPayments -= slip.netamount;
          } else {
            const unpaid = slip.netamount - remainingPayments;
            remainingPayments = 0;

            const diffDays = Math.max(0, Math.floor((today.getTime() - slip.date.getTime()) / (1000 * 60 * 60 * 24)));
            if (diffDays <= 30) aging_0_30 += unpaid;
            else if (diffDays <= 60) aging_31_60 += unpaid;
            else if (diffDays <= 90) aging_61_90 += unpaid;
            else aging_90_plus += unpaid;
          }
        }
      }

      reply = `Here is the current Debt Aging Summary:\n- **0–30 Days (Current):** ₹${aging_0_30.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n- **31–60 Days:** ₹${aging_31_60.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n- **61–90 Days:** ₹${aging_61_90.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n- **90+ Days (High Risk):** ₹${aging_90_plus.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      suggestions = ["Show Top Debtors", "Total Outstanding"];
    }

    // --- INTENT 8: INVENTORY & SALES INSIGHTS (Item Popularity) ---
    else if (
      cleanedMsg.includes("most sold") ||
      cleanedMsg.includes("top items") ||
      cleanedMsg.includes("popular item") ||
      cleanedMsg.includes("most popular") ||
      cleanedMsg.includes("highest revenue item") ||
      cleanedMsg.includes("item revenue") ||
      cleanedMsg.includes("top products")
    ) {
      if (cleanedMsg.includes("revenue") || cleanedMsg.includes("value") || cleanedMsg.includes("earnings")) {
        const topRevItems = await query(
          `SELECT item, SUM(qty * rate) as total_revenue, SUM(qty) as total_qty
           FROM public.slipitems 
           WHERE orgcode = $1 
           GROUP BY item 
           ORDER BY total_revenue DESC 
           LIMIT 5`,
          [orgcode]
        );

        if (topRevItems.rows.length === 0) {
          reply = "No inventory sales records found to analyze product revenue.";
        } else {
          reply = `💰 **Top Products by Revenue Generated**\n\n`;
          topRevItems.rows.forEach((row: any, idx: number) => {
            reply += `${idx + 1}. **${row.item}**: **₹${parseFloat(row.total_revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}** (Qty Sold: ${row.total_qty})\n`;
          });
        }
      } else {
        const topSoldItems = await query(
          `SELECT item, SUM(qty) as total_qty, COUNT(*) as sales_count 
           FROM public.slipitems 
           WHERE orgcode = $1 
           GROUP BY item 
           ORDER BY total_qty DESC 
           LIMIT 5`,
          [orgcode]
        );

        if (topSoldItems.rows.length === 0) {
          reply = "No inventory sales records found to analyze product volume.";
        } else {
          reply = `📦 **Most Sold Products by Quantity**\n\n`;
          topSoldItems.rows.forEach((row: any, idx: number) => {
            reply += `${idx + 1}. **${row.item}**: **${row.total_qty} units** sold (across ${row.sales_count} slips)\n`;
          });
        }
      }
      suggestions = ["Today's Stats", "Total Outstanding"];
    }

    // --- INTENT 9: LOCATION-BASED OUTSTANDING (GEOGRAPHIC ANALYSIS) ---
    else if (
      cleanedMsg.includes("location") ||
      cleanedMsg.includes("area") ||
      cleanedMsg.includes("city") ||
      cleanedMsg.includes("outstanding in") ||
      cleanedMsg.includes("balance in") ||
      cleanedMsg.includes("debt in")
    ) {
      // Check if they specified a location (e.g. "outstanding in Phagwara")
      const locationMatch = message.match(/(?:outstanding|balance|debt)\s+in\s+([a-zA-Z0-9\s]+)/i) || message.match(/in\s+([a-zA-Z0-9\s]+)\s+(?:outstanding|balance|debt)/i);
      
      if (locationMatch) {
        const locationKeyword = locationMatch[1].trim();
        const locDetails = await query(
          `WITH customer_slips AS (
             SELECT phone, MAX(name) as name, MAX(address) as addr, SUM(netamount) as total_slips
             FROM public.slips
             WHERE orgcode = $1
             GROUP BY phone
           ),
           customer_payments AS (
             SELECT phone, SUM(amount) as total_payments
             FROM public.payments
             WHERE orgcode = $1
             GROUP BY phone
           )
           SELECT 
             s.phone, s.name, s.addr,
             (COALESCE(s.total_slips, 0) - COALESCE(p.total_payments, 0)) as outstanding
           FROM customer_slips s
           LEFT JOIN customer_payments p ON s.phone = p.phone
           WHERE s.addr ILIKE $2 AND (COALESCE(s.total_slips, 0) - COALESCE(p.total_payments, 0)) > 0
           ORDER BY outstanding DESC`,
          [orgcode, `%${locationKeyword}%`]
        );

        if (locDetails.rows.length === 0) {
          reply = `No accounts with an active outstanding balance were found matching the location **"${locationKeyword}"**.`;
        } else {
          reply = `📍 **Outstanding Balances in "${locationKeyword}"**\n\n`;
          let locSum = 0;
          locDetails.rows.forEach((row: any) => {
            reply += `- **${row.name}** (${row.phone}): **₹${parseFloat(row.outstanding).toLocaleString('en-IN', { minimumFractionDigits: 2 })}**\n   *Address:* ${row.addr || "N/A"}\n`;
            locSum += parseFloat(row.outstanding);
          });
          reply += `\n**Total Outstanding for Area:** **₹${locSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}**`;
        }
      } else {
        // General geographical breakdown
        const geoBreakdown = await query(
          `WITH customer_slips AS (
             SELECT phone, MAX(address) as addr, SUM(netamount) as total_slips
             FROM public.slips
             WHERE orgcode = $1
             GROUP BY phone
           ),
           customer_payments AS (
             SELECT phone, SUM(amount) as total_payments
             FROM public.payments
             WHERE orgcode = $1
             GROUP BY phone
           )
           SELECT 
             COALESCE(NULLIF(TRIM(s.addr), ''), 'No Address Specified') as location,
             SUM(COALESCE(s.total_slips, 0) - COALESCE(p.total_payments, 0)) as outstanding
           FROM customer_slips s
           LEFT JOIN customer_payments p ON s.phone = p.phone
           GROUP BY location
           HAVING SUM(COALESCE(s.total_slips, 0) - COALESCE(p.total_payments, 0)) > 0
           ORDER BY outstanding DESC
           LIMIT 5`,
          [orgcode]
        );

        if (geoBreakdown.rows.length === 0) {
          reply = "No active customer debt records found to map geographical outstanding.";
        } else {
          reply = `📍 **Top Locations by Outstanding Balances**\n\n`;
          geoBreakdown.rows.forEach((row: any, idx: number) => {
            reply += `${idx + 1}. **${row.location}**: **₹${parseFloat(row.outstanding).toLocaleString('en-IN', { minimumFractionDigits: 2 })}** outstanding\n`;
          });
        }
      }
      suggestions = ["Show Top Debtors", "Total Outstanding"];
    }

    // --- INTENT 10: CUSTOMER ACTIVITY & COLLECTION ALERTS ---
    else if (
      cleanedMsg.includes("hasn't paid") ||
      cleanedMsg.includes("no payment") ||
      cleanedMsg.includes("inactive customer") ||
      cleanedMsg.includes("not paid") ||
      cleanedMsg.includes("idle customer") ||
      cleanedMsg.includes("idle accounts") ||
      cleanedMsg.includes("collection alert")
    ) {
      const inactiveCustomers = await query(
        `WITH customer_outstanding AS (
           SELECT s.phone, MAX(s.name) as name, MAX(s.address) as addr, 
                  (SUM(s.netamount) - COALESCE((SELECT SUM(amount) FROM public.payments p WHERE p.orgcode = $1 AND p.phone = s.phone), 0)) as outstanding
           FROM public.slips s
           WHERE s.orgcode = $1
           GROUP BY s.phone
         )
         SELECT co.name, co.phone, co.outstanding, 
                (SELECT MAX(date) FROM public.payments p WHERE p.orgcode = $1 AND p.phone = co.phone) as last_payment_date
         FROM customer_outstanding co
         WHERE co.outstanding > 0 
           AND (
             (SELECT MAX(date) FROM public.payments p WHERE p.orgcode = $1 AND p.phone = co.phone) IS NULL 
             OR (SELECT MAX(date) FROM public.payments p WHERE p.orgcode = $1 AND p.phone = co.phone) < CURRENT_DATE - INTERVAL '30 days'
           )
         ORDER BY co.outstanding DESC
         LIMIT 5`,
        [orgcode]
      );

      if (inactiveCustomers.rows.length === 0) {
        reply = "Excellent! All debtors with active outstanding balances have made a payment within the last 30 days.";
      } else {
        reply = `⚠️ **Debtors with No Payments in the Last 30+ Days**\n\n`;
        inactiveCustomers.rows.forEach((cust: any, idx: number) => {
          const daysStr = cust.last_payment_date 
            ? `${Math.floor((new Date().getTime() - new Date(cust.last_payment_date).getTime()) / (1000 * 60 * 60 * 24))} days ago`
            : "Never Paid";
          reply += `${idx + 1}. **${cust.name}** (${cust.phone}):\n`;
          reply += `   - Outstanding: **₹${parseFloat(cust.outstanding).toLocaleString('en-IN', { minimumFractionDigits: 2 })}**\n`;
          reply += `   - Last Payment: **${daysStr}** (${cust.last_payment_date ? new Date(cust.last_payment_date).toLocaleDateString() : "No record"})\n`;
        });
      }
      suggestions = ["Show Aging Report", "Total Outstanding"];
    }

    // --- INTENT 11: COMPARATIVE PERIODS (WEEK-OVER-WEEK / MONTH-OVER-MONTH) ---
    else if (
      cleanedMsg.includes("vs") ||
      cleanedMsg.includes("compared to") ||
      cleanedMsg.includes("revenue compared") ||
      cleanedMsg.includes("collection compared") ||
      cleanedMsg.includes("this month vs") ||
      cleanedMsg.includes("this week vs")
    ) {
      // Weekly Revenue / Sales comparison
      const weeklySlips = await query(
        `SELECT 
           COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '7 days' THEN netamount ELSE 0 END), 0) as this_week,
           COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '14 days' AND date < CURRENT_DATE - INTERVAL '7 days' THEN netamount ELSE 0 END), 0) as last_week
         FROM public.slips
         WHERE orgcode = $1`,
        [orgcode]
      );
      
      const weeklyPayments = await query(
        `SELECT 
           COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '7 days' THEN amount ELSE 0 END), 0) as this_week,
           COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '14 days' AND date < CURRENT_DATE - INTERVAL '7 days' THEN amount ELSE 0 END), 0) as last_week
         FROM public.payments
         WHERE orgcode = $1`,
        [orgcode]
      );

      const sThis = parseFloat(weeklySlips.rows[0].this_week);
      const sLast = parseFloat(weeklySlips.rows[0].last_week);
      const pThis = parseFloat(weeklyPayments.rows[0].this_week);
      const pLast = parseFloat(weeklyPayments.rows[0].last_week);

      const sDiff = sThis - sLast;
      const pDiff = pThis - pLast;

      reply = `📊 **Weekly Comparative Stats (Last 7 Days vs Previous 7 Days)**\n\n`;
      reply += `* **Revenue Generated (New Slips):**\n`;
      reply += `  - This Week: ₹${sThis.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
      reply += `  - Previous Week: ₹${sLast.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
      reply += `  - Trend: **${sDiff >= 0 ? "📈 Up" : "📉 Down"}** by ₹${Math.abs(sDiff).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n`;
      reply += `* **Collections Received (Payments):**\n`;
      reply += `  - This Week: ₹${pThis.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
      reply += `  - Previous Week: ₹${pLast.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
      reply += `  - Trend: **${pDiff >= 0 ? "📈 Up" : "📉 Down"}** by ₹${Math.abs(pDiff).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;

      suggestions = ["Today's Stats", "Total Outstanding"];
    }

    // --- INTENT 12: SLIP & VALUE INQUIRIES (Largest slips or payments) ---
    else if (
      cleanedMsg.includes("largest") ||
      cleanedMsg.includes("biggest") ||
      cleanedMsg.includes("highest") ||
      cleanedMsg.includes("maximum") ||
      cleanedMsg.includes("max slip") ||
      cleanedMsg.includes("max payment")
    ) {
      if (cleanedMsg.includes("payment") || cleanedMsg.includes("receipt") || cleanedMsg.includes("collection")) {
        const maxPay = await query(
          `SELECT phone, amount, date, narration 
           FROM public.payments 
           WHERE orgcode = $1 
           ORDER BY amount DESC 
           LIMIT 1`,
          [orgcode]
        );

        if (maxPay.rows.length === 0) {
          reply = "No payment records found to locate the largest payment transaction.";
        } else {
          const pay = maxPay.rows[0];
          // Find customer name
          const custName = await query("SELECT name FROM public.slips WHERE orgcode = $1 AND phone = $2 LIMIT 1", [orgcode, pay.phone]);
          const name = custName.rows[0]?.name || "Unknown Customer";
          reply = `💰 **Largest Single Payment Logged**\n\n`;
          reply += `- **Customer:** ${name} (${pay.phone})\n`;
          reply += `- **Amount:** **₹${parseFloat(pay.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}**\n`;
          reply += `- **Date:** ${new Date(pay.date).toLocaleDateString()}\n`;
          reply += `- **Remarks:** *"${pay.narration || "No remarks provided"}*"`;
        }
      } else {
        const maxSlip = await query(
          `SELECT slipno, name, phone, netamount, date 
           FROM public.slips 
           WHERE orgcode = $1 
           ORDER BY netamount DESC 
           LIMIT 1`,
          [orgcode]
        );

        if (maxSlip.rows.length === 0) {
          reply = "No invoice/slip records found to locate the largest slip transaction.";
        } else {
          const slip = maxSlip.rows[0];
          reply = `📄 **Largest Single Billing Slip Raised**\n\n`;
          reply += `- **Slip Number:** #${slip.slipno}\n`;
          reply += `- **Customer:** ${slip.name} (${slip.phone})\n`;
          reply += `- **Amount:** **₹${parseFloat(slip.netamount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}**\n`;
          reply += `- **Date:** ${new Date(slip.date).toLocaleDateString()}`;
        }
      }
      suggestions = ["Show Top Debtors", "Total Outstanding"];
    }

    // --- INTENT 13: CUSTOMER INQUIRY (Outstanding, Payments, or Returns) ---
    else {
      // Try to find a phone number or customer name in the query
      const phoneMatch = message.match(/\b\d{10}\b/);
      let customerPhone = phoneMatch ? phoneMatch[0] : "";
      let foundCustomer: any = null;

      if (customerPhone) {
        const custCheck = await query(
          "SELECT name, phone, address FROM public.slips WHERE orgcode = $1 AND phone = $2 LIMIT 1",
          [orgcode, customerPhone]
        );
        if (custCheck.rows.length > 0) {
          foundCustomer = custCheck.rows[0];
        }
      } else {
        // Try matching by name
        const words = message.split(/\s+/).map((w: string) => w.replace(/[^a-zA-Z0-9]/g, "")).filter((w: string) => w.length > 2);
        for (const word of words) {
          const custCheck = await query(
            "SELECT name, phone, address FROM public.slips WHERE orgcode = $1 AND name ILIKE $2 LIMIT 1",
            [orgcode, `%${word}%`]
          );
          if (custCheck.rows.length > 0) {
            foundCustomer = custCheck.rows[0];
            customerPhone = foundCustomer.phone;
            break;
          }
        }
      }

      if (foundCustomer && customerPhone) {
        const totalSlips = await query("SELECT COALESCE(SUM(netamount), 0) as total FROM public.slips WHERE orgcode = $1 AND phone = $2", [orgcode, customerPhone]);
        const totalPayments = await query("SELECT COALESCE(SUM(amount), 0) as total FROM public.payments WHERE orgcode = $1 AND phone = $2", [orgcode, customerPhone]);

        const slipsVal = parseFloat(totalSlips.rows[0]?.total || "0");
        const paymentsVal = parseFloat(totalPayments.rows[0]?.total || "0");
        const outstandingVal = slipsVal - paymentsVal;

        // Sub-Intent A: Returns for customer
        if (cleanedMsg.includes("return") || cleanedMsg.includes("refund") || cleanedMsg.includes("credit")) {
          const recentReturns = await query(
            `SELECT id, slipno, date, netamount FROM public.slips 
             WHERE orgcode = $1 AND phone = $2 AND netamount < 0 
             ORDER BY date DESC LIMIT 5`,
            [orgcode, customerPhone]
          );

          reply = `🔄 **Returns Logged for ${foundCustomer.name}**\n\n`;
          if (recentReturns.rows.length === 0) {
            reply += `No return orders or credited adjustments found for this customer account.`;
          } else {
            reply += `Found ${recentReturns.rows.length} return(s):\n` + recentReturns.rows.map((r: any) =>
              `- **Slip #${r.slipno}**: ₹${Math.abs(parseFloat(r.netamount)).toFixed(2)} credited on ${new Date(r.date).toLocaleDateString()}`
            ).join("\n");
          }
        } 
        // Sub-Intent B: Payments for customer
        else if (cleanedMsg.includes("payment") || cleanedMsg.includes("paid") || cleanedMsg.includes("receipt")) {
          const recentPayments = await query(
            "SELECT amount, date, narration FROM public.payments WHERE orgcode = $1 AND phone = $2 ORDER BY date DESC LIMIT 3",
            [orgcode, customerPhone]
          );

          reply = `**${foundCustomer.name}** has paid a total of **₹${paymentsVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}**. `;
          if (recentPayments.rows.length > 0) {
            reply += "\n\nRecent Payments:\n" + recentPayments.rows.map((r: any) => 
              `- ₹${parseFloat(r.amount).toFixed(2)} on ${new Date(r.date).toLocaleDateString()} (${r.narration || "No remarks"})`
            ).join("\n");
          } else {
            reply += "No payments recorded yet.";
          }
        } 
        // Sub-Intent C: General Outstanding details
        else {
          reply = `Account details for **${foundCustomer.name}** (Phone: ${customerPhone}):\n- **Total Slips:** ₹${slipsVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n- **Total Paid:** ₹${paymentsVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n- **Outstanding Balance:** **₹${outstandingVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}**`;
          if (outstandingVal > 0) {
            reply += `\n\n*(This account has an active debt)*`;
          } else if (outstandingVal < 0) {
            reply += `\n\n*(This account has an advance credit of ₹${Math.abs(outstandingVal).toFixed(2)})*`;
          } else {
            reply += `\n\n*(Account is fully paid and settled)*`;
          }
        }
        suggestions = [`Outstanding for ${foundCustomer.name}`, `Payments for ${foundCustomer.name}`, `Returns for ${foundCustomer.name}`, "Total Outstanding"];
      } else {
        // Fallback response / help manual
        reply = `Hello! I am your **AI Assistant**. I can help you search ledgers and analyze details in real time.\n\n**Here are examples of what you can ask me:**\n- *"What is the total outstanding?"*\n- *"Who is the top debtor?"* or *"risky accounts"* (bad debtors)\n- *"Show details for slip #8"*\n- *"What returns were logged today?"*\n- *"Returns for [Customer Name]"*\n- *"Outstanding for [Customer Name or Phone]"*\n- *"Show payments made by [Customer Name or Phone]"*`;
        suggestions = ["Total Outstanding", "Show Top Debtors", "risky accounts", "Show Aging Report", "Today's Stats"];
      }
    }

    return NextResponse.json({
      success: true,
      reply,
      suggestions
    });

  } catch (error: any) {
    console.error("AI Assistant Route Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server Error" }, { status: 500 });
  }
}
