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
              backup_schedule, last_backup_time, (gdrive_refresh_token IS NOT NULL) as gdrive_linked,
              enable_security_logs, enable_ai_assistant, backup_retention_count, backup_password, email,
              subscription_type, subscription_start, subscription_end 
       FROM public.company WHERE orgcode = $1`,
      [orgcode]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
    }

    const slipsCountRes = await query("SELECT COUNT(*) as count FROM public.slips WHERE orgcode = $1", [orgcode]);
    const paymentsCountRes = await query("SELECT COUNT(*) as count FROM public.payments WHERE orgcode = $1", [orgcode]);

    const companyData = {
      ...result.rows[0],
      has_gdrive_config: !!process.env.GOOGLE_DRIVE_CLIENT_ID,
      subscription: {
        type: result.rows[0].subscription_type || 'trial',
        start: result.rows[0].subscription_start,
        end: result.rows[0].subscription_end,
        slips_count: parseInt(slipsCountRes.rows[0]?.count || "0", 10),
        payments_count: parseInt(paymentsCountRes.rows[0]?.count || "0", 10),
      }
    };

    return NextResponse.json({ success: true, company: companyData });
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
      audit_retention_days, backup_schedule,
      enable_security_logs, enable_ai_assistant, backup_retention_count, backup_password 
    } = body;

    // Optional: verify that the user's orgcode matches the request orgcode
    if (sessionCheck.rows[0].orgcode !== orgcode) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    await query(
      `UPDATE public.company 
       SET orgname = $1, enableotp = $2, isactive = $3, otpresettime = $4, opentime = $5, closetime = $6, 
           audit_retention_days = $7, backup_schedule = $8,
           enable_security_logs = $9, enable_ai_assistant = $10,
           backup_retention_count = $11, backup_password = $12
       WHERE orgcode = $13`,
      [
        orgname, enableotp, isactive, otpresettime, opentime, closetime, 
        audit_retention_days || 10, backup_schedule || 'none', 
        enable_security_logs !== false, enable_ai_assistant !== false, 
        backup_retention_count || 5, backup_password || '', orgcode
      ]
    );

    await logAction({
      orgcode,
      userid: sessionCheck.rows[0].userid,
      action: "UPDATE_COMPANY_SETTINGS",
      details: { 
        orgname, enableotp, isactive, otpresettime, opentime, closetime, 
        audit_retention_days, backup_schedule, enable_security_logs,
        enable_ai_assistant, backup_retention_count, has_backup_password: !!backup_password
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
