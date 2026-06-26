import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

async function getSession(orgcode: string) {
  const cookieStore = await cookies();
  const authtoken = cookieStore.get("authtoken")?.value;
  if (!authtoken) return null;
  const res = await query(
    "SELECT isadmin, userid FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
    [authtoken, orgcode]
  );
  return res.rows[0] || null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");
    const itemIdStr = searchParams.get("itemId");
    const locationIdStr = searchParams.get("locationId"); // Optional
    const startDateStr = searchParams.get("startDate");   // Optional YYYY-MM-DD
    const endDateStr = searchParams.get("endDate");       // Optional YYYY-MM-DD
    const financialYearIdStr = searchParams.get("financialYearId"); // Optional

    if (!orgcode || !itemIdStr) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters (orgcode, itemId)" },
        { status: 400 }
      );
    }

    const session = await getSession(orgcode);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized or invalid session" },
        { status: 401 }
      );
    }

    const itemId = parseInt(itemIdStr, 10);
    const locationId = locationIdStr ? parseInt(locationIdStr, 10) : null;

    // 1. Resolve Financial Year
    let fy;
    if (financialYearIdStr) {
      const fyRes = await query(
        "SELECT * FROM public.inventory_financial_years WHERE id = $1 AND orgcode = $2",
        [parseInt(financialYearIdStr, 10), orgcode]
      );
      fy = fyRes.rows[0];
    }

    if (!fy && startDateStr) {
      // Find financial year matching the startDate
      const fyRes = await query(
        `SELECT * FROM public.inventory_financial_years 
         WHERE orgcode = $1 AND start_date <= $2 AND end_date >= $2 LIMIT 1`,
        [orgcode, startDateStr]
      );
      fy = fyRes.rows[0];
    }

    if (!fy) {
      // Fallback to latest financial year
      const fyRes = await query(
        `SELECT * FROM public.inventory_financial_years 
         WHERE orgcode = $1 ORDER BY start_date DESC LIMIT 1`,
        [orgcode]
      );
      fy = fyRes.rows[0];
    }

    if (!fy) {
      return NextResponse.json(
        { success: false, message: "No active Financial Year found for this organization." },
        { status: 400 }
      );
    }

    const fyId = fy.id;
    const fyStart = new Date(fy.start_date);
    const fyEnd = new Date(fy.end_date);

    // Parse dates
    const startDate = startDateStr ? new Date(startDateStr) : fyStart;
    const endDate = endDateStr ? new Date(endDateStr) : fyEnd;

    // 2. Fetch Item Details
    const itemRes = await query(
      "SELECT id, name, sku, description FROM public.inventory_items WHERE id = $1 AND orgcode = $2",
      [itemId, orgcode]
    );
    if (itemRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Item not found" }, { status: 404 });
    }
    const item = itemRes.rows[0];

    // 3. Calculate Opening Balance as of startDate
    // A. Start with base opening balance in inventory_balances for the selected FY
    let balQuery = "SELECT COALESCE(SUM(opening_qty), 0) as val FROM public.inventory_balances WHERE orgcode = $1 AND financial_year_id = $2 AND item_id = $3";
    let balParams = [orgcode, fyId, itemId];
    if (locationId !== null) {
      balQuery += " AND location_id = $4";
      balParams.push(locationId);
    }
    const balRes = await query(balQuery, balParams);
    let openingBalance = parseFloat(balRes.rows[0].val);

    // B. Adjust with movements between FY start_date and selected startDate
    let adjQuery = `
      SELECT 
        h.from_location_id,
        h.to_location_id,
        d.qty,
        tt.from_type,
        tt.to_type
      FROM public.inventory_transaction_details d
      JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
      LEFT JOIN public.inventory_transaction_types tt ON h.transaction_type_id = tt.id
      WHERE h.orgcode = $1 
        AND h.financial_year_id = $2 
        AND d.item_id = $3
        AND h.transaction_date >= $4
        AND h.transaction_date < $5
    `;
    const adjRes = await query(adjQuery, [
      orgcode,
      fyId,
      itemId,
      fy.start_date,
      startDateStr || fy.start_date
    ]);

    for (const txn of adjRes.rows) {
      if (locationId !== null) {
        // Inward to location
        if (txn.to_location_id === locationId) {
          openingBalance += parseFloat(txn.qty);
        }
        // Outward from location
        if (txn.from_location_id === locationId) {
          openingBalance -= parseFloat(txn.qty);
        }
      } else {
        // All locations total
        const isToLocation = txn.to_type === "LOCATION";
        const isFromLocation = txn.from_type === "LOCATION";
        
        if (isToLocation && (txn.from_type === "EXTERNAL" || !txn.from_location_id)) {
          openingBalance += parseFloat(txn.qty);
        }
        if (isFromLocation && (txn.to_type === "EXTERNAL" || !txn.to_location_id)) {
          openingBalance -= parseFloat(txn.qty);
        }
      }
    }

    // 4. Fetch statements records within the date range
    let stmtQuery = `
      SELECT 
        h.transaction_date as date,
        h.voucher_no,
        h.party_name,
        h.reference_no,
        h.remarks,
        h.from_location_id,
        h.to_location_id,
        fl.name as from_location_name,
        tl.name as to_location_name,
        d.qty,
        tt.name as transaction_type_name,
        tt.code as transaction_type_code,
        tt.from_type,
        tt.to_type
      FROM public.inventory_transaction_details d
      JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
      LEFT JOIN public.inventory_transaction_types tt ON h.transaction_type_id = tt.id
      LEFT JOIN public.inventory_locations fl ON h.from_location_id = fl.id
      LEFT JOIN public.inventory_locations tl ON h.to_location_id = tl.id
      WHERE h.orgcode = $1
        AND h.financial_year_id = $2
        AND d.item_id = $3
        AND h.transaction_date >= $4
        AND h.transaction_date <= $5
    `;
    let stmtParams = [
      orgcode,
      fyId,
      itemId,
      startDateStr || fy.start_date,
      endDateStr || fy.end_date
    ];

    if (locationId !== null) {
      stmtQuery += " AND (h.from_location_id = $6 OR h.to_location_id = $6)";
      stmtParams.push(locationId);
    }

    stmtQuery += " ORDER BY h.transaction_date ASC, h.created_at ASC, d.id ASC";
    const stmtRes = await query(stmtQuery, stmtParams);

    // 5. Generate Statement Ledger lines with Running Balance
    const statementLines = [];
    let runningBalance = openingBalance;

    for (const r of stmtRes.rows) {
      let inward = 0;
      let outward = 0;
      let narration = `${r.transaction_type_name || "Adjustment"} - `;

      if (r.party_name) {
        narration += `Party: ${r.party_name}`;
      } else if (r.from_location_name && r.to_location_name) {
        narration += `Transfer from ${r.from_location_name} to ${r.to_location_name}`;
      } else if (r.from_location_name) {
        narration += `From ${r.from_location_name}`;
      } else if (r.to_location_name) {
        narration += `To ${r.to_location_name}`;
      }

      if (r.reference_no) {
        narration += ` (Ref: ${r.reference_no})`;
      }
      if (r.voucher_no) {
        narration += ` [Voucher #${r.voucher_no}]`;
      }
      if (r.remarks) {
        narration += ` | ${r.remarks}`;
      }

      const qty = parseFloat(r.qty);

      if (locationId !== null) {
        if (r.to_location_id === locationId) {
          inward = qty;
          runningBalance += qty;
        } else if (r.from_location_id === locationId) {
          outward = qty;
          runningBalance -= qty;
        } else {
          continue; // Safety check
        }
      } else {
        // All locations logic
        const isToLocation = r.to_type === "LOCATION";
        const isFromLocation = r.from_type === "LOCATION";
        
        if (isToLocation && (r.from_type === "EXTERNAL" || !r.from_location_id)) {
          inward = qty;
          runningBalance += qty;
        } else if (isFromLocation && (r.to_type === "EXTERNAL" || !r.to_location_id)) {
          outward = qty;
          runningBalance -= qty;
        } else {
          // Inner transfer within org locations (does not change total balance)
          inward = qty;
          outward = qty;
        }
      }

      statementLines.push({
        date: r.date,
        narration,
        inward,
        outward,
        balance: runningBalance
      });
    }

    return NextResponse.json({
      success: true,
      item,
      financialYear: fy.name,
      openingBalance,
      closingBalance: runningBalance,
      statement: statementLines
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
