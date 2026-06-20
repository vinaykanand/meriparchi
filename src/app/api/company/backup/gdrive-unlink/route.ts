import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (!authtoken) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const sessionCheck = await query(
      "SELECT orgcode, userid, isadmin FROM public.users WHERE authtoken = $1 AND isactive = true",
      [authtoken]
    );

    if (sessionCheck.rows.length === 0 || sessionCheck.rows[0].isadmin !== true) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { orgcode, userid } = sessionCheck.rows[0];

    // Clear refresh token and last backup time from company table
    await query(
      "UPDATE public.company SET gdrive_refresh_token = NULL, last_backup_time = NULL WHERE orgcode = $1",
      [orgcode]
    );

    await logAction({
      orgcode,
      userid,
      action: "UNLINK_GOOGLE_DRIVE",
      details: { message: "Google Drive unlinked by admin" },
    });

    return NextResponse.json({ success: true, message: "Google Drive successfully unlinked." });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to unlink Google Drive" },
      { status: 500 }
    );
  }
}
