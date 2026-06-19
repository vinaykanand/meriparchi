import { query } from "@/lib/db";
import { generateBackupZip } from "./backup";

export async function uploadBackupToGDrive(orgcode: string): Promise<{ success: boolean; fileId?: string; message?: string }> {
  try {
    // 1. Retrieve GDrive configuration
    const configRes = await query(
      "SELECT gdrive_client_id, gdrive_client_secret, gdrive_refresh_token FROM public.company WHERE orgcode = $1",
      [orgcode]
    );

    if (configRes.rows.length === 0) {
      return { success: false, message: "Company profile not found" };
    }

    const { gdrive_client_id, gdrive_client_secret, gdrive_refresh_token } = configRes.rows[0];

    if (!gdrive_client_id || !gdrive_client_secret || !gdrive_refresh_token) {
      return { success: false, message: "Google Drive is not linked or configured." };
    }

    // 2. Exchange refresh token for access token
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
      return { success: false, message: tokenData.error_description || "Token refresh failed." };
    }

    const accessToken = tokenData.access_token;

    // 3. Generate the backup zip file
    const zipBuffer = await generateBackupZip(orgcode);
    const filename = `backup_${orgcode}_${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;

    // 4. Create metadata on Google Drive
    const metadataRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: filename,
        mimeType: "application/zip",
      }),
    });

    const metadataData = await metadataRes.json();
    if (!metadataRes.ok) {
      return { success: false, message: metadataData.error?.message || "Failed to create metadata on GDrive." };
    }

    const fileId = metadataData.id;

    // 5. Upload file contents
    const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/zip",
      },
      body: new Uint8Array(zipBuffer),
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      return { success: false, message: uploadData.error?.message || "Failed to upload file content to GDrive." };
    }

    // 6. Update last backup time
    await query(
      "UPDATE public.company SET last_backup_time = NOW() WHERE orgcode = $1",
      [orgcode]
    );

    return { success: true, fileId, message: "Backup successfully uploaded to Google Drive" };
  } catch (error: any) {
    console.error("GDrive upload error:", error);
    return { success: false, message: error.message || "An unexpected error occurred during GDrive upload" };
  }
}
