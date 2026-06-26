import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { checkAndTriggerBackup } from "@/lib/scheduler";
import { uploadBackupToGDrive } from "@/lib/gdrive";
import { logAction } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";

    // Find all companies that have Google Drive linked
    const companiesResult = await query(
      "SELECT orgcode, backup_schedule, last_backup_time FROM public.company WHERE gdrive_refresh_token IS NOT NULL AND gdrive_refresh_token != ''"
    );
    const companies = companiesResult.rows;
    const results: any[] = [];

    for (const company of companies) {
      const orgcode = company.orgcode;
      if (force) {
        // Trigger backup to Google Drive directly, bypassing schedule interval check
        try {
          console.log(`[Cron Webhook] Forcing backup to Google Drive for organization: ${orgcode}`);
          const previousBackupTime = company.last_backup_time;

          // Update last_backup_time to NOW() to lock it
          await query(
            "UPDATE public.company SET last_backup_time = NOW() WHERE orgcode = $1",
            [orgcode]
          );

          const result = await uploadBackupToGDrive(orgcode);
          if (result.success) {
            await logAction({
              orgcode,
              userid: "system",
              action: "AUTO_BACKUP_GDRIVE",
              details: { success: true, fileId: result.fileId, filename: result.filename, forced: true },
            });
            results.push({ orgcode, triggered: true, success: true, fileId: result.fileId, filename: result.filename });
          } else {
            // Restore original last backup time on failure
            await query(
              "UPDATE public.company SET last_backup_time = $1 WHERE orgcode = $2",
              [previousBackupTime, orgcode]
            );
            await logAction({
              orgcode,
              userid: "system",
              action: "AUTO_BACKUP_GDRIVE",
              details: { success: false, error: result.message, forced: true },
            });
            results.push({ orgcode, triggered: true, success: false, error: result.message });
          }
        } catch (err: any) {
          // Restore original last backup time on error
          await query(
            "UPDATE public.company SET last_backup_time = $1 WHERE orgcode = $2",
            [company.last_backup_time, orgcode]
          );
          results.push({ orgcode, triggered: true, success: false, error: err.message || String(err) });
        }
      } else {
        // Run standard scheduler check based on each company's individual backup schedule setting
        const res = await checkAndTriggerBackup(orgcode);
        results.push({ orgcode, ...res });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed backup check for ${companies.length} companies`,
      results,
    });
  } catch (error: any) {
    console.error("[Cron Webhook] Webhook handler error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
