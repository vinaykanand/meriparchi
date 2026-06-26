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
    const locationIdStr = searchParams.get("locationId"); // optional
    const itemIdStr = searchParams.get("itemId");         // optional
    const fyIdStr = searchParams.get("financialYearId");  // optional

    if (!orgcode) {
      return NextResponse.json(
        { success: false, message: "Missing required orgcode parameter" },
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

    // Resolve Financial Year
    let fy;
    if (fyIdStr) {
      const fyRes = await query(
        "SELECT * FROM public.inventory_financial_years WHERE id = $1 AND orgcode = $2",
        [parseInt(fyIdStr, 10), orgcode]
      );
      fy = fyRes.rows[0];
    }
    if (!fy) {
      const fyRes = await query(
        "SELECT * FROM public.inventory_financial_years WHERE orgcode = $1 ORDER BY start_date DESC LIMIT 1",
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

    const locationId = locationIdStr ? parseInt(locationIdStr, 10) : null;
    const itemId = itemIdStr ? parseInt(itemIdStr, 10) : null;

    // Build the stock-in-hand query
    // Group by item (optionally also by location)
    const params: any[] = [orgcode, fyId];
    let paramIdx = 3;

    let locationFilter = "";
    let itemFilter = "";

    if (locationId !== null) {
      locationFilter = `AND loc.id = $${paramIdx}`;
      params.push(locationId);
      paramIdx++;
    }

    if (itemId !== null) {
      itemFilter = `AND items.id = $${paramIdx}`;
      params.push(itemId);
      paramIdx++;
    }

    // When a location is selected: show each item's stock at that location
    // When no location: aggregate across all locations (total stock in hand)
    let stockQuery: string;

    if (locationId !== null) {
      // Per-item at a specific location
      stockQuery = `
        SELECT
          items.id            AS item_id,
          items.sku,
          items.name          AS item_name,
          items.description,
          items.reorder_level,
          loc.id              AS location_id,
          loc.name            AS location_name,
          COALESCE(bal.opening_qty, 0)    AS opening_qty,
          COALESCE((
            SELECT SUM(d.qty)
            FROM public.inventory_transaction_details d
            JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
            WHERE h.orgcode = $1 AND h.financial_year_id = $2 AND h.to_location_id = loc.id AND d.item_id = items.id
          ), 0) AS total_in,
          COALESCE((
            SELECT SUM(d.qty)
            FROM public.inventory_transaction_details d
            JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
            WHERE h.orgcode = $1 AND h.financial_year_id = $2 AND h.from_location_id = loc.id AND d.item_id = items.id
          ), 0) AS total_out,
          COALESCE(bal.closing_qty, 0)    AS current_qty
        FROM public.inventory_items items
        JOIN public.inventory_locations loc ON loc.orgcode = $1
        LEFT JOIN public.inventory_balances bal
          ON bal.financial_year_id = $2
          AND bal.location_id = loc.id
          AND bal.item_id = items.id
        WHERE items.orgcode = $1
          ${locationFilter}
          ${itemFilter}
        ORDER BY items.name ASC, loc.name ASC
      `;
    } else {
      // Total stock across all locations per item
      stockQuery = `
        SELECT
          items.id            AS item_id,
          items.sku,
          items.name          AS item_name,
          items.description,
          items.reorder_level,
          NULL::integer       AS location_id,
          'All Locations'     AS location_name,
          COALESCE(
            (SELECT SUM(opening_qty)
             FROM public.inventory_balances
             WHERE orgcode = $1 AND financial_year_id = $2 AND item_id = items.id),
            0
          ) AS opening_qty,
          COALESCE((
            SELECT SUM(d.qty)
            FROM public.inventory_transaction_details d
            JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
            WHERE h.orgcode = $1 AND h.financial_year_id = $2 AND d.item_id = items.id AND h.to_location_id IS NOT NULL
          ), 0) AS total_in,
          COALESCE((
            SELECT SUM(d.qty)
            FROM public.inventory_transaction_details d
            JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
            WHERE h.orgcode = $1 AND h.financial_year_id = $2 AND d.item_id = items.id AND h.from_location_id IS NOT NULL
          ), 0) AS total_out,
          COALESCE(
            (SELECT SUM(closing_qty)
             FROM public.inventory_balances
             WHERE orgcode = $1 AND financial_year_id = $2 AND item_id = items.id),
            0
          ) AS current_qty
        FROM public.inventory_items items
        WHERE items.orgcode = $1
          ${itemFilter}
        ORDER BY items.name ASC
      `;
    }

    const result = await query(stockQuery, params);

    // Add computed current_qty
    const rows = result.rows.map((r: any) => ({
      ...r,
      opening_qty: parseFloat(r.opening_qty) || 0,
      total_in: parseFloat(r.total_in) || 0,
      total_out: parseFloat(r.total_out) || 0,
      current_qty: parseFloat(r.current_qty) || 0,
      reorder_level: parseFloat(r.reorder_level) || 0,
    }));

    // Summary stats
    const totalItems = rows.length;
    const belowReorder = rows.filter((r: any) => r.current_qty <= r.reorder_level).length;
    const totalStock = rows.reduce((sum: number, r: any) => sum + r.current_qty, 0);

    return NextResponse.json({
      success: true,
      financialYear: fy.name,
      fyId,
      rows,
      summary: {
        totalItems,
        belowReorder,
        totalStock,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
