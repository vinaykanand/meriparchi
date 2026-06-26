import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

async function verifySuperAdmin(): Promise<{ ok: boolean; status: number; message: string }> {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    const orgcode = cookieStore.get("orgcode")?.value;

    if (!authtoken || !orgcode) {
      return { ok: false, status: 401, message: "Unauthorized: Missing authtoken or orgcode" };
    }

    const result = await query(
      "SELECT issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
      [authtoken, orgcode]
    );

    if (result.rows.length === 0 || !result.rows[0].issuperadmin) {
      return { ok: false, status: 403, message: "Forbidden: Super Admin access required" };
    }

    return { ok: true, status: 200, message: "Authorized" };
  } catch (error: any) {
    return { ok: false, status: 500, message: error.message || "Internal server error" };
  }
}

// GET: Retrieve all audit logs across all orgs, with pagination & search & filtering
export async function GET(request: Request) {
  const auth = await verifySuperAdmin();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filterOrgcode = searchParams.get("orgcode") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const search = searchParams.get("search") || "";
    const actionFilter = searchParams.get("action") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const offset = (page - 1) * limit;

    let queryText = `
      SELECT id, orgcode, userid, action, details, timestamp 
      FROM public.audit_logs 
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filterOrgcode) {
      queryText += ` AND orgcode = $${paramIndex++}`;
      params.push(filterOrgcode.trim().toUpperCase());
    }

    if (actionFilter) {
      const actions = actionFilter.split(",").map(a => a.trim()).filter(Boolean);
      if (actions.length > 0) {
        queryText += ` AND action = ANY($${paramIndex++}::varchar[])`;
        params.push(actions);
      }
    }

    if (startDate) {
      queryText += ` AND timestamp >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      const adjustedEndDate = endDate.includes(" ") || endDate.includes("T") ? endDate : `${endDate} 23:59:59.999`;
      queryText += ` AND timestamp <= $${paramIndex++}`;
      params.push(adjustedEndDate);
    }

    if (search) {
      queryText += ` AND (orgcode ILIKE $${paramIndex} OR userid ILIKE $${paramIndex} OR action ILIKE $${paramIndex} OR details::text ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count
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
    console.error("Super Admin Fetch Audit Logs Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}

// DELETE: Purge ALL audit logs globally (or for specific org if specified)
export async function DELETE(request: Request) {
  const auth = await verifySuperAdmin();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filterOrgcode = searchParams.get("orgcode");

    const body = await request.json().catch(() => ({}));
    const password = body.password;

    if (!password) {
      return NextResponse.json({ success: false, message: "Super admin password is required" }, { status: 400 });
    }

    // Verify super admin password
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    const orgcode = cookieStore.get("orgcode")?.value;

    const sessionCheck = await query(
      "SELECT password FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND issuperadmin = true AND isactive = true",
      [authtoken, orgcode]
    );

    if (sessionCheck.rows.length === 0 || sessionCheck.rows[0].password !== password) {
      return NextResponse.json({ success: false, message: "Invalid password" }, { status: 401 });
    }

    if (filterOrgcode) {
      await query("DELETE FROM public.audit_logs WHERE orgcode = $1", [filterOrgcode.trim().toUpperCase()]);
      return NextResponse.json({ success: true, message: `Audit logs for ${filterOrgcode.toUpperCase()} purged successfully` });
    } else {
      await query("DELETE FROM public.audit_logs");
      return NextResponse.json({ success: true, message: "All system audit logs purged successfully" });
    }
  } catch (error: any) {
    console.error("Super Admin Purge Audit Logs Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
