import { Pool, QueryResult, QueryResultRow } from "pg";
import { cookies } from "next/headers";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const isMutation = /^\s*(insert|update|delete|truncate|drop|alter)\b/i.test(text);
  
  if (isMutation) {
    try {
      const cookieStore = await cookies();
      const authtoken = cookieStore.get("authtoken")?.value;
      const orgcode = cookieStore.get("orgcode")?.value;
      
      if (authtoken && orgcode && orgcode.trim().toUpperCase() !== "SUPER") {
        // Query check using pool.query directly to bypass custom query wrapper recursion
        const superCheck = await pool.query(
          "SELECT userid FROM public.users WHERE authtoken = $1 AND orgcode = 'SUPER' AND issuperadmin = true AND isactive = true LIMIT 1",
          [authtoken]
        );
        if (superCheck.rows.length > 0) {
          throw new Error("Impersonation Mode: Super Admin is not allowed to create or modify transactions.");
        }
      }
    } catch (e: any) {
      if (e.message?.includes("Impersonation Mode")) {
        throw e;
      }
    }
  }

  // Intercept user session queries for impersonating Super Admins
  const isUserSessionQuery = /from\s+public\.users\b/i.test(text) && params && params.length > 0 && typeof params[0] === "string";
  if (isUserSessionQuery && !isMutation) {
    try {
      const token = params[0];
      if (token && token.length > 10) {
        // Query check using pool.query directly to bypass custom query wrapper recursion
        const superCheck = await pool.query(
          "SELECT userid FROM public.users WHERE authtoken = $1 AND orgcode = 'SUPER' AND issuperadmin = true AND isactive = true LIMIT 1",
          [token]
        );
        if (superCheck.rows.length > 0) {
          const targetOrg = (params[1] && typeof params[1] === "string") ? params[1].trim().toUpperCase() : "";
          if (targetOrg && targetOrg !== "SUPER") {
            // Get the impersonated userid from cookie, fallback to the super-admin's own userid
            let impersonateUserid = superCheck.rows[0].userid || "admin";
            try {
              const cookieStore = await cookies();
              const cookieUserId = cookieStore.get("impersonate_userid")?.value;
              if (cookieUserId && cookieUserId.trim()) {
                impersonateUserid = cookieUserId.trim();
              }
            } catch (_) {
              // cookies() unavailable in some contexts — use fallback
            }
            return {
              rows: [
                {
                  userid: impersonateUserid,
                  isadmin: true,
                  issuperadmin: true,
                  orgcode: targetOrg
                }
              ],
              rowCount: 1,
              command: "SELECT",
              oid: 0,
              fields: []
            } as any;
          }
        }
      }
    } catch (err) {
      // Ignore errors and proceed
    }
  }

  return pool.query<T>(text, params);
}

export default pool;
