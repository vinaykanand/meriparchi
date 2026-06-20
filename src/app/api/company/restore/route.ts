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

    // Check if restoring from Google Drive fileId
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    let buffer: Buffer;

    if (fileId) {
      const gdrive_client_id = process.env.GOOGLE_DRIVE_CLIENT_ID;
      const gdrive_client_secret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

      if (!gdrive_client_id || !gdrive_client_secret) {
        return NextResponse.json(
          { success: false, message: "Google Drive OAuth credentials are not configured on the server." },
          { status: 500 }
        );
      }

      const configRes = await query(
        "SELECT gdrive_refresh_token FROM public.company WHERE orgcode = $1",
        [adminOrgcode]
      );
      const { gdrive_refresh_token } = configRes.rows[0] || {};
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

      // Download file contents from Google Drive
      const downloadRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: { "Authorization": `Bearer ${accessToken}` },
        }
      );

      if (!downloadRes.ok) {
        return NextResponse.json({ success: false, message: "Failed to download backup file from Google Drive." }, { status: 500 });
      }

      buffer = Buffer.from(await downloadRes.arrayBuffer());
    } else {
      // Parse the multipart form data
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 });
      }

      buffer = Buffer.from(await file.arrayBuffer());
    }
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
             gdrive_refresh_token = $8, backup_schedule = $9, last_backup_time = $10,
             enable_security_logs = $11, enable_ai_assistant = $12
         WHERE orgcode = $13`,
        [
          c.orgname,
          c.isactive,
          c.enableotp,
          c.otpresettime,
          c.opentime,
          c.closetime,
          c.audit_retention_days || 15,
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
        `INSERT INTO public.slips (id, orgcode, slipno, date, phone, name, address, totalamount, discount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [s.id, s.orgcode, s.slipno, s.date, s.phone, s.name, s.address, s.totalamount, s.discount]
      );
    }

    // 6. Restore Slip Items
    for (const si of slipitemsData) {
      await client.query(
        `INSERT INTO public.slipitems (id, item, remarks, qty, rate)
         VALUES ($1, $2, $3, $4, $5)`,
        [si.id, si.item, si.remarks, si.qty, si.rate]
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
