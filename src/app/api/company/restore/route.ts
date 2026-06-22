import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool, { query } from "@/lib/db";
import AdmZip from "adm-zip";
import { logAction } from "@/lib/audit";
import { decryptBuffer } from "@/lib/backup";
function sanitizeIdentifier(ident: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(ident)) {
    throw new Error(`Invalid identifier: ${ident}`);
  }
  return `"${ident}"`;
}

async function dynamicInsert(client: any, tableName: string, dataArray: any[]) {
  if (!dataArray || dataArray.length === 0) return;

  const cleanTableName = sanitizeIdentifier(tableName);

  // Retrieve any GENERATED ALWAYS columns for this table from the db schema metadata
  const genColsRes = await client.query(
    `SELECT column_name 
     FROM information_schema.columns 
     WHERE table_schema = 'public' 
       AND table_name = $1 
       AND is_generated = 'ALWAYS'`,
    [tableName]
  );
  const generatedColumns = new Set(genColsRes.rows.map((r: any) => r.column_name));

  for (const row of dataArray) {
    // Exclude generated columns from insert statement keys
    const columns = Object.keys(row).filter(col => !generatedColumns.has(col));
    const columnsStr = columns.map(c => sanitizeIdentifier(c)).join(", ");
    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(", ");
    const values = columns.map(col => {
      const val = row[col];
      if (val !== null && typeof val === "object") {
        return JSON.stringify(val);
      }
      return val;
    });
    await client.query(
      `INSERT INTO public.${cleanTableName} (${columnsStr}) VALUES (${placeholders})`,
      values
    );
  }
}

export async function POST(request: Request) {
  let client;
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (!authtoken) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const sessionCheck = await query(
      "SELECT orgcode, userid, isadmin, issuperadmin FROM public.users WHERE authtoken = $1 AND isactive = true",
      [authtoken]
    );

    if (sessionCheck.rows.length === 0 || sessionCheck.rows[0].isadmin !== true) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const adminOrgcode = sessionCheck.rows[0].orgcode;
    const adminUserid = sessionCheck.rows[0].userid;
    const isSuperAdmin = sessionCheck.rows[0].issuperadmin === true;

    // Block restores for the Super Admin management organization unless requester is super admin
    if (!isSuperAdmin) {
      const superAdminCheck = await query(
        "SELECT userid FROM public.users WHERE orgcode = $1 AND issuperadmin = true LIMIT 1",
        [adminOrgcode]
      );
      if (superAdminCheck.rows.length > 0) {
        return NextResponse.json(
          { success: false, message: "Restore is disabled for the Super Admin management organization" },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const password = searchParams.get("password");

    if (!password) {
      return NextResponse.json({ success: false, message: "Admin password is required" }, { status: 400 });
    }

    // Verify admin credentials
    const adminCheck = await query(
      "SELECT password FROM public.users WHERE orgcode = $1 AND userid = $2",
      [adminOrgcode, adminUserid]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].password !== password) {
      return NextResponse.json({ success: false, message: "Invalid admin password" }, { status: 401 });
    }

    // Check if restoring from Google Drive fileId
    const fileId = searchParams.get("fileId");

    let buffer: Buffer;
    let filename = "";

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

      // Fetch filename from Google Drive metadata
      try {
        const metadataRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name`,
          {
            headers: { "Authorization": `Bearer ${accessToken}` },
          }
        );
        if (metadataRes.ok) {
          const metadata = await metadataRes.json();
          filename = metadata.name || "Google Drive Backup File";
        }
      } catch (err) {
        console.error("Failed to fetch GDrive filename metadata:", err);
      }

      if (!filename) {
        filename = "Google Drive Backup File";
      }

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

      filename = file.name || "uploaded_backup.zip";
      buffer = Buffer.from(await file.arrayBuffer());
    }
    // If not a standard zip signature, decrypt using the company's backup_password from settings
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    if (!isZip) {
      const companyConfig = await query(
        "SELECT backup_password FROM public.company WHERE orgcode = $1",
        [adminOrgcode]
      );
      const configuredBackupPassword = companyConfig.rows[0]?.backup_password;
      if (!configuredBackupPassword || !configuredBackupPassword.trim()) {
        return NextResponse.json(
          { success: false, message: "This backup file is password-protected. Please set the matching Backup Password in your settings first." },
          { status: 400 }
        );
      }

      try {
        buffer = decryptBuffer(buffer, configuredBackupPassword.trim());
      } catch (err) {
        return NextResponse.json(
          { success: false, message: "Failed to decrypt the backup file. Please verify that your settings Backup Password is correct." },
          { status: 400 }
        );
      }

      // Check if decrypted buffer is now a zip
      const isDecryptedZip = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
      if (!isDecryptedZip) {
        return NextResponse.json(
          { success: false, message: "Decryption succeeded but the file format is invalid." },
          { status: 400 }
        );
      }
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

    // Standard client backup requires all 5 core files
    if (!isSuperAdmin && (!companyEntry || !usersEntry || !paymentsEntry || !slipsEntry || !slipitemsEntry)) {
      return NextResponse.json(
        { success: false, message: "Backup file is missing required table data JSON files." },
        { status: 400 }
      );
    }

    // Super admin restore requires at least company and users
    if (isSuperAdmin && (!companyEntry || !usersEntry)) {
      return NextResponse.json(
        { success: false, message: "Super admin backup file is missing required company and users configuration." },
        { status: 400 }
      );
    }

    const companyData = companyEntry ? JSON.parse(companyEntry.getData().toString("utf8")) : [];
    const usersData = usersEntry ? JSON.parse(usersEntry.getData().toString("utf8")) : [];
    const paymentsData = paymentsEntry ? JSON.parse(paymentsEntry.getData().toString("utf8")) : [];
    const slipsData = slipsEntry ? JSON.parse(slipsEntry.getData().toString("utf8")) : [];
    const slipitemsData = slipitemsEntry ? JSON.parse(slipitemsEntry.getData().toString("utf8")) : [];

    const auditLogsEntry = zip.getEntry("audit_logs.json");
    let auditLogsData = [];
    if (auditLogsEntry) {
      try {
        auditLogsData = JSON.parse(auditLogsEntry.getData().toString("utf8"));
      } catch (e) {
        console.error("Failed to parse audit_logs.json, skipping");
      }
    }

    // Validation: Ensure all records in backup belong to the logged-in admin's orgcode unless super admin
    if (!isSuperAdmin) {
      for (const row of companyData) {
        if (row.orgcode !== adminOrgcode) {
          return NextResponse.json({ success: false, message: "Tenant mismatch in company data." }, { status: 403 });
        }
      }
      for (const row of usersData) {
        if (row.orgcode !== adminOrgcode) {
          return NextResponse.json({ success: false, message: "Tenant mismatch in users data." }, { status: 403 });
        }
        row.issuperadmin = false;
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
    }

    const phone = searchParams.get("phone")?.trim();

    if (phone) {
      if (isSuperAdmin) {
        return NextResponse.json({ success: false, message: "Partial phone number restore is not supported for system backups." }, { status: 400 });
      }

      // Find data in backup for that phone number
      const targetSlips = slipsData.filter((s: any) => s.phone === phone);
      const targetSlipIds = new Set(targetSlips.map((s: any) => s.id));
      const targetPayments = paymentsData.filter((p: any) => p.phone === phone);
      const targetSlipItems = slipitemsData.filter((si: any) => targetSlipIds.has(si.id));

      if (targetSlips.length === 0 && targetPayments.length === 0) {
        return NextResponse.json(
          { success: false, message: `No data found in the backup file for phone number: ${phone}` },
          { status: 400 }
        );
      }

      // Connect DB client for Transaction
      client = await pool.connect();
      await client.query("BEGIN");

      // 1. Delete existing data for this phone number
      await client.query(
        "DELETE FROM public.slipitems WHERE id IN (SELECT id FROM public.slips WHERE orgcode = $1 AND phone = $2)",
        [adminOrgcode, phone]
      );
      await client.query("DELETE FROM public.slips WHERE orgcode = $1 AND phone = $2", [adminOrgcode, phone]);
      await client.query("DELETE FROM public.payments WHERE orgcode = $1 AND phone = $2", [adminOrgcode, phone]);

      // 2. Restore Payments dynamically
      await dynamicInsert(client, "payments", targetPayments);

      // 3. Restore Slips dynamically
      await dynamicInsert(client, "slips", targetSlips);

      // 4. Restore Slip Items dynamically
      await dynamicInsert(client, "slipitems", targetSlipItems);

      // 5. Reset serial sequences
      await client.query(
        `SELECT setval(pg_get_serial_sequence('public.payments', 'id'), COALESCE(MAX(id), 1)) FROM public.payments`
      );
      await client.query(
        `SELECT setval(pg_get_serial_sequence('public.slips', 'id'), COALESCE(MAX(id), 1)) FROM public.slips`
      );
      await client.query(
        `SELECT setval(pg_get_serial_sequence('public.slipitems', 'id'), COALESCE(MAX(id), 1)) FROM public.slipitems`
      );

      // Log the partial restore operation
      await logAction({
        client,
        orgcode: adminOrgcode,
        userid: adminUserid,
        action: fileId ? "RESTORE_PARTIAL_GDRIVE" : "RESTORE_PARTIAL_LOCAL",
        details: { success: true, fileId: fileId || undefined, filename, phone },
      });

      await client.query("COMMIT");
      return NextResponse.json({ success: true, message: `Data for phone number ${phone} restored successfully` });
    }

    if (isSuperAdmin) {
      // System wide Super Admin Restore
      const pricingPlansEntry = zip.getEntry("pricing_plans.json");
      const couponsEntry = zip.getEntry("coupons.json");
      const couponUsesEntry = zip.getEntry("coupon_uses.json");
      const paymentHistoryEntry = zip.getEntry("payment_history.json");
      const companySubscriptionsEntry = zip.getEntry("company_subscriptions.json");

      if (!pricingPlansEntry || !couponsEntry || !couponUsesEntry || !paymentHistoryEntry || !companySubscriptionsEntry) {
        return NextResponse.json({ success: false, message: "Super admin backup file is missing required system configuration JSON files." }, { status: 400 });
      }

      const pricingPlansData = JSON.parse(pricingPlansEntry.getData().toString("utf8"));
      const couponsData = JSON.parse(couponsEntry.getData().toString("utf8"));
      const couponUsesData = JSON.parse(couponUsesEntry.getData().toString("utf8"));
      const paymentHistoryData = JSON.parse(paymentHistoryEntry.getData().toString("utf8"));
      const companySubscriptionsData = JSON.parse(companySubscriptionsEntry.getData().toString("utf8"));

      client = await pool.connect();
      await client.query("BEGIN");

      // 1. Truncate all tables Cascade (excluding company to preserve foreign keys and prevent cascade deletion)
      await client.query("TRUNCATE public.slipitems CASCADE");
      await client.query("TRUNCATE public.slips CASCADE");
      await client.query("TRUNCATE public.payments CASCADE");
      await client.query("TRUNCATE public.users CASCADE");
      await client.query("TRUNCATE public.audit_logs CASCADE");
      await client.query("TRUNCATE public.pricing_plans CASCADE");
      await client.query("TRUNCATE public.coupons CASCADE");
      await client.query("TRUNCATE public.coupon_uses CASCADE");
      await client.query("TRUNCATE public.payment_history CASCADE");
      await client.query("TRUNCATE public.company_subscriptions CASCADE");

      // 2. Restore all data
      // UPSERT company rows to avoid violating referential integrity constraints
      for (const row of companyData) {
        const check = await client.query("SELECT orgcode FROM public.company WHERE orgcode = $1", [row.orgcode]);
        if (check.rows.length > 0) {
          const columns = Object.keys(row).filter(col => col !== "orgcode");
          if (columns.length > 0) {
            const setClause = columns.map((col, idx) => `${sanitizeIdentifier(col)} = $${idx + 1}`).join(", ");
            const values = columns.map(col => {
              const val = row[col];
              return val !== null && typeof val === "object" ? JSON.stringify(val) : val;
            });
            values.push(row.orgcode);
            await client.query(
              `UPDATE public.company SET ${setClause} WHERE orgcode = $${columns.length + 1}`,
              values
            );
          }
        } else {
          await dynamicInsert(client, "company", [row]);
        }
      }

      await dynamicInsert(client, "users", usersData);
      await dynamicInsert(client, "payments", paymentsData);
      await dynamicInsert(client, "slips", slipsData);
      await dynamicInsert(client, "slipitems", slipitemsData);
      await dynamicInsert(client, "audit_logs", auditLogsData);
      await dynamicInsert(client, "pricing_plans", pricingPlansData);
      await dynamicInsert(client, "coupons", couponsData);
      await dynamicInsert(client, "coupon_uses", couponUsesData);
      await dynamicInsert(client, "payment_history", paymentHistoryData);
      await dynamicInsert(client, "company_subscriptions", companySubscriptionsData);

      // 3. Reset Sequences
      await client.query("SELECT setval(pg_get_serial_sequence('public.payments', 'id'), COALESCE(MAX(id), 1)) FROM public.payments");
      await client.query("SELECT setval(pg_get_serial_sequence('public.slips', 'id'), COALESCE(MAX(id), 1)) FROM public.slips");
      await client.query("SELECT setval(pg_get_serial_sequence('public.slipitems', 'id'), COALESCE(MAX(id), 1)) FROM public.slipitems");
      await client.query("SELECT setval(pg_get_serial_sequence('public.audit_logs', 'id'), COALESCE(MAX(id), 1)) FROM public.audit_logs");
      await client.query("SELECT setval(pg_get_serial_sequence('public.coupon_uses', 'id'), COALESCE(MAX(id), 1)) FROM public.coupon_uses");
      await client.query("SELECT setval(pg_get_serial_sequence('public.payment_history', 'id'), COALESCE(MAX(id), 1)) FROM public.payment_history");
      
      const compSubSeq = await client.query("SELECT pg_get_serial_sequence('public.company_subscriptions', 'id')");
      if (compSubSeq.rows.length > 0 && compSubSeq.rows[0].pg_get_serial_sequence) {
        await client.query("SELECT setval(pg_get_serial_sequence('public.company_subscriptions', 'id'), COALESCE(MAX(id), 1)) FROM public.company_subscriptions");
      }

      await logAction({
        client,
        orgcode: adminOrgcode,
        userid: adminUserid,
        action: fileId ? "RESTORE_BACKUP_GDRIVE" : "RESTORE_BACKUP_LOCAL",
        details: { success: true, fileId: fileId || undefined, filename },
      });

      await client.query("COMMIT");
      return NextResponse.json({ success: true, message: "System restore completed successfully." });
    }

    // Connect DB client for Transaction (Full Restore for single Client Org)
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
      const updateColumns = Object.keys(c).filter(k => k !== "orgcode");
      const setClause = updateColumns.map((col, idx) => `${sanitizeIdentifier(col)} = $${idx + 1}`).join(", ");
      const values = updateColumns.map(col => {
        const val = c[col];
        return val !== null && typeof val === "object" ? JSON.stringify(val) : val;
      });
      values.push(adminOrgcode);
      await client.query(
        `UPDATE public.company SET ${setClause} WHERE orgcode = $${updateColumns.length + 1}`,
        values
      );
    }

    // 3. Restore Users
    const otherUsers = [];
    for (const u of usersData) {
      if (u.userid === adminUserid) {
        // Update current admin credentials/details dynamically
        const updateColumns = Object.keys(u).filter(k => k !== "orgcode" && k !== "userid");
        const setClause = updateColumns.map((col, idx) => `${sanitizeIdentifier(col)} = $${idx + 1}`).join(", ");
        const values = updateColumns.map(col => {
          const val = u[col];
          return val !== null && typeof val === "object" ? JSON.stringify(val) : val;
        });
        values.push(adminOrgcode, adminUserid);
        await client.query(
          `UPDATE public.users SET ${setClause} WHERE orgcode = $${updateColumns.length + 1} AND userid = $${updateColumns.length + 2}`,
          values
        );
      } else {
        otherUsers.push(u);
      }
    }
    await dynamicInsert(client, "users", otherUsers);

    // 4. Restore Payments
    await dynamicInsert(client, "payments", paymentsData);

    // 5. Restore Slips
    await dynamicInsert(client, "slips", slipsData);

    // 6. Restore Slip Items
    await dynamicInsert(client, "slipitems", slipitemsData);

    // 6.5. Restore Audit Logs
    await dynamicInsert(client, "audit_logs", auditLogsData);

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

    // Log the restore operation inside the transaction using the active client
    await logAction({
      client,
      orgcode: adminOrgcode,
      userid: adminUserid,
      action: fileId ? "RESTORE_BACKUP_GDRIVE" : "RESTORE_BACKUP_LOCAL",
      details: { success: true, fileId: fileId || undefined, filename },
    });

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
