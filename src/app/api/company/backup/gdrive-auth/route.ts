import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");

    if (!orgcode) {
      return NextResponse.json({ success: false, message: "Missing orgcode parameter" }, { status: 400 });
    }

    const result = await query(
      "SELECT gdrive_client_id FROM public.company WHERE orgcode = $1",
      [orgcode]
    );

    if (result.rows.length === 0 || !result.rows[0].gdrive_client_id) {
      return NextResponse.json(
        { success: false, message: "Google Client ID is not configured. Please enter it in Settings first." },
        { status: 400 }
      );
    }

    const client_id = result.rows[0].gdrive_client_id;
    const host = request.headers.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const redirect_uri = `${protocol}://${host}/api/company/backup/gdrive-callback`;

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
      `client_id=${encodeURIComponent(client_id)}` +
      `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent("https://www.googleapis.com/auth/drive.file")}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(orgcode)}`;

    return NextResponse.redirect(oauthUrl);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}
