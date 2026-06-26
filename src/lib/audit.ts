import pool, { query } from "@/lib/db";
import { cookies } from "next/headers";

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
    // If we are logged in as superadmin impersonating a client, bypass audit logging in the client company
    if (orgcode !== "SUPER") {
      try {
        const cookieStore = await cookies();
        const authtoken = cookieStore.get("authtoken")?.value;
        if (authtoken) {
          const superCheck = await executor.query(
            "SELECT userid FROM public.users WHERE authtoken = $1 AND orgcode = 'SUPER' AND issuperadmin = true AND isactive = true LIMIT 1",
            [authtoken]
          );
          if (superCheck.rows.length > 0) {
            console.log(`[Audit] Impersonation bypass: Skipping client audit log for action "${action}" on company "${orgcode}"`);
            return;
          }
        }
      } catch (cookieErr) {
        // Not in request/cookie context, ignore
      }
    }
    // Prevent duplicate logs for backup and restore actions within 2 minutes (120 seconds)
    // Using both interval check and timezone-safe epoch differences
    if (action.includes("BACKUP") || action.includes("RESTORE")) {
      const dupCheck = await executor.query(
        `SELECT id FROM public.audit_logs 
         WHERE orgcode = $1 AND userid = $2 AND action = $3 
           AND (
             timestamp > NOW() - INTERVAL '2 minutes'
             OR ABS(EXTRACT(EPOCH FROM (NOW() - timestamp))) < 120
           )
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

    // 2. Automatically delete logs older than retention period (default 10 days)
    await executor.query(
      `DELETE FROM public.audit_logs 
       WHERE orgcode = $1 
         AND timestamp < NOW() - (SELECT COALESCE(audit_retention_days, 10) FROM public.company WHERE orgcode = $1) * INTERVAL '1 day'`,
      [orgcode]
    );
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
