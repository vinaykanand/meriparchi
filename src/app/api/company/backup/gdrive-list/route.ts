import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (!authtoken) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const sessionCheck = await query(
      "SELECT orgcode, isadmin, issuperadmin FROM public.users WHERE authtoken = $1 AND isactive = true",
      [authtoken]
    );

    if (sessionCheck.rows.length === 0 || sessionCheck.rows[0].isadmin !== true) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const orgcode = sessionCheck.rows[0].orgcode;
    const isSuperAdmin = sessionCheck.rows[0].issuperadmin === true || orgcode === "SUPER";

    const gdrive_client_id = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const gdrive_client_secret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

    if (!gdrive_client_id || !gdrive_client_secret) {
      return NextResponse.json({ success: false, message: "Google Drive OAuth credentials are not configured on the server." }, { status: 500 });
    }

    const configRes = await query(
      "SELECT gdrive_refresh_token FROM public.company WHERE orgcode = $1",
      [orgcode]
    );

    if (configRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Company profile not found" }, { status: 404 });
    }

    const { gdrive_refresh_token } = configRes.rows[0];

    if (!gdrive_refresh_token) {
      return NextResponse.json({ success: false, message: "Google Drive is not linked." }, { status: 400 });
    }

    // Exchange refresh token for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: gdrive_client_id,
        client_secret: gdrive_client_secret,
        refresh_token: gdrive_refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return NextResponse.json({ success: false, message: tokenData.error_description || "Token refresh failed." }, { status: 400 });
    }

    const accessToken = tokenData.access_token;

    // Find the target folder
    const folderName = isSuperAdmin ? "parchiadmin" : "MeriParchi";
    const searchRes = await fetch(
      "https://www.googleapis.com/drive/v3/files?" +
        new URLSearchParams({
          q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: "files(id)",
        }),
      {
        headers: { "Authorization": `Bearer ${accessToken}` },
      }
    );

    const searchData = await searchRes.json();
    if (!searchRes.ok) {
      return NextResponse.json({ success: false, message: "Failed to search folder on Google Drive" }, { status: 500 });
    }

    if (!searchData.files || searchData.files.length === 0) {
      return NextResponse.json({ success: true, backups: [] });
    }

    const folderId = searchData.files[0].id;

    // Get page token and page size from query
    const { searchParams } = new URL(request.url);
    const pageToken = searchParams.get("pageToken") || "";
    const limit = searchParams.get("limit") || "10";

    const fetchParams: Record<string, string> = {
      q: `'${folderId}' in parents and mimeType = 'application/zip' and trashed = false`,
      orderBy: "createdTime desc",
      pageSize: limit,
      fields: "nextPageToken, files(id, name, createdTime, size)",
    };

    if (pageToken) {
      fetchParams.pageToken = pageToken;
    }

    // List zip backups inside the folder
    const listRes = await fetch(
      "https://www.googleapis.com/drive/v3/files?" + new URLSearchParams(fetchParams),
      {
        headers: { "Authorization": `Bearer ${accessToken}` },
      }
    );

    const listData = await listRes.json();
    if (!listRes.ok) {
      return NextResponse.json({ success: false, message: "Failed to list backups on Google Drive" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      backups: listData.files || [], 
      nextPageToken: listData.nextPageToken || null 
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to retrieve Google Drive backups" },
      { status: 500 }
    );
  }
}
