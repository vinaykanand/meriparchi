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

    const response = await fetch(`https://ekzrjsjulqkoqvqgtsgi.supabase.co/functions/v1/verify?authtoken=${authtoken}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      const superAdminCheck = await query(
        "SELECT issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = $2",
        [authtoken, data.orgcode]
      );
      if (superAdminCheck.rows.length > 0 && superAdminCheck.rows[0].issuperadmin) {
        data.issuperadmin = true;
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
