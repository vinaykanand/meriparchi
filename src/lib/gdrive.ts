import { query } from "@/lib/db";
import { generateBackupZip } from "./backup";

export async function uploadBackupToGDrive(orgcode: string, isSuperAdmin: boolean = false): Promise<{ success: boolean; fileId?: string; filename?: string; message?: string }> {
  try {
    // 1. Retrieve GDrive configuration
    const gdrive_client_id = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const gdrive_client_secret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

    if (!gdrive_client_id || !gdrive_client_secret) {
      return { success: false, message: "Google Drive Client ID/Secret is not configured on the server." };
    }

    const configRes = await query(
      "SELECT gdrive_refresh_token, COALESCE(backup_retention_count, 5) as backup_retention_count FROM public.company WHERE orgcode = $1",
      [orgcode]
    );

    if (configRes.rows.length === 0) {
      return { success: false, message: "Company profile not found" };
    }

    const { gdrive_refresh_token, backup_retention_count } = configRes.rows[0];

    if (!gdrive_refresh_token) {
      return { success: false, message: "Google Drive is not linked." };
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

    const actualIsSuperAdmin = isSuperAdmin || orgcode === "SUPER";

    // 2.5 Find or create the target folder
    let parentFolderId = "";
    const folderName = actualIsSuperAdmin ? "parchiadmin" : "MeriParchi";
    try {
      const searchRes = await fetch(
        "https://www.googleapis.com/drive/v3/files?" +
          new URLSearchParams({
            q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: "files(id)",
          }),
        {
          headers: { "Authorization": `Bearer ${accessToken}` },
        }
      );
      const searchData = await searchRes.json();
      if (searchRes.ok && searchData.files && searchData.files.length > 0) {
        parentFolderId = searchData.files[0].id;
      } else {
        // Create the folder
        const createFolderRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
          }),
        });
        const createFolderData = await createFolderRes.json();
        if (createFolderRes.ok && createFolderData.id) {
          parentFolderId = createFolderData.id;
        } else {
          console.error(`Failed to create ${folderName} folder:`, createFolderData);
        }
      }
    } catch (e) {
      console.error(`Error finding/creating ${folderName} folder:`, e);
    }

    // 3. Generate the backup zip file
    const zipBuffer = await generateBackupZip(orgcode, actualIsSuperAdmin);
    const filename = actualIsSuperAdmin 
      ? `super_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.zip`
      : `backup_${orgcode}_${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;

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
        ...(parentFolderId ? { parents: [parentFolderId] } : {}),
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

    // 6. Delete old backups exceeding retention limit
    try {
      const listRes = await fetch(
        "https://www.googleapis.com/drive/v3/files?" +
          new URLSearchParams({
            q: `'${parentFolderId}' in parents and mimeType = 'application/zip' and trashed = false`,
            orderBy: "createdTime desc",
            fields: "files(id, name, createdTime)",
          }),
        {
          headers: { "Authorization": `Bearer ${accessToken}` },
        }
      );
      const listData = await listRes.json();
      if (listRes.ok && listData.files && listData.files.length > backup_retention_count) {
        const toDelete = listData.files.slice(backup_retention_count);
        for (const file of toDelete) {
          console.log(`[GDrive] Auto purging old backup: ${file.name} (${file.id})`);
          await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${accessToken}` },
          });
        }
      }
    } catch (purgeError) {
      console.error("Failed to auto-purge old backups:", purgeError);
    }

    // 7. Update last backup time
    await query(
      "UPDATE public.company SET last_backup_time = NOW() WHERE orgcode = $1",
      [orgcode]
    );

    return { success: true, fileId, filename, message: "Backup successfully uploaded to Google Drive" };
  } catch (error: any) {
    console.error("GDrive upload error:", error);
    return { success: false, message: error.message || "An unexpected error occurred during GDrive upload" };
  }
}
