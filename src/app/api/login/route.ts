import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgcode, userid, password, otp } = body;

    if (!orgcode || !userid || !password) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const targetOrgcode = orgcode.trim().toUpperCase();
    const userAgent = request.headers.get("user-agent") || "unknown";
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    // 1. Check if a Super Admin is attempting to impersonate a client organization
    const superCheck = await query(
      "SELECT userid, password, authtoken FROM public.users WHERE orgcode = 'SUPER' AND userid = $1 AND issuperadmin = true AND isactive = true",
      [userid]
    );

    if (superCheck.rows.length > 0 && superCheck.rows[0].password === password && targetOrgcode !== "SUPER") {
      const superUser = superCheck.rows[0];
      const data = {
        success: true,
        userid: superUser.userid,
        orgcode: targetOrgcode,
        authtoken: superUser.authtoken,
        isadmin: true,
        issuperadmin: true,
        isImpersonation: true
      };

      const cookieStore = await cookies();
      cookieStore.set("authtoken", data.authtoken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      cookieStore.set("orgcode", targetOrgcode, {
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
        details: { targetOrgcode, ip, userAgent },
      });

      return NextResponse.json(data, { status: 200 });
    }

    const result = await query(
      "SELECT public.login_user($1, $2, $3, $4) as result",
      [orgcode, userid, password, otp || null]
    );

    // Read security logging preference
    const companyCheck = await query(
      "SELECT enable_security_logs FROM public.company WHERE orgcode = $1",
      [orgcode]
    );
    const enableSecurityLogs = companyCheck.rows.length > 0 && companyCheck.rows[0].enable_security_logs !== false;

    if (result.rows.length === 0) {
      if (enableSecurityLogs) {
        await logAction({
          orgcode,
          userid,
          action: "LOGIN_FAILED",
          details: { username: userid, ip, userAgent, message: "Database query returned no rows" },
        });
      }
      return NextResponse.json({ success: false, message: "Login failed" }, { status: 400 });
    }

    const data = result.rows[0].result;

    if (!data || !data.success) {
      if (enableSecurityLogs) {
        await logAction({
          orgcode,
          userid,
          action: "LOGIN_FAILED",
          details: { username: userid, ip, userAgent, message: data?.message || "Invalid credentials" },
        });
      }
      return NextResponse.json(data || { success: false, message: "Login failed" }, { status: 400 });
    }

    // Check if the user is a super admin
    let isSuperAdmin = false;
    if (data.authtoken) {
      const superAdminCheck = await query(
        "SELECT issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = $2",
        [data.authtoken, data.orgcode || orgcode]
      );
      if (superAdminCheck.rows.length > 0 && superAdminCheck.rows[0].issuperadmin) {
        data.issuperadmin = true;
        isSuperAdmin = true;
      }
    }

    // Only allow superadmin users to login under the SUPER organization code
    if (orgcode.trim().toUpperCase() === "SUPER" && !isSuperAdmin) {
      if (enableSecurityLogs) {
        await logAction({
          orgcode,
          userid,
          action: "LOGIN_FAILED",
          details: { username: userid, ip, userAgent, message: "Unauthorized access: non-superadmin login attempt on SUPER orgcode" },
        });
      }
      return NextResponse.json({ success: false, message: "Only superadmin can login under this organization code." }, { status: 403 });
    }

    // Set the cookie if authtoken is present in the login response
    if (data.authtoken) {
      const cookieStore = await cookies();
      cookieStore.set("authtoken", data.authtoken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });
      cookieStore.set("orgcode", data.orgcode || body.orgcode, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });
    }

    if (enableSecurityLogs) {
      await logAction({
        orgcode,
        userid: data.userid || userid,
        action: "LOGIN_SUCCESS",
        details: { username: data.userid || userid, ip, userAgent },
      });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Login API Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
