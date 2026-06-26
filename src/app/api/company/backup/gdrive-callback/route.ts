import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    let orgcode = searchParams.get("state") || ""; // state holds the orgcode
    let isSuperAdmin = false;

    if (orgcode.startsWith("superadmin_")) {
      isSuperAdmin = true;
      orgcode = orgcode.replace("superadmin_", "");
    }

    if (!code || !orgcode) {
      return NextResponse.json({ success: false, message: "Invalid callback request" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    const sessionOrgcode = cookieStore.get("orgcode")?.value;

    if (!authtoken || !sessionOrgcode) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Verify user authorization: must be admin or a super admin
    const userCheck = await query(
      "SELECT isadmin, issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
      [authtoken, sessionOrgcode]
    );

    if (userCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { isadmin, issuperadmin } = userCheck.rows[0];

    // Block non-admins unless they are super admins
    if (!issuperadmin) {
      if (!isadmin || sessionOrgcode !== orgcode) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
      }
    }

    // Retrieve client credentials from environment variables
    const gdrive_client_id = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const gdrive_client_secret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

    if (!gdrive_client_id || !gdrive_client_secret) {
      return NextResponse.json({ success: false, message: "Missing Google client configuration in environment variables" }, { status: 500 });
    }

    const host = request.headers.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const redirect_uri = `${protocol}://${host}/api/company/backup/gdrive-callback`;

    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: gdrive_client_id,
        client_secret: gdrive_client_secret,
        redirect_uri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { success: false, message: tokenData.error_description || "Token exchange failed" },
        { status: 400 }
      );
    }

    const refresh_token = tokenData.refresh_token;

    if (!refresh_token) {
      // If we didn't get a refresh token, it might be because the app was already authorized.
      // We will warn the user or assume we already have one. But normally prompt=consent guarantees it.
      console.warn("No refresh token returned by Google.");
    } else {
      // Save refresh token
      await query(
        "UPDATE public.company SET gdrive_refresh_token = $1 WHERE orgcode = $2",
        [refresh_token, orgcode]
      );
    }

    // Redirect with success flag
    const targetUrl = isSuperAdmin
      ? `${protocol}://${host}/dashboard/super-admin/backup?gdrive=success`
      : `${protocol}://${host}/dashboard/admin/settings?gdrive=success`;
    return NextResponse.redirect(targetUrl);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process OAuth callback" },
      { status: 500 }
    );
  }
}
