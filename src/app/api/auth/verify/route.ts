import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (!authtoken) {
      return NextResponse.json(
        { success: false, message: "Missing token" },
        { status: 401 }
      );
    }

    const cookieOrgcode = cookieStore.get("orgcode")?.value;

    const response = await fetch(`https://ekzrjsjulqkoqvqgtsgi.supabase.co/functions/v1/verify?authtoken=${authtoken}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      // Query check without enforcing orgcode = data.orgcode in case they are impersonating
      const superAdminCheck = await query(
        "SELECT issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = 'SUPER'",
        [authtoken]
      );
      if (superAdminCheck.rows.length > 0 && superAdminCheck.rows[0].issuperadmin) {
        data.issuperadmin = true;
        
        // If they are a superadmin, and cookieOrgcode is different from SUPER, they are impersonating
        if (cookieOrgcode && cookieOrgcode.trim().toUpperCase() !== "SUPER") {
          data.isImpersonation = true;
          data.orgcode = cookieOrgcode.trim().toUpperCase();
          data.isadmin = true;
          // Use selected impersonation user from cookie, fallback to "admin"
          const impersonateUseridCookie = cookieStore.get("impersonate_userid")?.value;
          data.userid = impersonateUseridCookie?.trim() || "admin";
        }
      }

      // Block non-superadmin session verification under the SUPER orgcode
      if (data.orgcode && data.orgcode.trim().toUpperCase() === "SUPER" && !data.issuperadmin) {
        return NextResponse.json(
          { success: false, message: "Unauthorized access: only superadmin can login under this organization code." },
          { status: 403 }
        );
      }
    }
    
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
