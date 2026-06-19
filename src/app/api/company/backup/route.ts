import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import AdmZip from "adm-zip";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (!authtoken) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const sessionCheck = await query(
      "SELECT orgcode, isadmin FROM public.users WHERE authtoken = $1 AND isactive = true",
      [authtoken]
    );

    if (sessionCheck.rows.length === 0 || sessionCheck.rows[0].isadmin !== true) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const orgcode = sessionCheck.rows[0].orgcode;

    // Fetch data from all company-related tables
    const company = await query("SELECT * FROM public.company WHERE orgcode = $1", [orgcode]);
    const users = await query("SELECT * FROM public.users WHERE orgcode = $1", [orgcode]);
    const payments = await query("SELECT * FROM public.payments WHERE orgcode = $1", [orgcode]);
    const slips = await query("SELECT * FROM public.slips WHERE orgcode = $1", [orgcode]);
    const slipitems = await query(
      "SELECT * FROM public.slipitems WHERE id IN (SELECT id FROM public.slips WHERE orgcode = $1)",
      [orgcode]
    );

    // Create Zip file
    const zip = new AdmZip();
    zip.addFile("company.json", Buffer.from(JSON.stringify(company.rows, null, 2)));
    zip.addFile("users.json", Buffer.from(JSON.stringify(users.rows, null, 2)));
    zip.addFile("payments.json", Buffer.from(JSON.stringify(payments.rows, null, 2)));
    zip.addFile("slips.json", Buffer.from(JSON.stringify(slips.rows, null, 2)));
    zip.addFile("slipitems.json", Buffer.from(JSON.stringify(slipitems.rows, null, 2)));

    const zipBuffer = zip.toBuffer();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup_${orgcode}_${timestamp}.zip`;

    return new Response(zipBuffer, {
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
