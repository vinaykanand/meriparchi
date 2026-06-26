import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { generateBackupZip } from "@/lib/backup";
import { logAction } from "@/lib/audit";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (!authtoken) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const sessionCheck = await query(
      "SELECT userid, orgcode, isadmin, issuperadmin FROM public.users WHERE authtoken = $1 AND isactive = true",
      [authtoken]
    );

    if (sessionCheck.rows.length === 0 || sessionCheck.rows[0].isadmin !== true) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const orgcode = sessionCheck.rows[0].orgcode;
    const userid = sessionCheck.rows[0].userid;
    const isSuperAdmin = sessionCheck.rows[0].issuperadmin === true || orgcode === "SUPER";

    const zipBuffer = await generateBackupZip(orgcode, isSuperAdmin);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = isSuperAdmin ? `super_backup_${timestamp}.zip` : `backup_${orgcode}_${timestamp}.zip`;

    // Log the backup operation in the audit log
    await logAction({
      orgcode,
      userid,
      action: "MANUAL_BACKUP_LOCAL",
      details: { success: true, filename },
    });

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Backup failed" },
      { status: 500 }
    );
  }
}
