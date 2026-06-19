import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const orgcode = searchParams.get("state"); // state holds the orgcode

    if (!code || !orgcode) {
      return NextResponse.json({ success: false, message: "Invalid callback request" }, { status: 400 });
    }

    // Retrieve client credentials
    const companyRes = await query(
      "SELECT gdrive_client_id, gdrive_client_secret FROM public.company WHERE orgcode = $1",
      [orgcode]
    );

    if (companyRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
    }

    const { gdrive_client_id, gdrive_client_secret } = companyRes.rows[0];

    if (!gdrive_client_id || !gdrive_client_secret) {
      return NextResponse.json({ success: false, message: "Missing Google client configuration" }, { status: 400 });
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

    // Redirect to admin settings page with success flag
    const targetUrl = `${protocol}://${host}/dashboard/admin/settings?gdrive=success`;
    return NextResponse.redirect(targetUrl);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process OAuth callback" },
      { status: 500 }
    );
  }
}
