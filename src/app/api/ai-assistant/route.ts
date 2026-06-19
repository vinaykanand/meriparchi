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

    // --- INTENT 1: TOTAL OUTSTANDING ---
    if (
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

    // --- INTENT 2: TOP DEBTORS ---
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

    // --- INTENT 3: TODAY'S STATS ---
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

    // --- INTENT 4: DEBT AGING REPORT ---
    else if (
      cleanedMsg.includes("aging report") ||
      cleanedMsg.includes("debt aging") ||
      cleanedMsg.includes("aging summary") ||
      cleanedMsg.includes("aging buckets")
    ) {
      // Fetch all slips and payments to replicate aging logic
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

    // --- INTENT 5: CUSTOMER INQUIRY (Outstanding or Payments) ---
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
        // We'll extract words and see if any word matches a customer name
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

        if (cleanedMsg.includes("payment") || cleanedMsg.includes("paid") || cleanedMsg.includes("receipt")) {
          // List payments
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
        } else {
          // Default to outstanding
          reply = `Account details for **${foundCustomer.name}** (Phone: ${customerPhone}):\n- **Total Slips:** ₹${slipsVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n- **Total Paid:** ₹${paymentsVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n- **Outstanding Balance:** **₹${outstandingVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}**`;
          if (outstandingVal > 0) {
            reply += `\n\n*(This account has an active debt)*`;
          } else if (outstandingVal < 0) {
            reply += `\n\n*(This account has an advance credit of ₹${Math.abs(outstandingVal).toFixed(2)})*`;
          } else {
            reply += `\n\n*(Account is fully paid and settled)*`;
          }
        }
        suggestions = [`Outstanding for ${foundCustomer.name}`, `Payments for ${foundCustomer.name}`, "Total Outstanding"];
      } else {
        // Fallback response / help manual
        reply = `Hello! I am your **Parchi AI Assistant**. I can help you search ledgers and outstanding balances in real time.\n\n**Here are examples of what you can ask me:**\n- *"What is the total outstanding?"*\n- *"Who is the top debtor?"*\n- *"Show aging report"*\n- *"Outstanding for [Customer Name or Phone]"*\n- *"Show payments made by [Customer Name or Phone]"*\n- *"Today's Stats"*`;
        suggestions = ["Total Outstanding", "Show Top Debtors", "Show Aging Report", "Today's Stats"];
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
