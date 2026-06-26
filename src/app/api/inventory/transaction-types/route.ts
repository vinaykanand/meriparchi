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
      `SELECT code, name, stock_effect, from_type, to_type, created_at 
       FROM public.inventory_transaction_types 
       WHERE orgcode = $1 
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

    const result = await query(
      `INSERT INTO public.inventory_transaction_types (orgcode, code, name, stock_effect, from_type, to_type) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING code, name, stock_effect, from_type, to_type`,
      [orgcode, intCode, name.trim(), stock_effect, from_type, to_type]
    );

    await logAction({
      orgcode,
      userid: session.userid,
      action: "CREATE_TRANSACTION_TYPE",
      details: { code: intCode, name: name.trim() },
    });

    return NextResponse.json({
      success: true,
      message: "Transaction type created successfully",
      transactionType: result.rows[0],
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

    const result = await query(
      `UPDATE public.inventory_transaction_types 
       SET name = $1, stock_effect = $2, from_type = $3, to_type = $4
       WHERE orgcode = $5 AND code = $6
       RETURNING code, name, stock_effect, from_type, to_type`,
      [name.trim(), stock_effect, from_type, to_type, orgcode, intCode]
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
