import pool, { query } from "@/lib/db";

interface AuditLogParams {
  client?: any; // pg client for transactions
  orgcode: string;
  userid: string;
  action: string;
  details?: Record<string, any>;
}

export async function logAction({
  client,
  orgcode,
  userid,
  action,
  details = {},
}: AuditLogParams) {
  const executor = client || { query: query };
  
  try {
    // Prevent duplicate logs for backup and restore actions within 5 seconds
    if (action.includes("BACKUP") || action.includes("RESTORE")) {
      const dupCheck = await executor.query(
        `SELECT id FROM public.audit_logs 
         WHERE orgcode = $1 AND userid = $2 AND action = $3 
           AND timestamp > NOW() - INTERVAL '5 seconds'
         LIMIT 1`,
        [orgcode, userid, action]
      );
      if (dupCheck.rows.length > 0) {
        console.log(`[Audit] Skipping duplicate log for action: ${action}`);
        return;
      }
    }

    // 1. Insert audit log
    await executor.query(
      `INSERT INTO public.audit_logs (orgcode, userid, action, details)
       VALUES ($1, $2, $3, $4)`,
      [orgcode, userid, action, JSON.stringify(details)]
    );

    // 2. Automatically delete logs older than retention period
    await executor.query(
      `DELETE FROM public.audit_logs 
       WHERE orgcode = $1 
         AND timestamp < NOW() - (SELECT COALESCE(audit_retention_days, 15) FROM public.company WHERE orgcode = $1) * INTERVAL '1 day'`,
      [orgcode]
    );
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
