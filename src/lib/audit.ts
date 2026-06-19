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
