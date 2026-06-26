import { query } from "@/lib/db";
import { uploadBackupToGDrive } from "./gdrive";
import { logAction } from "./audit";

// Map schedule intervals to milliseconds
const INTERVALS: Record<string, number> = {
  twice_daily: 12 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

export async function checkAndTriggerBackup(orgcode: string) {
  try {
    const configRes = await query(
      "SELECT backup_schedule, last_backup_time, gdrive_refresh_token FROM public.company WHERE orgcode = $1",
      [orgcode]
    );

    if (configRes.rows.length === 0) {
      return { triggered: false, message: "Company not found" };
    }

    const { backup_schedule, last_backup_time, gdrive_refresh_token } = configRes.rows[0];

    let schedule = backup_schedule;
    if (orgcode === "SUPER" && (!schedule || schedule === "none")) {
      schedule = "daily"; // Default super admin to daily backup schedule
    }

    // If no schedule set, or Google Drive not linked, skip
    if (!schedule || schedule === "none" || !gdrive_refresh_token) {
      return { triggered: false, message: "No active schedule or Google Drive not linked" };
    }

    const intervalMs = INTERVALS[schedule.toLowerCase()];
    if (!intervalMs) {
      return { triggered: false, message: `Invalid interval schedule: ${backup_schedule}` };
    }

    const lastBackupMs = last_backup_time ? new Date(last_backup_time).getTime() : 0;
    const now = Date.now();

    if (now - lastBackupMs >= intervalMs) {
      // 1. Temporarily update last_backup_time to NOW() to lock and prevent concurrent triggers
      await query(
        "UPDATE public.company SET last_backup_time = NOW() WHERE orgcode = $1",
        [orgcode]
      );

      try {
        console.log(`[Scheduler] Starting automatic backup to Google Drive for organization: ${orgcode}`);
        const result = await uploadBackupToGDrive(orgcode);
        if (result.success) {
          console.log(`[Scheduler] Automatic backup completed: File ID ${result.fileId}`);
          await logAction({
            orgcode,
            userid: "system",
            action: "AUTO_BACKUP_GDRIVE",
            details: { success: true, fileId: result.fileId, filename: result.filename },
          });
          return { triggered: true, success: true, fileId: result.fileId, filename: result.filename };
        } else {
          console.error(`[Scheduler] Automatic backup failed: ${result.message}`);
          await logAction({
            orgcode,
            userid: "system",
            action: "AUTO_BACKUP_GDRIVE",
            details: { success: false, error: result.message },
          });
          // Reset last backup time to allow retry on next action
          await query(
            "UPDATE public.company SET last_backup_time = $1 WHERE orgcode = $2",
            [last_backup_time, orgcode]
          );
          return { triggered: true, success: false, error: result.message };
        }
      } catch (err: any) {
        console.error("[Scheduler] Background backup error:", err);
        // Reset last backup time
        await query(
          "UPDATE public.company SET last_backup_time = $1 WHERE orgcode = $2",
          [last_backup_time, orgcode]
        );
        return { triggered: true, success: false, error: err.message || String(err) };
      }
    }

    return { triggered: false, message: "Backup is not due yet" };
  } catch (error: any) {
    console.error("[Scheduler] Error checking backup schedule:", error);
    return { triggered: false, error: error.message || String(error) };
  }
}
