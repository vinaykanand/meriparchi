import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    if (!authtoken) {
      return NextResponse.json({ success: false, message: "Unauthorized: Missing authtoken" }, { status: 401 });
    }

    // Verify user is superadmin
    const result = await query(
      "SELECT userid, issuperadmin, orgcode FROM public.users WHERE authtoken = $1 AND isactive = true",
      [authtoken]
    );

    if (result.rows.length === 0 || !result.rows[0].issuperadmin) {
      return NextResponse.json({ success: false, message: "Forbidden: Super Admin access required" }, { status: 403 });
    }

    const superUser = result.rows[0];
    const body = await request.json();
    const { targetOrgcode } = body;

    if (!targetOrgcode) {
      return NextResponse.json({ success: false, message: "Missing target orgcode" }, { status: 400 });
    }

    const cleanOrgcode = targetOrgcode.trim().toUpperCase();

    // Verify target company exists (or it is SUPER if we are returning)
    if (cleanOrgcode !== "SUPER") {
      const checkCompany = await query("SELECT orgcode FROM public.company WHERE orgcode = $1", [cleanOrgcode]);
      if (checkCompany.rows.length === 0) {
        return NextResponse.json({ success: false, message: "Target company does not exist" }, { status: 404 });
      }
    }

    // Set the orgcode cookie
    cookieStore.set("orgcode", cleanOrgcode, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    const userAgent = request.headers.get("user-agent") || "unknown";
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    if (cleanOrgcode !== "SUPER") {
      // Handle targetUserId - validate and store in cookie
      const { targetUserId } = body;
      let impersonateUserId = "admin";

      if (targetUserId) {
        const userCheck = await query(
          "SELECT userid FROM public.users WHERE orgcode = $1 AND userid = $2 AND isactive = true",
          [cleanOrgcode, targetUserId.trim()]
        );
        if (userCheck.rows.length > 0) {
          impersonateUserId = userCheck.rows[0].userid;
        }
      } else {
        // Fallback: try to find an admin user
        const adminCheck = await query(
          "SELECT userid FROM public.users WHERE orgcode = $1 AND isadmin = true AND isactive = true ORDER BY userid ASC LIMIT 1",
          [cleanOrgcode]
        );
        if (adminCheck.rows.length > 0) {
          impersonateUserId = adminCheck.rows[0].userid;
        }
      }

      // Store the impersonation user identity in a cookie
      cookieStore.set("impersonate_userid", impersonateUserId, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });

      // Write ONLY one audit log under the SUPER company, none under target client
      await logAction({
        orgcode: "SUPER",
        userid: superUser.userid,
        action: "SUPER_ADMIN_IMPERSONATE",
        details: { targetOrgcode: cleanOrgcode, targetUserId: impersonateUserId, ip, userAgent },
      });
    } else {
      // Returning to SUPER - clear the impersonation user cookie
      cookieStore.set("impersonate_userid", "", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
    }

    return NextResponse.json({
      success: true,
      message: cleanOrgcode === "SUPER" ? "Returned to Super Admin" : `Impersonation session initialized for ${cleanOrgcode}`
    });
  } catch (error: any) {
    console.error("Impersonate API Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
