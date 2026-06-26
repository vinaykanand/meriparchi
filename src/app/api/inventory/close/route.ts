import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";

async function getAdminSession(orgcode: string) {
  const cookieStore = await cookies();
  const authtoken = cookieStore.get("authtoken")?.value;
  if (!authtoken) return null;
  const res = await query(
    "SELECT isadmin, userid FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true AND isadmin = true",
    [authtoken, orgcode]
  );
  return res.rows[0] || null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgcode, financial_year_id } = body;

    if (!orgcode || !financial_year_id) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters (orgcode, financial_year_id)" },
        { status: 400 }
      );
    }

    const session = await getAdminSession(orgcode);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Admin privileges required" },
        { status: 403 }
      );
    }

    // 1. Fetch current FY details
    const fyRes = await query(
      "SELECT name, start_date, end_date, is_closed FROM public.inventory_financial_years WHERE id = $1 AND orgcode = $2",
      [financial_year_id, orgcode]
    );

    if (fyRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Financial year not found" },
        { status: 404 }
      );
    }

    const currentFy = fyRes.rows[0];
    if (currentFy.is_closed) {
      return NextResponse.json(
        { success: false, message: "This Financial Year is already closed" },
        { status: 400 }
      );
    }

    // 2. Compute final stock balance for all items at all locations for current FY
    const balanceQuery = `
      WITH transactions_in AS (
        SELECT 
          h.to_location_id as location_id,
          d.item_id,
          SUM(d.qty) as total_in
        FROM public.inventory_transaction_details d
        JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
        WHERE h.orgcode = $1 AND h.financial_year_id = $2
        GROUP BY h.to_location_id, d.item_id
      ),
      transactions_out AS (
        SELECT 
          h.from_location_id as location_id,
          d.item_id,
          SUM(d.qty) as total_out
        FROM public.inventory_transaction_details d
        JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
        WHERE h.orgcode = $1 AND h.financial_year_id = $2
        GROUP BY h.from_location_id, d.item_id
      )
      SELECT 
        items.id as item_id,
        loc.id as location_id,
        COALESCE(bal.opening_qty, 0) as opening_qty,
        COALESCE(tin.total_in, 0) as total_in,
        COALESCE(tout.total_out, 0) as total_out,
        (COALESCE(bal.opening_qty, 0) + COALESCE(tin.total_in, 0) - COALESCE(tout.total_out, 0)) as current_qty
      FROM public.inventory_items items
      CROSS JOIN public.inventory_locations loc
      LEFT JOIN public.inventory_balances bal ON bal.financial_year_id = $2 AND bal.location_id = loc.id AND bal.item_id = items.id
      LEFT JOIN transactions_in tin ON tin.location_id = loc.id AND tin.item_id = items.id
      LEFT JOIN transactions_out tout ON tout.location_id = loc.id AND tout.item_id = items.id
      WHERE items.orgcode = $1 AND loc.orgcode = $1;
    `;
    const balances = await query(balanceQuery, [orgcode, financial_year_id]);

    // Calculate dates for next financial year
    const currStart = new Date(currentFy.start_date);
    const currEnd = new Date(currentFy.end_date);
    
    // Add exactly 1 year
    const nextStart = new Date(currStart);
    nextStart.setFullYear(nextStart.getFullYear() + 1);
    
    const nextEnd = new Date(currEnd);
    nextEnd.setFullYear(nextEnd.getFullYear() + 1);

    const nextStartStr = nextStart.toISOString().split("T")[0];
    const nextEndStr = nextEnd.toISOString().split("T")[0];
    const nextName = `FY ${nextStart.getFullYear()}-${(nextStart.getFullYear() + 1).toString().slice(-2)}`;

    // Begin database transaction for closing
    await query("BEGIN");

    try {
      // A. Save the computed closing balance in current year's inventory_balances
      for (const row of balances.rows) {
        await query(
          `INSERT INTO public.inventory_balances (orgcode, financial_year_id, location_id, item_id, opening_qty, closing_qty)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (financial_year_id, location_id, item_id) 
           DO UPDATE SET closing_qty = EXCLUDED.closing_qty`,
          [orgcode, financial_year_id, row.location_id, row.item_id, row.opening_qty, row.current_qty]
        );
      }

      // B. Mark current financial year as closed
      await query(
        "UPDATE public.inventory_financial_years SET is_closed = true WHERE id = $1 AND orgcode = $2",
        [financial_year_id, orgcode]
      );

      // C. Create next financial year (if it doesn't already exist)
      let nextFyId: number;
      const nextFyCheck = await query(
        "SELECT id FROM public.inventory_financial_years WHERE orgcode = $1 AND name = $2",
        [orgcode, nextName]
      );
      
      if (nextFyCheck.rows.length > 0) {
        nextFyId = nextFyCheck.rows[0].id;
      } else {
        const nextFyInsert = await query(
          `INSERT INTO public.inventory_financial_years (orgcode, name, start_date, end_date, is_closed)
           VALUES ($1, $2, $3, $4, false)
           RETURNING id`,
          [orgcode, nextName, nextStartStr, nextEndStr]
        );
        nextFyId = nextFyInsert.rows[0].id;
      }

      // D. Insert opening balances for the next financial year (copied from closing balances of the closed year)
      for (const row of balances.rows) {
        if (row.current_qty !== 0) { // Only roll forward non-zero balances to keep db clean
          await query(
            `INSERT INTO public.inventory_balances (orgcode, financial_year_id, location_id, item_id, opening_qty)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (financial_year_id, location_id, item_id)
             DO UPDATE SET opening_qty = EXCLUDED.opening_qty`,
            [orgcode, nextFyId, row.location_id, row.item_id, row.current_qty]
          );
        }
      }

      await query("COMMIT");

      await logAction({
        orgcode,
        userid: session.userid,
        action: "CLOSE_INVENTORY_FINANCIAL_YEAR",
        details: { closedFyId: financial_year_id, closedFyName: currentFy.name, nextFyName: nextName },
      });

      return NextResponse.json({
        success: true,
        message: `Financial Year ${currentFy.name} has been closed successfully. ${nextName} has been initialized with the respective opening balances.`,
      });
    } catch (txError) {
      await query("ROLLBACK");
      throw txError;
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
