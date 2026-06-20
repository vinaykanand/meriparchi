import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");
    const phone = searchParams.get("phone");
    const date = searchParams.get("date");
    const search = searchParams.get("search");
    const recent = searchParams.get("recent");

    if (!orgcode) {
      return NextResponse.json(
        { success: false, message: "Missing required orgcode parameter" },
        { status: 400 }
      );
    }

    // 1. Fuzzy Account Search
    if (search !== null) {
      const result = await query(
        "SELECT phone, name, address FROM public.search_accounts($1, $2)",
        [orgcode, search]
      );
      return NextResponse.json({ success: true, accounts: result.rows });
    }

    // 1b. Fetch Recent Payments
    const paymentsLimit = searchParams.get("paymentsLimit");
    if (paymentsLimit !== null) {
      const limit = parseInt(paymentsLimit, 10) || 50;
      const result = await query(
        `SELECT p.id, p.phone, p.date, p.amount, p.narration,
                (SELECT s.name FROM public.slips s WHERE s.orgcode = p.orgcode AND s.phone = p.phone LIMIT 1) as name,
                (SELECT s.address FROM public.slips s WHERE s.orgcode = p.orgcode AND s.phone = p.phone LIMIT 1) as address
         FROM public.payments p
         WHERE p.orgcode = $1
         ORDER BY p.date DESC, p.id DESC
         LIMIT $2`,
        [orgcode, limit]
      );
      return NextResponse.json({ success: true, payments: result.rows });
    }

    // 2. Recent Transactions / Accounts Lookup
    if (recent === "true") {
      // Recent slips
      const slipsResult = await query(
        `SELECT id, slipno, date, phone, name, address, totalamount, netamount 
         FROM public.slips 
         WHERE orgcode = $1 
         ORDER BY date DESC, id DESC 
         LIMIT 15`,
        [orgcode]
      );
      
      // Recent payments
      const paymentsResult = await query(
        `SELECT id, phone, date, amount, narration 
         FROM public.payments 
         WHERE orgcode = $1 
         ORDER BY date DESC, id DESC 
         LIMIT 15`,
        [orgcode]
      );

      // Recent active accounts
      const accountsResult = await query(
        `SELECT phone, name, address, MAX(date) as last_date 
         FROM public.slips 
         WHERE orgcode = $1 
         GROUP BY phone, name, address 
         ORDER BY last_date DESC 
         LIMIT 15`,
        [orgcode]
      );

      // Recent return items (qty < 0)
      const returnsResult = await query(
        `SELECT i.item, i.qty, i.rate, i.amount, s.date, s.phone, s.name 
         FROM public.slipitems i 
         JOIN public.slips s ON i.id = s.id 
         WHERE s.orgcode = $1 AND i.qty < 0 
         ORDER BY s.date DESC, s.id DESC 
         LIMIT 15`,
        [orgcode]
      );

      return NextResponse.json({
        success: true,
        recentSlips: slipsResult.rows,
        recentPayments: paymentsResult.rows,
        recentAccounts: accountsResult.rows,
        recentReturns: returnsResult.rows
      });
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters" },
        { status: 400 }
      );
    }

    // 3. Customer Ledger Dashboard
    const customerResult = await query(
      "SELECT name, phone, address FROM public.slips WHERE orgcode = $1 AND phone = $2 LIMIT 1",
      [orgcode, phone]
    );

    const customer = customerResult.rows[0] || { phone };

    const dateFilterSlip = date ? `AND to_char(s.date, 'YYYY-MM-DD') = $3` : "";
    const dateFilterPay = date ? `AND to_char(date, 'YYYY-MM-DD') = $3` : "";

    const slipsTotalResult = await query(
      "SELECT SUM(netamount) as total, COUNT(*) as count FROM public.slips WHERE orgcode = $1 AND phone = $2",
      [orgcode, phone]
    );
    const paymentsTotalResult = await query(
      "SELECT SUM(amount) as total, COUNT(*) as count FROM public.payments WHERE orgcode = $1 AND phone = $2",
      [orgcode, phone]
    );
    const returnsTotalResult = await query(
      `SELECT SUM(ABS(i.amount)) as total, COUNT(*) as count 
       FROM public.slipitems i 
       JOIN public.slips s ON i.id = s.id 
       WHERE s.orgcode = $1 AND s.phone = $2 AND i.qty < 0`,
      [orgcode, phone]
    );

    const totalSlipsAmount = parseFloat(slipsTotalResult.rows[0]?.total || "0");
    const totalPaymentsAmount = parseFloat(paymentsTotalResult.rows[0]?.total || "0");
    const totalOutstanding = totalSlipsAmount - totalPaymentsAmount;
    
    const datesResult = await query(
      `SELECT DISTINCT to_char(date, 'YYYY-MM-DD') as d FROM (
         SELECT date FROM public.slips WHERE orgcode = $1 AND phone = $2
         UNION
         SELECT date FROM public.payments WHERE orgcode = $1 AND phone = $2
       ) all_dates ORDER BY d DESC`,
      [orgcode, phone]
    );

    const slipsQuery = `
      SELECT s.date as time, s.slipno as no, s.phone, s.name, i.item, i.qty, i.rate, i.amount as amt, i.remarks 
      FROM public.slips s 
      JOIN public.slipitems i ON s.id = i.id 
      WHERE s.orgcode = $1 AND s.phone = $2 ${dateFilterSlip}
      ORDER BY s.date DESC, s.slipno DESC
    `;
    const params = date ? [orgcode, phone, date] : [orgcode, phone];
    const slipsTableResult = await query(slipsQuery, params);

    const paymentsQuery = `
      SELECT date as time, phone, amount as amt, narration 
      FROM public.payments 
      WHERE orgcode = $1 AND phone = $2 ${dateFilterPay}
      ORDER BY date DESC
    `;
    const paymentsTableResult = await query(paymentsQuery, params);

    return NextResponse.json({
      success: true,
      customer,
      kpis: {
        outstanding: totalOutstanding,
        slipsTotal: totalSlipsAmount,
        slipsCount: parseInt(slipsTotalResult.rows[0]?.count || "0", 10),
        paymentsTotal: totalPaymentsAmount,
        paymentsCount: parseInt(paymentsTotalResult.rows[0]?.count || "0", 10),
        returnsAmount: parseFloat(returnsTotalResult.rows[0]?.total || "0"),
        returnsCount: parseInt(returnsTotalResult.rows[0]?.count || "0", 10)
      },
      availableDates: datesResult.rows.map(r => r.d),
      slips: slipsTableResult.rows,
      payments: paymentsTableResult.rows
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch("https://ekzrjsjulqkoqvqgtsgi.supabase.co/functions/v1/ledger", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const cookieStore = await cookies();
      const authtoken = cookieStore.get("authtoken")?.value;
      let userid = "system";
      if (authtoken && body.orgcode) {
        const sessionCheck = await query(
          "SELECT userid FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
          [authtoken, body.orgcode]
        );
        if (sessionCheck.rows.length > 0) {
          userid = sessionCheck.rows[0].userid;
        }
      }

      if (body.type === "slip") {
        await logAction({
          orgcode: body.orgcode,
          userid,
          action: "CREATE_SLIP",
          details: { phone: body.phone, name: body.name, totalamount: body.totalamount, itemsCount: body.items?.length },
        });
      } else if (body.type === "payment") {
        await logAction({
          orgcode: body.orgcode,
          userid,
          action: "LOG_PAYMENT",
          details: { phone: body.phone, amount: body.amount, narration: body.narration },
        });
      }
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    const orgcode = searchParams.get("orgcode");
    const phone = searchParams.get("phone");
    const slipno = searchParams.get("slipno");
    const paymentIds = searchParams.get("paymentIds");

    const body = await request.json().catch(() => ({}));
    const password = body.password;

    if (!authtoken || !orgcode || (!phone && !slipno && !paymentIds)) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters" },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json({ success: false, message: "Admin password is required." }, { status: 400 });
    }

    const sessionCheck = await query("SELECT isadmin, password, userid FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true", [authtoken, orgcode]);
    if (sessionCheck.rows.length === 0 || !sessionCheck.rows[0].isadmin) {
      return NextResponse.json({ success: false, message: "Unauthorized: Admin access required" }, { status: 401 });
    }

    if (sessionCheck.rows[0].password !== password) {
      return NextResponse.json({ success: false, message: "Invalid password" }, { status: 401 });
    }

    if (paymentIds) {
      const idArray = paymentIds.split(",").map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (idArray.length > 0) {
        // Find details for audit logging BEFORE deleting
        const paymentsDetails = await query(
          "SELECT id, phone, amount FROM public.payments WHERE orgcode = $1 AND id = ANY($2::bigint[])",
          [orgcode, idArray]
        );

        // Delete payments
        await query(
          "DELETE FROM public.payments WHERE orgcode = $1 AND id = ANY($2::bigint[])",
          [orgcode, idArray]
        );

        // Log action for EACH deleted payment
        for (const p of paymentsDetails.rows) {
          await logAction({
            orgcode,
            userid: sessionCheck.rows[0].userid,
            action: "DELETE_PAYMENT",
            details: { paymentId: p.id, phone: p.phone, amount: p.amount },
          });
        }

        return NextResponse.json({ success: true, message: `${idArray.length} payment(s) deleted successfully` });
      }
      return NextResponse.json({ success: false, message: "No valid payment IDs provided" }, { status: 400 });
    }

    if (slipno) {
      // Find the slip
      const slipCheck = await query(
        "SELECT id, phone, name FROM public.slips WHERE orgcode = $1 AND slipno = $2",
        [orgcode, slipno]
      );
      if (slipCheck.rows.length === 0) {
        return NextResponse.json({ success: false, message: "Slip not found" }, { status: 404 });
      }
      const slipId = slipCheck.rows[0].id;

      // Delete items and slip
      await query("DELETE FROM public.slipitems WHERE id = $1", [slipId]);
      await query("DELETE FROM public.slips WHERE id = $1 AND orgcode = $2", [slipId, orgcode]);

      await logAction({
        orgcode,
        userid: sessionCheck.rows[0].userid,
        action: "DELETE_SLIP",
        details: { slipno, phone: slipCheck.rows[0]?.phone, name: slipCheck.rows[0]?.name },
      });

      return NextResponse.json({ success: true, message: `Slip #${slipno} deleted successfully` });
    }

    const response = await fetch(
      `https://ekzrjsjulqkoqvqgtsgi.supabase.co/functions/v1/ledger?authtoken=${authtoken}&orgcode=${orgcode}&phone=${phone}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    if (response.ok && data.success) {
      await logAction({
        orgcode,
        userid: sessionCheck.rows[0].userid,
        action: "CLOSE_ACCOUNT",
        details: { phone },
      });
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
