import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const search = searchParams.get("search") || "";
    const actionFilter = searchParams.get("action") || "";

    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (!authtoken || !orgcode) {
      return NextResponse.json({ success: false, message: "Missing required parameters" }, { status: 400 });
    }

    // Verify session and that the user is an admin
    const sessionCheck = await query(
      "SELECT userid, isadmin FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
      [authtoken, orgcode]
    );

    if (sessionCheck.rows.length === 0 || !sessionCheck.rows[0].isadmin) {
      return NextResponse.json({ success: false, message: "Unauthorized: Admin access required" }, { status: 401 });
    }

    const offset = (page - 1) * limit;

    // Build conditional query
    let queryText = `
      SELECT id, userid, action, details, timestamp 
      FROM public.audit_logs 
      WHERE orgcode = $1
    `;
    const params: any[] = [orgcode];
    let paramIndex = 2;

    if (actionFilter) {
      queryText += ` AND action = $${paramIndex++}`;
      params.push(actionFilter);
    }

    if (search) {
      queryText += ` AND (userid ILIKE $${paramIndex} OR action ILIKE $${paramIndex} OR details::text ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count for pagination
    const countQueryText = `SELECT COUNT(*) as count FROM (${queryText}) as filtered`;
    const countResult = await query(countQueryText, params);
    const totalCount = parseInt(countResult.rows[0]?.count || "0", 10);

    // Add ordering and pagination
    queryText += ` ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const logsResult = await query(queryText, params);

    return NextResponse.json({
      success: true,
      logs: logsResult.rows,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error("Fetch Audit Logs Error:", error);
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

    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    const body = await request.json().catch(() => ({}));
    const password = body.password;

    if (!authtoken || !orgcode) {
      return NextResponse.json({ success: false, message: "Missing required parameters" }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ success: false, message: "Admin password is required" }, { status: 400 });
    }

    // Verify session, admin privilege, and password
    const sessionCheck = await query(
      "SELECT userid, isadmin, password FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
      [authtoken, orgcode]
    );

    if (sessionCheck.rows.length === 0 || !sessionCheck.rows[0].isadmin) {
      return NextResponse.json({ success: false, message: "Unauthorized: Admin access required" }, { status: 401 });
    }

    if (sessionCheck.rows[0].password !== password) {
      return NextResponse.json({ success: false, message: "Invalid password" }, { status: 401 });
    }

    // Purge audit logs for this organization
    await query("DELETE FROM public.audit_logs WHERE orgcode = $1", [orgcode]);

    return NextResponse.json({ success: true, message: "Audit logs purged successfully" });
  } catch (error: any) {
    console.error("Purge Audit Logs Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
