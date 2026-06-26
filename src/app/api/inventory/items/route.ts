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

    const result = await query(
      `SELECT i.id, i.sku, i.name, i.description, i.created_at, i.reorder_level,
              COALESCE(
                (SELECT SUM(opening_qty) FROM public.inventory_balances WHERE orgcode = $1 AND item_id = i.id),
                0
              ) as opening_balance,
              COALESCE(
                (SELECT SUM(closing_qty) FROM public.inventory_balances WHERE orgcode = $1 AND item_id = i.id),
                0
              ) as current_balance
       FROM public.inventory_items i 
       WHERE i.orgcode = $1 
       ORDER BY i.name ASC`,
      [orgcode]
    );

    return NextResponse.json({ success: true, items: result.rows });
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
    const { orgcode, sku, name, description, reorder_level } = body;

    if (!orgcode || sku === undefined || !name) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters (orgcode, sku, name)" },
        { status: 400 }
      );
    }

    const intSku = parseInt(sku, 10);
    if (isNaN(intSku)) {
      return NextResponse.json(
        { success: false, message: "SKU must be an integer to optimize space" },
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

    // Insert new item/SKU
    const result = await query(
      `INSERT INTO public.inventory_items (sku, orgcode, name, description, reorder_level) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, sku, name, description, reorder_level`,
      [intSku, orgcode, name.trim(), description || "", parseFloat(reorder_level) || 0]
    );

    await logAction({
      orgcode,
      userid: session.userid,
      action: "CREATE_INVENTORY_ITEM",
      details: { sku: intSku, name: name.trim() },
    });

    return NextResponse.json({
      success: true,
      message: "Inventory item SKU created successfully",
      item: result.rows[0],
    });
  } catch (error: any) {
    if (error.code === "23505") { // Unique/Primary Key violation
      return NextResponse.json(
        { success: false, message: "An item with this SKU already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");
    const sku = searchParams.get("sku");

    if (!orgcode || sku === null) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters (orgcode, sku)" },
        { status: 400 }
      );
    }

    const intSku = parseInt(sku, 10);
    if (isNaN(intSku)) {
      return NextResponse.json(
        { success: false, message: "SKU must be an integer" },
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

    // Resolve item_id from sku
    const itemRes = await query(
      "SELECT id, name FROM public.inventory_items WHERE orgcode = $1 AND sku = $2",
      [orgcode, intSku]
    );
    if (itemRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "SKU not found" },
        { status: 404 }
      );
    }
    const { id: itemId, name: itemName } = itemRes.rows[0];

    // Check for any transaction details referencing this item
    const txCheck = await query(
      `SELECT COUNT(*) as count
       FROM public.inventory_transaction_details d
       JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
       WHERE h.orgcode = $1 AND d.item_id = $2`,
      [orgcode, itemId]
    );
    const txCount = parseInt(txCheck.rows[0]?.count || "0", 10);

    if (txCount > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Deletion not possible — SKU "${intSku}" has ${txCount} active transaction(s) in the voucher. Please remove those transactions first.`,
          activeTransactions: txCount,
        },
        { status: 409 }
      );
    }

    // Also check opening balances
    const balanceCheck = await query(
      "SELECT COUNT(*) as count FROM public.inventory_balances WHERE orgcode = $1 AND item_id = $2",
      [orgcode, itemId]
    );
    const balanceCount = parseInt(balanceCheck.rows[0]?.count || "0", 10);
    if (balanceCount > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Deletion not possible — SKU "${intSku}" has opening balance entries (${balanceCount} record(s)). Clear the balances first.`,
          activeTransactions: balanceCount,
        },
        { status: 409 }
      );
    }

    await query(
      "DELETE FROM public.inventory_items WHERE orgcode = $1 AND sku = $2",
      [orgcode, intSku]
    );

    await logAction({
      orgcode,
      userid: session.userid,
      action: "DELETE_INVENTORY_ITEM",
      details: { sku: intSku, name: itemName },
    });

    return NextResponse.json({
      success: true,
      message: `SKU "${intSku}" deleted successfully`,
    });
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
    const { orgcode, sku, name, description, reorder_level } = body;

    if (!orgcode || sku === undefined || !name) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters (orgcode, sku, name)" },
        { status: 400 }
      );
    }

    const intSku = parseInt(sku, 10);
    if (isNaN(intSku)) {
      return NextResponse.json(
        { success: false, message: "SKU must be an integer" },
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

    const result = await query(
      `UPDATE public.inventory_items 
       SET name = $1, description = $2, reorder_level = $3
       WHERE orgcode = $4 AND sku = $5
       RETURNING id, sku, name, description, reorder_level`,
      [name.trim(), description || "", parseFloat(reorder_level) || 0, orgcode, intSku]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Item not found" },
        { status: 404 }
      );
    }

    await logAction({
      orgcode,
      userid: session.userid,
      action: "UPDATE_INVENTORY_ITEM",
      details: { sku: intSku, name: name.trim() },
    });

    return NextResponse.json({
      success: true,
      message: "Inventory item SKU updated successfully",
      item: result.rows[0],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
