import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";

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
    const fyId = searchParams.get("financialYearId");
    const sku = searchParams.get("sku");
    const voucherId = searchParams.get("voucherId");

    if (!orgcode) {
      return NextResponse.json(
        { success: false, message: "Missing required orgcode parameter" },
        { status: 400 }
      );
    }

    if (voucherId) {
      // Fetch single voucher header and details
      const headerRes = await query(
        `SELECT h.*, t.name as type_name, t.code as type_code, t.stock_effect, t.from_type, t.to_type,
                fl.name as from_location_name, tl.name as to_location_name
         FROM public.inventory_transaction_headers h
         JOIN public.inventory_transaction_types t ON h.transaction_type_id = t.id
         LEFT JOIN public.inventory_locations fl ON h.from_location_id = fl.id
         LEFT JOIN public.inventory_locations tl ON h.to_location_id = tl.id
         WHERE h.id = $1 AND h.orgcode = $2`,
        [parseInt(voucherId, 10), orgcode]
      );
      if (headerRes.rows.length === 0) {
        return NextResponse.json({ success: false, message: "Voucher not found" }, { status: 404 });
      }
      const detailsRes = await query(
        `SELECT d.*, i.name as item_name, i.sku 
         FROM public.inventory_transaction_details d
         JOIN public.inventory_items i ON d.item_id = i.id
         WHERE d.transaction_header_id = $1`,
        [parseInt(voucherId, 10)]
      );
      return NextResponse.json({
        success: true,
        voucher: headerRes.rows[0],
        details: detailsRes.rows
      });
    }

    const session = await getSession(orgcode);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized or invalid session" },
        { status: 401 }
      );
    }

    // Check if inventory is enabled for the company
    const configCheck = await query(
      "SELECT inventory_enabled FROM public.company WHERE orgcode = $1",
      [orgcode]
    );
    if (configCheck.rows.length === 0 || !configCheck.rows[0].inventory_enabled) {
      return NextResponse.json(
        { success: false, message: "Inventory module is currently disabled for this organization. Enable it in settings." },
        { status: 403 }
      );
    }

    // 1. Fetch financial years
    const fyResult = await query(
      "SELECT id, name, start_date, end_date, is_closed FROM public.inventory_financial_years WHERE orgcode = $1 ORDER BY start_date DESC",
      [orgcode]
    );

    // If no financial year exists, let's create a default one for the current year
    let financialYears = fyResult.rows;
    if (financialYears.length === 0) {
      const today = new Date();
      let currentYear = today.getFullYear();
      let startYear = currentYear;
      let endYear = currentYear + 1;
      
      // If today is before April, the financial year started in the previous calendar year
      if (today.getMonth() < 3) {
        startYear = currentYear - 1;
        endYear = currentYear;
      }

      const defaultName = `FY ${startYear}-${endYear.toString().slice(-2)}`;
      const startDate = `${startYear}-04-01`;
      const endDate = `${endYear}-03-31`;

      const insertFy = await query(
        `INSERT INTO public.inventory_financial_years (orgcode, name, start_date, end_date, is_closed)
         VALUES ($1, $2, $3, $4, false)
         RETURNING id, name, start_date, end_date, is_closed`,
        [orgcode, defaultName, startDate, endDate]
      );
      financialYears = [insertFy.rows[0]];
    }

    const selectedFyId = fyId ? parseInt(fyId, 10) : financialYears[0].id;

    // 2. Fetch stock overview directly from inventory_balances table
    const stockQuery = `
      SELECT 
        items.id as item_id,
        items.sku,
        items.name as item_name,
        loc.id as location_id,
        loc.name as location_name,
        COALESCE(bal.opening_qty, 0) as opening_qty,
        COALESCE(bal.closing_qty, 0) as current_qty,
        COALESCE((
          SELECT SUM(d.qty)
          FROM public.inventory_transaction_details d
          JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
          WHERE h.orgcode = $1 AND h.financial_year_id = $2 AND h.to_location_id = loc.id AND d.item_id = items.id
        ), 0) as total_in,
        COALESCE((
          SELECT SUM(d.qty)
          FROM public.inventory_transaction_details d
          JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
          WHERE h.orgcode = $1 AND h.financial_year_id = $2 AND h.from_location_id = loc.id AND d.item_id = items.id
        ), 0) as total_out
      FROM public.inventory_items items
      CROSS JOIN public.inventory_locations loc
      LEFT JOIN public.inventory_balances bal ON bal.financial_year_id = $2 AND bal.location_id = loc.id AND bal.item_id = items.id
      WHERE items.orgcode = $1 AND loc.orgcode = $1
    `;

    let stockParams = [orgcode, selectedFyId];
    let finalStockQuery = stockQuery;
    if (sku) {
      const intSku = parseInt(sku, 10);
      finalStockQuery += ` AND items.sku = $3`;
      stockParams.push(isNaN(intSku) ? -1 : intSku);
    }
    finalStockQuery += ` ORDER BY items.name, loc.name;`;

    const stockResult = await query(finalStockQuery, stockParams);

    // 3. Fetch recent transactions
    const txnResult = await query(
      `SELECT d.id, h.id as transaction_header_id, h.voucher_no, h.transaction_date, h.transaction_type_id, d.item_id, d.qty, h.party_name, h.reference_no, h.remarks,
              h.from_location_id, h.to_location_id,
              fl.name as from_location_name, tl.name as to_location_name,
              i.name as item_name, i.sku,
              tt.name as transaction_type_name, tt.code as transaction_type_code, tt.stock_effect, tt.from_type, tt.to_type
       FROM public.inventory_transaction_details d
       JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
       LEFT JOIN public.inventory_locations fl ON h.from_location_id = fl.id
       LEFT JOIN public.inventory_locations tl ON h.to_location_id = tl.id
       LEFT JOIN public.inventory_items i ON d.item_id = i.id
       LEFT JOIN public.inventory_transaction_types tt ON h.transaction_type_id = tt.id
       WHERE h.orgcode = $1 AND h.financial_year_id = $2
       ORDER BY h.transaction_date DESC, h.id DESC, d.id ASC
       LIMIT 150`,
      [orgcode, selectedFyId]
    );

    // 4. Fetch recent vouchers (headers)
    const vouchersRes = await query(
      `SELECT h.id, h.voucher_no, h.transaction_date, h.party_name, h.reference_no, h.remarks,
              h.from_location_id, h.to_location_id,
              fl.name as from_location_name, tl.name as to_location_name,
              t.name as type_name, t.code as type_code, t.stock_effect, t.from_type, t.to_type,
              (SELECT COUNT(*) FROM public.inventory_transaction_details d WHERE d.transaction_header_id = h.id) as items_count
       FROM public.inventory_transaction_headers h
       JOIN public.inventory_transaction_types t ON h.transaction_type_id = t.id
       LEFT JOIN public.inventory_locations fl ON h.from_location_id = fl.id
       LEFT JOIN public.inventory_locations tl ON h.to_location_id = tl.id
       WHERE h.orgcode = $1 AND h.financial_year_id = $2
       ORDER BY h.transaction_date DESC, h.id DESC
       LIMIT 20`,
      [orgcode, selectedFyId]
    );

    return NextResponse.json({
      success: true,
      financialYears,
      selectedFyId,
      stock: stockResult.rows,
      transactions: txnResult.rows,
      vouchers: vouchersRes.rows
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}

async function updateInventoryBalance(
  orgcode: string,
  financialYearId: number,
  locationId: number,
  itemId: number
) {
  // 1. Calculate inward sum for this location/item
  const inwardRes = await query(
    `SELECT COALESCE(SUM(d.qty), 0) as total_in
     FROM public.inventory_transaction_details d
     JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
     WHERE h.orgcode = $1 AND h.financial_year_id = $2 AND h.to_location_id = $3 AND d.item_id = $4`,
    [orgcode, financialYearId, locationId, itemId]
  );
  const totalIn = parseFloat(inwardRes.rows[0].total_in);

  // 2. Calculate outward sum for this location/item
  const outwardRes = await query(
    `SELECT COALESCE(SUM(d.qty), 0) as total_out
     FROM public.inventory_transaction_details d
     JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
     WHERE h.orgcode = $1 AND h.financial_year_id = $2 AND h.from_location_id = $3 AND d.item_id = $4`,
    [orgcode, financialYearId, locationId, itemId]
  );
  const totalOut = parseFloat(outwardRes.rows[0].total_out);

  // 3. Get base opening balance
  const balRes = await query(
    `SELECT COALESCE(opening_qty, 0) as opening_qty 
     FROM public.inventory_balances 
     WHERE orgcode = $1 AND financial_year_id = $2 AND location_id = $3 AND item_id = $4`,
    [orgcode, financialYearId, locationId, itemId]
  );
  const openingQty = balRes.rows.length > 0 ? parseFloat(balRes.rows[0].opening_qty) : 0;

  const currentClosingQty = openingQty + totalIn - totalOut;

  // 4. Update or insert the new closing quantity in the inventory_balances table
  await query(
    `INSERT INTO public.inventory_balances (orgcode, financial_year_id, location_id, item_id, opening_qty, closing_qty)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (financial_year_id, location_id, item_id)
     DO UPDATE SET closing_qty = EXCLUDED.closing_qty`,
    [orgcode, financialYearId, locationId, itemId, openingQty, currentClosingQty]
  );
}

async function recalculateBalancesForVoucher(
  orgcode: string,
  financialYearId: number,
  fromLocationId: number | null,
  toLocationId: number | null,
  itemIds: number[]
) {
  const uniqueItemIds = Array.from(new Set(itemIds));
  for (const itemId of uniqueItemIds) {
    if (fromLocationId) {
      await updateInventoryBalance(orgcode, financialYearId, fromLocationId, itemId);
    }
    if (toLocationId) {
      await updateInventoryBalance(orgcode, financialYearId, toLocationId, itemId);
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      orgcode,
      financial_year_id,
      transaction_date,
      transaction_type, // Transaction type code
      sku,              // (Optional) Single item SKU
      qty,              // (Optional) Single item qty
      items,            // (Optional) Array of { sku, qty }
      from_location_id,
      to_location_id,
      party_name,
      reference_no,
      remarks,
    } = body;

    if (!orgcode || !financial_year_id || !transaction_date || !transaction_type) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Standardize to items array
    let itemsToProcess = [];
    if (items && Array.isArray(items)) {
      itemsToProcess = items;
    } else if (sku && qty !== undefined) {
      itemsToProcess = [{ sku, qty: parseFloat(qty) }];
    }

    if (itemsToProcess.length === 0) {
      return NextResponse.json(
        { success: false, message: "Please specify at least one SKU and quantity to post." },
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

    // Check if inventory is enabled for the company
    const configCheck = await query(
      "SELECT inventory_enabled FROM public.company WHERE orgcode = $1",
      [orgcode]
    );
    if (configCheck.rows.length === 0 || !configCheck.rows[0].inventory_enabled) {
      return NextResponse.json(
        { success: false, message: "Inventory module is currently disabled for this organization. Enable it in settings." },
        { status: 403 }
      );
    }

    // Check if financial year is closed
    const fyCheck = await query(
      "SELECT is_closed FROM public.inventory_financial_years WHERE id = $1 AND orgcode = $2",
      [financial_year_id, orgcode]
    );
    if (fyCheck.rows.length === 0 || fyCheck.rows[0].is_closed) {
      return NextResponse.json(
        { success: false, message: "Cannot post transactions to a closed or non-existent Financial Year." },
        { status: 400 }
      );
    }

    // Ensure transaction type exists
    const intTxnType = parseInt(transaction_type, 10);
    const typeCheck = await query(
      "SELECT id, name, stock_effect FROM public.inventory_transaction_types WHERE (orgcode = $1 OR orgcode = 'SUPER') AND code = $2",
      [orgcode, isNaN(intTxnType) ? -1 : intTxnType]
    );
    if (typeCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: `Invalid transaction type code: ${transaction_type}` },
        { status: 400 }
      );
    }
    const txnTypeId = typeCheck.rows[0].id;
    const txnTypeName = typeCheck.rows[0].name;
    const txnStockEffect = typeCheck.rows[0].stock_effect;

    // Resolve or insert items and calculate IDs
    const resolvedItems = [];
    for (const item of itemsToProcess) {
      if (!item.sku || item.qty === undefined || item.qty <= 0) {
        return NextResponse.json(
          { success: false, message: "SKUs and positive quantities are required for all detail lines." },
          { status: 400 }
        );
      }

      const intSku = parseInt(item.sku, 10);
      if (isNaN(intSku)) {
        return NextResponse.json(
          { success: false, message: `SKU must be a numeric integer value: ${item.sku}` },
          { status: 400 }
        );
      }
      
      let itemId;
      const itemCheck = await query(
        "SELECT id FROM public.inventory_items WHERE orgcode = $1 AND sku = $2",
        [orgcode, intSku]
      );
      if (itemCheck.rows.length === 0) {
        const insertItem = await query(
          "INSERT INTO public.inventory_items (sku, orgcode, name) VALUES ($1, $2, $3) RETURNING id",
          [intSku, orgcode, String(intSku)]
        );
        itemId = insertItem.rows[0].id;
      } else {
        itemId = itemCheck.rows[0].id;
      }

      resolvedItems.push({
        id: itemId,
        sku: intSku,
        qty: parseFloat(item.qty)
      });
    }

    // Begin database transaction for POST
    await query("BEGIN");

    try {
      // 1. Insert header
      const headerResult = await query(
        `INSERT INTO public.inventory_transaction_headers 
           (orgcode, financial_year_id, transaction_date, transaction_type_id, from_location_id, to_location_id, party_name, reference_no, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          orgcode,
          financial_year_id,
          transaction_date,
          txnTypeId,
          from_location_id || null,
          to_location_id || null,
          party_name || null,
          reference_no || null,
          remarks || null,
        ]
      );
      const headerId = headerResult.rows[0].id;

      // 2. Insert detail lines & update balances
      for (const item of resolvedItems) {
        await query(
          `INSERT INTO public.inventory_transaction_details (transaction_header_id, item_id, qty)
           VALUES ($1, $2, $3)`,
          [headerId, item.id, item.qty]
        );

        if (from_location_id) {
          await updateInventoryBalance(orgcode, financial_year_id, from_location_id, item.id);
        }
        if (to_location_id) {
          await updateInventoryBalance(orgcode, financial_year_id, to_location_id, item.id);
        }
      }

      await query("COMMIT");

      const actionName = txnStockEffect === "INWARD" ? "INWARD" : "OUTWARD";

      await logAction({
        orgcode,
        userid: session.userid,
        action: actionName,
        details: {
          headerId,
          itemsCount: resolvedItems.length,
          type: transaction_type,
          typeName: txnTypeName,
          partyName: party_name || null,
          referenceNo: reference_no || null,
          remarks: remarks || null,
          fromLocationId: from_location_id || null,
          toLocationId: to_location_id || null
        },
      });

      return NextResponse.json({
        success: true,
        message: "Inventory transaction recorded successfully",
        transactionId: headerId,
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

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      orgcode,
      id,
      financial_year_id,
      transaction_date,
      transaction_type,
      from_location_id,
      to_location_id,
      party_name,
      reference_no,
      remarks,
      items,
    } = body;

    if (!id || !orgcode || !financial_year_id || !transaction_date || !transaction_type || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters" },
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

    // Resolve transaction type
    const intTxnType = parseInt(transaction_type, 10);
    const typeCheck = await query(
      "SELECT id, name, stock_effect FROM public.inventory_transaction_types WHERE (orgcode = $1 OR orgcode = 'SUPER') AND code = $2",
      [orgcode, isNaN(intTxnType) ? -1 : intTxnType]
    );
    if (typeCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: `Invalid transaction type code: ${transaction_type}` },
        { status: 400 }
      );
    }
    const txnTypeId = typeCheck.rows[0].id;
    const txnTypeName = typeCheck.rows[0].name;
    const txnStockEffect = typeCheck.rows[0].stock_effect;

    // Resolve items
    const resolvedItems = [];
    for (const item of items) {
      if (!item.sku || item.qty === undefined || parseFloat(item.qty) <= 0) {
        return NextResponse.json(
          { success: false, message: "Positive quantities and SKUs are required." },
          { status: 400 }
        );
      }
      const intSku = parseInt(item.sku, 10);
      let itemId;
      const itemCheck = await query(
        "SELECT id FROM public.inventory_items WHERE orgcode = $1 AND sku = $2",
        [orgcode, intSku]
      );
      if (itemCheck.rows.length === 0) {
        const insertItem = await query(
          "INSERT INTO public.inventory_items (sku, orgcode, name) VALUES ($1, $2, $3) RETURNING id",
          [intSku, orgcode, String(intSku)]
        );
        itemId = insertItem.rows[0].id;
      } else {
        itemId = itemCheck.rows[0].id;
      }
      resolvedItems.push({ id: itemId, sku: intSku, qty: parseFloat(item.qty) });
    }

    // Fetch old header and details for balance rollback recalculation
    const oldHeaderRes = await query(
      "SELECT from_location_id, to_location_id, financial_year_id FROM public.inventory_transaction_headers WHERE id = $1 AND orgcode = $2",
      [id, orgcode]
    );
    const oldDetailsRes = await query(
      "SELECT item_id FROM public.inventory_transaction_details WHERE transaction_header_id = $1",
      [id]
    );

    await query("BEGIN");
    try {
      // 1. Update header
      await query(
        `UPDATE public.inventory_transaction_headers 
         SET financial_year_id = $1, transaction_date = $2, transaction_type_id = $3, 
             from_location_id = $4, to_location_id = $5, party_name = $6, reference_no = $7, remarks = $8
         WHERE id = $9 AND orgcode = $10`,
        [
          financial_year_id,
          transaction_date,
          txnTypeId,
          from_location_id || null,
          to_location_id || null,
          party_name || null,
          reference_no || null,
          remarks || null,
          id,
          orgcode
        ]
      );

      // 2. Delete old details
      await query("DELETE FROM public.inventory_transaction_details WHERE transaction_header_id = $1", [id]);

      // 3. Insert new details
      for (const item of resolvedItems) {
        await query(
          `INSERT INTO public.inventory_transaction_details (transaction_header_id, item_id, qty)
           VALUES ($1, $2, $3)`,
          [id, item.id, item.qty]
        );
      }

      // 4. Recalculate balances for OLD locations/items
      if (oldHeaderRes.rows.length > 0) {
        const oldH = oldHeaderRes.rows[0];
        const oldItemIds = oldDetailsRes.rows.map(d => d.item_id);
        await recalculateBalancesForVoucher(
          orgcode,
          oldH.financial_year_id,
          oldH.from_location_id,
          oldH.to_location_id,
          oldItemIds
        );
      }

      // 5. Recalculate balances for NEW locations/items
      const newItemIds = resolvedItems.map(item => item.id);
      await recalculateBalancesForVoucher(
        orgcode,
        financial_year_id,
        from_location_id || null,
        to_location_id || null,
        newItemIds
      );

      await query("COMMIT");

      const actionName = txnStockEffect === "INWARD" ? "INWARD" : "OUTWARD";
      await logAction({
        orgcode,
        userid: session.userid,
        action: actionName,
        details: {
          headerId: id,
          isUpdate: true,
          itemsCount: resolvedItems.length,
          type: transaction_type,
          typeName: txnTypeName,
          partyName: party_name || null,
          referenceNo: reference_no || null,
          remarks: remarks || null
        }
      });

      return NextResponse.json({ success: true, message: "Voucher updated successfully" });
    } catch (e) {
      await query("ROLLBACK");
      throw e;
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const orgcode = searchParams.get("orgcode");
    const password = searchParams.get("password");

    if (!id || !orgcode) {
      return NextResponse.json({ success: false, message: "Missing id or orgcode" }, { status: 400 });
    }

    // Verify admin password
    if (!password) {
      return NextResponse.json({ success: false, message: "Admin password is required to delete vouchers" }, { status: 400 });
    }

    const adminCheck = await query(
      "SELECT password FROM public.users WHERE orgcode = $1 AND userid = 'admin' AND isadmin = true AND isactive = true",
      [orgcode]
    );
    if (adminCheck.rows.length === 0 || adminCheck.rows[0].password !== password.trim()) {
      return NextResponse.json({ success: false, message: "Invalid admin password confirmation" }, { status: 401 });
    }

    const session = await getSession(orgcode);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized or invalid session" }, { status: 401 });
    }

    // Fetch voucher details for audit log before deleting
    const voucherHeader = await query(
      `SELECT h.id, h.transaction_date, h.party_name, h.reference_no, t.name as type_name, t.stock_effect 
       FROM public.inventory_transaction_headers h
       JOIN public.inventory_transaction_types t ON h.transaction_type_id = t.id
       WHERE h.id = $1 AND h.orgcode = $2`,
      [parseInt(id, 10), orgcode]
    );

    // Fetch old header and details for balance rollback recalculation
    const oldHeaderRes = await query(
      "SELECT from_location_id, to_location_id, financial_year_id FROM public.inventory_transaction_headers WHERE id = $1 AND orgcode = $2",
      [parseInt(id, 10), orgcode]
    );
    const oldDetailsRes = await query(
      "SELECT item_id FROM public.inventory_transaction_details WHERE transaction_header_id = $1",
      [parseInt(id, 10)]
    );

    if (voucherHeader.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Voucher not found" }, { status: 404 });
    }

    const v = voucherHeader.rows[0];

    // Begin tx
    await query("BEGIN");
    try {
      // Delete details first
      await query("DELETE FROM public.inventory_transaction_details WHERE transaction_header_id = $1", [parseInt(id, 10)]);
      // Delete header
      await query("DELETE FROM public.inventory_transaction_headers WHERE id = $1 AND orgcode = $2", [parseInt(id, 10), orgcode]);

      // Recalculate balances for OLD locations/items
      if (oldHeaderRes.rows.length > 0) {
        const oldH = oldHeaderRes.rows[0];
        const oldItemIds = oldDetailsRes.rows.map(d => d.item_id);
        await recalculateBalancesForVoucher(
          orgcode,
          oldH.financial_year_id,
          oldH.from_location_id,
          oldH.to_location_id,
          oldItemIds
        );
      }

      await query("COMMIT");

      // Log action
      await logAction({
        orgcode,
        userid: session.userid,
        action: "DELETE_VOUCHER",
        details: {
          headerId: id,
          typeName: v.type_name,
          partyName: v.party_name,
          referenceNo: v.reference_no,
          stockEffect: v.stock_effect
        }
      });

      return NextResponse.json({ success: true, message: "Voucher deleted and stock effect reversed successfully" });
    } catch (e: any) {
      await query("ROLLBACK");
      throw e;
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Server Error" }, { status: 500 });
  }
}
