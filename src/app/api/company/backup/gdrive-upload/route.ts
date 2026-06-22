import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { uploadBackupToGDrive } from "@/lib/gdrive";
import { logAction } from "@/lib/audit";

export async function POST(request: Request) {
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
    const isSuperAdmin = sessionCheck.rows[0].issuperadmin === true;

    const result = await uploadBackupToGDrive(orgcode, isSuperAdmin);

    await logAction({
      orgcode,
      userid,
      action: "MANUAL_BACKUP_GDRIVE",
      details: {
        success: result.success,
        fileId: result.success ? (result as any).fileId : undefined,
        filename: result.success ? (result as any).filename : undefined,
        error: result.success ? undefined : result.message,
      },
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
