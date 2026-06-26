import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";

// Helper to verify that the request is made by a super admin and get session details
async function getSuperAdminSession(): Promise<{ ok: boolean; orgcode?: string; userid?: string }> {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    const orgcode = cookieStore.get("orgcode")?.value;

    if (!authtoken || !orgcode) return { ok: false };

    const result = await query(
      "SELECT userid, issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
      [authtoken, orgcode]
    );
    if (result.rows.length > 0 && result.rows[0].issuperadmin) {
      return { ok: true, orgcode, userid: result.rows[0].userid };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

// GET: Fetch all coupons with usage statistics
export async function GET(request: Request) {
  try {
    const result = await query(
      `SELECT c.code, c.discount, c.type, c.value, c.status, c.start_date, c.expiry_date,
              COALESCE(u.usage_count, 0)::int as total_usage
       FROM public.coupons c
       LEFT JOIN (
         SELECT code, COUNT(*) as usage_count 
         FROM public.coupon_uses 
         GROUP BY code
       ) u ON c.code = u.code
       ORDER BY c.code ASC`
     );
    return NextResponse.json({ success: true, coupons: result.rows });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch coupons" },
      { status: 500 }
    );
  }
}

// POST: Add new coupon
export async function POST(request: Request) {
  const sessionInfo = await getSuperAdminSession();
  if (!sessionInfo.ok || !sessionInfo.orgcode || !sessionInfo.userid) {
    return NextResponse.json({ success: false, message: "Forbidden: Super Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { code, discount, type, value, status = "active", start_date, expiry_date } = body;

    if (!code || !discount || !type || value === undefined || !expiry_date) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const codeUpper = code.trim().toUpperCase();

    // Check if code exists
    const checkExist = await query("SELECT code FROM public.coupons WHERE code = $1", [codeUpper]);
    if (checkExist.rows.length > 0) {
      return NextResponse.json({ success: false, message: "Coupon code already exists" }, { status: 400 });
    }

    const startDateVal = start_date ? new Date(start_date) : new Date();
    const expiryDateVal = new Date(expiry_date);

    await query(
      `INSERT INTO public.coupons (code, discount, type, value, status, start_date, expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [codeUpper, discount.trim(), type, parseFloat(value), status, startDateVal, expiryDateVal]
    );

    // Audit Log for Coupon Creation
    await logAction({
      orgcode: sessionInfo.orgcode,
      userid: sessionInfo.userid,
      action: "SUPER_ADMIN_CREATE_COUPON",
      details: {
        code: codeUpper,
        discount: discount.trim(),
        type,
        value,
        status,
        start_date: startDateVal,
        expiry_date: expiryDateVal
      }
    });

    return NextResponse.json({ success: true, message: "Coupon created successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create coupon" },
      { status: 500 }
    );
  }
}

// PUT: Update coupon
export async function PUT(request: Request) {
  const sessionInfo = await getSuperAdminSession();
  if (!sessionInfo.ok || !sessionInfo.orgcode || !sessionInfo.userid) {
    return NextResponse.json({ success: false, message: "Forbidden: Super Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { code, discount, type, value, status, start_date, expiry_date } = body;

    if (!code || !discount || !type || value === undefined || !expiry_date || !status) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const codeUpper = code.trim().toUpperCase();
    const startDateVal = new Date(start_date);
    const expiryDateVal = new Date(expiry_date);

    const updateRes = await query(
      `UPDATE public.coupons 
       SET discount = $1, type = $2, value = $3, status = $4, start_date = $5, expiry_date = $6
       WHERE code = $7`,
      [discount.trim(), type, parseFloat(value), status, startDateVal, expiryDateVal, codeUpper]
    );

    if (updateRes.rowCount === 0) {
      return NextResponse.json({ success: false, message: "Coupon not found" }, { status: 404 });
    }

    // Audit Log for Coupon Modification
    await logAction({
      orgcode: sessionInfo.orgcode,
      userid: sessionInfo.userid,
      action: "SUPER_ADMIN_UPDATE_COUPON",
      details: {
        code: codeUpper,
        discount: discount.trim(),
        type,
        value,
        status,
        start_date: startDateVal,
        expiry_date: expiryDateVal
      }
    });

    return NextResponse.json({ success: true, message: "Coupon updated successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update coupon" },
      { status: 500 }
    );
  }
}

// DELETE: Delete coupon
export async function DELETE(request: Request) {
  const sessionInfo = await getSuperAdminSession();
  if (!sessionInfo.ok || !sessionInfo.orgcode || !sessionInfo.userid) {
    return NextResponse.json({ success: false, message: "Forbidden: Super Admin access required" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ success: false, message: "Code parameter is required" }, { status: 400 });
    }

    const codeUpper = code.trim().toUpperCase();
    const deleteRes = await query("DELETE FROM public.coupons WHERE code = $1", [codeUpper]);

    if (deleteRes.rowCount === 0) {
      return NextResponse.json({ success: false, message: "Coupon not found" }, { status: 404 });
    }

    // Audit Log for Coupon Deletion
    await logAction({
      orgcode: sessionInfo.orgcode,
      userid: sessionInfo.userid,
      action: "SUPER_ADMIN_DELETE_COUPON",
      details: {
        code: codeUpper
      }
    });

    return NextResponse.json({ success: true, message: "Coupon deleted successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete coupon" },
      { status: 500 }
    );
  }
}
