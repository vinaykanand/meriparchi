import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import AdmZip from "adm-zip";
import { decryptBuffer } from "@/lib/backup";

export async function POST(request: Request) {
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
    const isSuperAdmin = sessionCheck.rows[0].issuperadmin === true;

    // Block inspect operations for the Super Admin management organization unless requester is super admin
    if (!isSuperAdmin) {
      const superAdminCheck = await query(
        "SELECT userid FROM public.users WHERE orgcode = $1 AND issuperadmin = true LIMIT 1",
        [adminOrgcode]
      );
      if (superAdminCheck.rows.length > 0) {
        return NextResponse.json(
          { success: false, message: "Inspect is disabled for the Super Admin management organization" },
          { status: 403 }
        );
      }
    }

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

    const slipsEntry = zip.getEntry("slips.json");
    const paymentsEntry = zip.getEntry("payments.json");

    if (!slipsEntry && !paymentsEntry) {
      return NextResponse.json(
        { success: false, message: "Backup file is missing slips and payments JSON data." },
        { status: 400 }
      );
    }

    const slipsData = slipsEntry ? JSON.parse(slipsEntry.getData().toString("utf8")) : [];
    const paymentsData = paymentsEntry ? JSON.parse(paymentsEntry.getData().toString("utf8")) : [];

    // Map unique phones to names and addresses
    const phoneMap = new Map<string, { name: string; address: string }>();

    // slips might have phone, name, and address
    for (const s of slipsData) {
      if (s.phone && s.orgcode === adminOrgcode) {
        const existing = phoneMap.get(s.phone);
        phoneMap.set(s.phone, {
          name: s.name || existing?.name || "Unknown Customer",
          address: s.address || existing?.address || "",
        });
      }
    }

    // payments might have phone
    for (const p of paymentsData) {
      if (p.phone && p.orgcode === adminOrgcode) {
        if (!phoneMap.has(p.phone)) {
          phoneMap.set(p.phone, {
            name: "Unknown Customer",
            address: "",
          });
        }
      }
    }

    const customers = Array.from(phoneMap.entries()).map(([phone, info]) => ({
      phone,
      name: info.name,
      address: info.address,
    }));

    return NextResponse.json({ success: true, customers });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to inspect backup file" },
      { status: 500 }
    );
  }
}
