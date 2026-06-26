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

    // Fetch types belonging to active company OR global types under 'SUPER'
    const result = await query(
      `SELECT id, orgcode, code, name, stock_effect, from_type, to_type, created_at 
       FROM public.inventory_transaction_types 
       WHERE orgcode = $1 OR orgcode = 'SUPER' 
       ORDER BY code ASC`,
      [orgcode]
    );

    return NextResponse.json({ success: true, transactionTypes: result.rows });
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
    const { orgcode, name, stock_effect, from_type, to_type } = body;

    if (!orgcode || !name || !stock_effect || !from_type || !to_type) {
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

    const result = await query(
      `INSERT INTO public.inventory_transaction_types (orgcode, code, name, stock_effect, from_type, to_type) 
       VALUES ($1, nextval('public.inventory_transaction_types_code_seq'), $2, $3, $4, $5) 
       RETURNING id, orgcode, code, name, stock_effect, from_type, to_type`,
      [orgcode, name.trim(), stock_effect, from_type, to_type]
    );

    const createdType = result.rows[0];

    await logAction({
      orgcode,
      userid: session.userid,
      action: "CREATE_TRANSACTION_TYPE",
      details: { code: createdType.code, name: name.trim() },
    });

    return NextResponse.json({
      success: true,
      message: "Transaction type created successfully",
      transactionType: createdType,
    });
  } catch (error: any) {
    if (error.code === "23505") { // Unique/Primary Key violation
      return NextResponse.json(
        { success: false, message: "A transaction type with this code already exists" },
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
    const code = searchParams.get("code");

    if (!orgcode || code === null) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters (orgcode, code)" },
        { status: 400 }
      );
    }

    const intCode = parseInt(code, 10);
    if (isNaN(intCode)) {
      return NextResponse.json(
        { success: false, message: "Transaction type code must be an integer" },
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

    // Retrieve type to check ownership
    const typeCheck = await query(
      "SELECT orgcode, id FROM public.inventory_transaction_types WHERE code = $1 AND (orgcode = $2 OR orgcode = 'SUPER')",
      [intCode, orgcode]
    );
    if (typeCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Transaction type not found" }, { status: 404 });
    }

    const typeOrg = typeCheck.rows[0].orgcode;
    const typeId = typeCheck.rows[0].id;

    // Restrict deletion of global types to SUPER org only
    if (typeOrg === "SUPER" && orgcode !== "SUPER") {
      return NextResponse.json(
        { success: false, message: "Global transaction types cannot be deleted by company users." },
        { status: 403 }
      );
    }

    // Check if any transaction headers use this transaction type
    const txCheck = await query(
      `SELECT COUNT(*) as count
       FROM public.inventory_transaction_headers h
       WHERE h.transaction_type_id = $1`,
      [typeId]
    );
    const txCount = parseInt(txCheck.rows[0]?.count || "0", 10);

    if (txCount > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Deletion not possible — transaction type "${intCode}" is used in ${txCount} voucher transaction(s). Please remove those vouchers first.`,
          activeTransactions: txCount,
        },
        { status: 409 }
      );
    }

    const result = await query(
      "DELETE FROM public.inventory_transaction_types WHERE orgcode = $1 AND code = $2 RETURNING code, name",
      [typeOrg, intCode]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Transaction type not found" },
        { status: 404 }
      );
    }

    await logAction({
      orgcode,
      userid: session.userid,
      action: "DELETE_TRANSACTION_TYPE",
      details: { code: intCode, name: result.rows[0].name },
    });

    return NextResponse.json({
      success: true,
      message: `Transaction type "${intCode}" deleted successfully`,
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
    const { orgcode, code, name, stock_effect, from_type, to_type } = body;

    if (!orgcode || code === undefined || !name || !stock_effect || !from_type || !to_type) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters" },
        { status: 400 }
      );
    }

    const intCode = parseInt(code, 10);
    if (isNaN(intCode)) {
      return NextResponse.json(
        { success: false, message: "Transaction type code must be an integer" },
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

    // Retrieve type to check ownership
    const typeCheck = await query(
      "SELECT orgcode FROM public.inventory_transaction_types WHERE code = $1 AND (orgcode = $2 OR orgcode = 'SUPER')",
      [intCode, orgcode]
    );
    if (typeCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Transaction type not found" }, { status: 404 });
    }

    const typeOrg = typeCheck.rows[0].orgcode;

    // Restrict editing of global types to SUPER org only
    if (typeOrg === "SUPER" && orgcode !== "SUPER") {
      return NextResponse.json(
        { success: false, message: "Global transaction types cannot be modified by company users." },
        { status: 403 }
      );
    }

    const result = await query(
      `UPDATE public.inventory_transaction_types 
       SET name = $1, stock_effect = $2, from_type = $3, to_type = $4
       WHERE orgcode = $5 AND code = $6
       RETURNING code, name, stock_effect, from_type, to_type`,
      [name.trim(), stock_effect, from_type, to_type, typeOrg, intCode]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Transaction type not found" },
        { status: 404 }
      );
    }

    await logAction({
      orgcode,
      userid: session.userid,
      action: "UPDATE_TRANSACTION_TYPE",
      details: { code: intCode, name: name.trim() },
    });

    return NextResponse.json({
      success: true,
      message: "Transaction type updated successfully",
      transactionType: result.rows[0],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
