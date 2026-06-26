import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";

// Helper to verify super admin
async function verifySuperAdmin(): Promise<{ ok: boolean; status: number; message: string; adminUserid?: string }> {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (!authtoken) {
      return { ok: false, status: 401, message: "Unauthorized: Missing authtoken" };
    }

    const result = await query(
      "SELECT userid, issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = 'SUPER' AND isactive = true",
      [authtoken]
    );

    if (result.rows.length === 0 || !result.rows[0].issuperadmin) {
      return { ok: false, status: 403, message: "Forbidden: Super Admin access required" };
    }

    return { ok: true, status: 200, message: "Authorized", adminUserid: result.rows[0].userid };
  } catch (error: any) {
    return { ok: false, status: 500, message: error.message || "Internal server error" };
  }
}

// GET: Retrieve global super admin settings
export async function GET() {
  const auth = await verifySuperAdmin();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  try {
    const result = await query("SELECT allow_public_signup FROM public.company WHERE orgcode = 'SUPER'");
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Super Admin Org not found in company table" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      settings: {
        allowPublicSignup: result.rows[0].allow_public_signup !== false
      }
    });
  } catch (error: any) {
    console.error("Super Admin Settings GET Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server Error" }, { status: 500 });
  }
}

// PUT: Update global settings
export async function PUT(request: Request) {
  const auth = await verifySuperAdmin();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { allowPublicSignup } = body;

    if (allowPublicSignup === undefined) {
      return NextResponse.json({ success: false, message: "Missing allowPublicSignup value" }, { status: 400 });
    }

    await query(
      "UPDATE public.company SET allow_public_signup = $1 WHERE orgcode = 'SUPER'",
      [allowPublicSignup === true]
    );

    // Audit log
    await logAction({
      orgcode: "SUPER",
      userid: auth.adminUserid || "superadmin",
      action: "SUPER_ADMIN_TOGGLE_SIGNUP",
      details: {
        allowPublicSignup: allowPublicSignup === true
      }
    });

    return NextResponse.json({
      success: true,
      message: `Global public signup successfully ${allowPublicSignup ? "enabled" : "disabled"}.`
    });
  } catch (error: any) {
    console.error("Super Admin Settings PUT Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server Error" }, { status: 500 });
  }
}
