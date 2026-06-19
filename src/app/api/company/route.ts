import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");

    if (!orgcode) {
      return NextResponse.json({ success: false, message: "Missing orgcode" }, { status: 400 });
    }

    const result = await query(
      `SELECT orgcode, orgname, isactive, enableotp, otpresettime, opentime, closetime, audit_retention_days, 
              gdrive_client_id, backup_schedule, last_backup_time, (gdrive_refresh_token IS NOT NULL) as gdrive_linked 
       FROM public.company WHERE orgcode = $1`,
      [orgcode]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, company: result.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
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

    const body = await request.json();
    const { 
      orgcode, orgname, enableotp, isactive, otpresettime, opentime, closetime, 
      audit_retention_days, gdrive_client_id, gdrive_client_secret, backup_schedule 
    } = body;

    // Optional: verify that the user's orgcode matches the request orgcode
    if (sessionCheck.rows[0].orgcode !== orgcode) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    // Preserve existing client secret if not supplied
    const companyRes = await query("SELECT gdrive_client_secret FROM public.company WHERE orgcode = $1", [orgcode]);
    const existingSecret = companyRes.rows[0]?.gdrive_client_secret;
    const finalSecret = gdrive_client_secret || existingSecret;

    await query(
      `UPDATE public.company 
       SET orgname = $1, enableotp = $2, isactive = $3, otpresettime = $4, opentime = $5, closetime = $6, 
           audit_retention_days = $7, gdrive_client_id = $8, gdrive_client_secret = $9, backup_schedule = $10 
       WHERE orgcode = $11`,
      [
        orgname, enableotp, isactive, otpresettime, opentime, closetime, 
        audit_retention_days || 15, gdrive_client_id, finalSecret, backup_schedule || 'none', orgcode
      ]
    );

    await logAction({
      orgcode,
      userid: sessionCheck.rows[0].userid,
      action: "UPDATE_COMPANY_SETTINGS",
      details: { 
        orgname, enableotp, isactive, otpresettime, opentime, closetime, 
        audit_retention_days, gdrive_client_id, backup_schedule 
      },
    });

    return NextResponse.json({ success: true, message: "Settings updated successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
