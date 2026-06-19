import { query } from "@/lib/db";
import { uploadBackupToGDrive } from "./gdrive";
import { logAction } from "./audit";

// Map schedule intervals to milliseconds
const INTERVALS: Record<string, number> = {
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

    if (configRes.rows.length === 0) return;

    const { backup_schedule, last_backup_time, gdrive_refresh_token } = configRes.rows[0];

    // If no schedule set, or Google Drive not linked, skip
    if (!backup_schedule || backup_schedule === "none" || !gdrive_refresh_token) {
      return;
    }

    const intervalMs = INTERVALS[backup_schedule.toLowerCase()];
    if (!intervalMs) return;

    const lastBackupMs = last_backup_time ? new Date(last_backup_time).getTime() : 0;
    const now = Date.now();

    if (now - lastBackupMs >= intervalMs) {
      // 1. Temporarily update last_backup_time to NOW() to lock and prevent concurrent triggers
      await query(
        "UPDATE public.company SET last_backup_time = NOW() WHERE orgcode = $1",
        [orgcode]
      );

      // 2. Perform the backup asynchronously in the background
      (async () => {
        try {
          console.log(`[Scheduler] Starting automatic backup to Google Drive for organization: ${orgcode}`);
          const result = await uploadBackupToGDrive(orgcode);
          if (result.success) {
            console.log(`[Scheduler] Automatic backup completed: File ID ${result.fileId}`);
            await logAction({
              orgcode,
              userid: "system",
              action: "AUTO_BACKUP_GDRIVE",
              details: { success: true, fileId: result.fileId },
            });
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
          }
        } catch (err: any) {
          console.error("[Scheduler] Background backup error:", err);
        }
      })();
    }
  } catch (error) {
    console.error("[Scheduler] Error checking backup schedule:", error);
  }
}
