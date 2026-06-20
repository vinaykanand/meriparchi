import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool, { query } from "@/lib/db";
import AdmZip from "adm-zip";

export async function POST(request: Request) {
  let client;
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

    const adminOrgcode = sessionCheck.rows[0].orgcode;
    const adminUserid = sessionCheck.rows[0].userid;

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let zip;
    try {
      zip = new AdmZip(buffer);
    } catch (e: any) {
      return NextResponse.json({ success: false, message: "Invalid zip file format" }, { status: 400 });
    }

    // Extract and parse JSON files
    const companyEntry = zip.getEntry("company.json");
    const usersEntry = zip.getEntry("users.json");
    const paymentsEntry = zip.getEntry("payments.json");
    const slipsEntry = zip.getEntry("slips.json");
    const slipitemsEntry = zip.getEntry("slipitems.json");

    if (!companyEntry || !usersEntry || !paymentsEntry || !slipsEntry || !slipitemsEntry) {
      return NextResponse.json(
        { success: false, message: "Backup file is missing required table data JSON files." },
        { status: 400 }
      );
    }

    const companyData = JSON.parse(companyEntry.getData().toString("utf8"));
    const usersData = JSON.parse(usersEntry.getData().toString("utf8"));
    const paymentsData = JSON.parse(paymentsEntry.getData().toString("utf8"));
    const slipsData = JSON.parse(slipsEntry.getData().toString("utf8"));
    const slipitemsData = JSON.parse(slipitemsEntry.getData().toString("utf8"));

    const auditLogsEntry = zip.getEntry("audit_logs.json");
    let auditLogsData = [];
    if (auditLogsEntry) {
      try {
        auditLogsData = JSON.parse(auditLogsEntry.getData().toString("utf8"));
      } catch (e) {
        console.error("Failed to parse audit_logs.json, skipping");
      }
    }

    // Validation: Ensure all records in backup belong to the logged-in admin's orgcode
    for (const row of companyData) {
      if (row.orgcode !== adminOrgcode) {
        return NextResponse.json({ success: false, message: "Tenant mismatch in company data." }, { status: 403 });
      }
    }
    for (const row of usersData) {
      if (row.orgcode !== adminOrgcode) {
        return NextResponse.json({ success: false, message: "Tenant mismatch in users data." }, { status: 403 });
      }
    }
    for (const row of paymentsData) {
      if (row.orgcode !== adminOrgcode) {
        return NextResponse.json({ success: false, message: "Tenant mismatch in payments data." }, { status: 403 });
      }
    }
    for (const row of slipsData) {
      if (row.orgcode !== adminOrgcode) {
        return NextResponse.json({ success: false, message: "Tenant mismatch in slips data." }, { status: 403 });
      }
    }
    for (const row of auditLogsData) {
      if (row.orgcode !== adminOrgcode) {
        return NextResponse.json({ success: false, message: "Tenant mismatch in audit logs data." }, { status: 403 });
      }
    }

    // Connect DB client for Transaction
    client = await pool.connect();
    await client.query("BEGIN");

    // 1. Clear existing company data
    // Delete slipitems for company slips
    await client.query(
      "DELETE FROM public.slipitems WHERE id IN (SELECT id FROM public.slips WHERE orgcode = $1)",
      [adminOrgcode]
    );
    // Delete slips
    await client.query("DELETE FROM public.slips WHERE orgcode = $1", [adminOrgcode]);
    // Delete payments
    await client.query("DELETE FROM public.payments WHERE orgcode = $1", [adminOrgcode]);
    // Delete other users (keep current logged-in admin to prevent session invalidation)
    await client.query("DELETE FROM public.users WHERE orgcode = $1 AND userid <> $2", [
      adminOrgcode,
      adminUserid,
    ]);
    // Delete audit logs
    await client.query("DELETE FROM public.audit_logs WHERE orgcode = $1", [adminOrgcode]);

    // 2. Restore Company settings
    if (companyData.length > 0) {
      const c = companyData[0];
      await client.query(
        `UPDATE public.company 
         SET orgname = $1, isactive = $2, enableotp = $3, otpresettime = $4, opentime = $5, closetime = $6, audit_retention_days = $7,
             gdrive_client_id = $8, gdrive_client_secret = $9, gdrive_refresh_token = $10, backup_schedule = $11, last_backup_time = $12,
             enable_security_logs = $13, enable_ai_assistant = $14
         WHERE orgcode = $15`,
        [
          c.orgname,
          c.isactive,
          c.enableotp,
          c.otpresettime,
          c.opentime,
          c.closetime,
          c.audit_retention_days || 15,
          c.gdrive_client_id || null,
          c.gdrive_client_secret || null,
          c.gdrive_refresh_token || null,
          c.backup_schedule || null,
          c.last_backup_time || null,
          c.enable_security_logs !== undefined ? c.enable_security_logs : null,
          c.enable_ai_assistant !== undefined ? c.enable_ai_assistant : null,
          adminOrgcode,
        ]
      );
    }

    // 3. Restore Users
    for (const u of usersData) {
      if (u.userid === adminUserid) {
        // Update current admin credentials/details
        await client.query(
          `UPDATE public.users 
           SET password = $1, isactive = $2, isadmin = $3, otp = $4, otpexpire = $5
           WHERE orgcode = $6 AND userid = $7`,
          [u.password, u.isactive, u.isadmin, u.otp, u.otpexpire, adminOrgcode, adminUserid]
        );
      } else {
        // Insert other users
        await client.query(
          `INSERT INTO public.users (orgcode, userid, password, isadmin, authtoken, isactive, otp, otpexpire, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [u.orgcode, u.userid, u.password, u.isadmin, u.authtoken, u.isactive, u.otp, u.otpexpire, u.created_at]
        );
      }
    }

    // 4. Restore Payments
    for (const p of paymentsData) {
      await client.query(
        `INSERT INTO public.payments (id, orgcode, phone, date, amount, narration)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [p.id, p.orgcode, p.phone, p.date, p.amount, p.narration]
      );
    }

    // 5. Restore Slips
    for (const s of slipsData) {
      await client.query(
        `INSERT INTO public.slips (id, orgcode, slipno, date, phone, name, address, totalamount, discount, netamount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [s.id, s.orgcode, s.slipno, s.date, s.phone, s.name, s.address, s.totalamount, s.discount, s.netamount]
      );
    }

    // 6. Restore Slip Items
    for (const si of slipitemsData) {
      await client.query(
        `INSERT INTO public.slipitems (id, item, remarks, qty, rate, amount)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [si.id, si.item, si.remarks, si.qty, si.rate, si.amount]
      );
    }

    // 6.5. Restore Audit Logs
    for (const al of auditLogsData) {
      await client.query(
        `INSERT INTO public.audit_logs (id, orgcode, userid, action, details, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [al.id, al.orgcode, al.userid, al.action, typeof al.details === 'object' ? JSON.stringify(al.details) : al.details, al.timestamp]
      );
    }

    // 7. Reset Serial Sequences so new inserts don't conflict with restored IDs
    if (paymentsData.length > 0) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('public.payments', 'id'), COALESCE(MAX(id), 1)) FROM public.payments`
      );
    }
    if (slipsData.length > 0) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('public.slips', 'id'), COALESCE(MAX(id), 1)) FROM public.slips`
      );
    }
    if (slipitemsData.length > 0) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('public.slipitems', 'id'), COALESCE(MAX(id), 1)) FROM public.slipitems`
      );
    }
    if (auditLogsData.length > 0) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('public.audit_logs', 'id'), COALESCE(MAX(id), 1)) FROM public.audit_logs`
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ success: true, message: "Company data restored successfully" });
  } catch (error: any) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError);
      }
    }
    return NextResponse.json(
      { success: false, message: error.message || "Restore failed" },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}
