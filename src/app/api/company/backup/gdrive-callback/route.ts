import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const host = request.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  let isSuperAdmin = false;

  const buildErrorRedirect = (msg: string) => {
    const page = isSuperAdmin ? "super-admin" : "admin";
    const target = `${protocol}://${host}/dashboard/${page}/backup?gdrive=error&message=${encodeURIComponent(msg)}`;
    return NextResponse.redirect(target);
  };

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    let orgcode = searchParams.get("state") || ""; // state holds the orgcode

    if (orgcode.startsWith("superadmin_")) {
      isSuperAdmin = true;
      orgcode = orgcode.replace("superadmin_", "");
    }

    if (!code || !orgcode) {
      return buildErrorRedirect("Invalid callback request");
    }

    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    const sessionOrgcode = cookieStore.get("orgcode")?.value;

    if (!authtoken || !sessionOrgcode) {
      return buildErrorRedirect("Unauthorized: Please log in again");
    }

    // Verify user authorization: must be admin or a super admin
    const userCheck = await query(
      "SELECT isadmin, issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
      [authtoken, sessionOrgcode]
    );

    if (userCheck.rows.length === 0) {
      return buildErrorRedirect("Unauthorized: Invalid user session");
    }

    const { isadmin, issuperadmin } = userCheck.rows[0];

    // Block non-admins unless they are super admins
    if (!issuperadmin) {
      if (!isadmin || sessionOrgcode !== orgcode) {
        return buildErrorRedirect("Forbidden: Insufficient privileges");
      }
    }

    // Retrieve client credentials from environment variables
    const gdrive_client_id = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const gdrive_client_secret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

    if (!gdrive_client_id || !gdrive_client_secret) {
      return buildErrorRedirect("Google client configuration is missing on server environment");
    }

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
      return buildErrorRedirect(tokenData.error_description || "Token exchange failed");
    }

    const refresh_token = tokenData.refresh_token;

    if (!refresh_token) {
      // If we didn't get a refresh token, it might be because the app was already authorized.
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
      : `${protocol}://${host}/dashboard/admin/backup?gdrive=success`;
    return NextResponse.redirect(targetUrl);
  } catch (error: any) {
    return buildErrorRedirect(error.message || "Failed to process OAuth callback");
  }
}
