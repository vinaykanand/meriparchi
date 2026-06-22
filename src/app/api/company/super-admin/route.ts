import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

// Helper to verify that the request is made by a super admin
async function verifySuperAdmin(): Promise<{ ok: boolean; status: number; message: string; adminOrgcode?: string }> {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    const orgcode = cookieStore.get("orgcode")?.value;

    if (!authtoken || !orgcode) {
      return { ok: false, status: 401, message: "Unauthorized: Missing authtoken or orgcode" };
    }

    const result = await query(
      "SELECT issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
      [authtoken, orgcode]
    );

    if (result.rows.length === 0 || !result.rows[0].issuperadmin) {
      return { ok: false, status: 403, message: "Forbidden: Super Admin access required" };
    }

    return { ok: true, status: 200, message: "Authorized", adminOrgcode: orgcode };
  } catch (error: any) {
    return { ok: false, status: 500, message: error.message || "Internal server error" };
  }
}

// GET: List all companies with subscription data
export async function GET(request: Request) {
  const auth = await verifySuperAdmin();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  try {
    // Select companies, calculating remaining days
    const result = await query(
      `SELECT orgcode, orgname, subscription_type, subscription_start, subscription_end, isactive, email,
              CASE 
                WHEN subscription_end IS NULL THEN 0
                ELSE EXTRACT(EPOCH FROM (subscription_end - NOW())) / 86400.0
              END as remaining_days
       FROM public.company
       ORDER BY orgcode ASC`
    );

    return NextResponse.json({
      success: true,
      companies: result.rows,
    });
  } catch (error: any) {
    console.error("Super Admin GET Companies Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}

// POST: Create a new company
export async function POST(request: Request) {
  const auth = await verifySuperAdmin();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { orgcode, orgname, adminPassword, subscriptionType, email } = body;

    if (!orgcode || !orgname) {
      return NextResponse.json({ success: false, message: "Organization Code and Name are required" }, { status: 400 });
    }

    const cleanOrgcode = orgcode.trim().toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(cleanOrgcode)) {
      return NextResponse.json({ success: false, message: "Invalid Org Code: Only uppercase letters, numbers, and hyphens/underscores allowed." }, { status: 400 });
    }

    // Check if company already exists
    const checkCompany = await query("SELECT orgcode FROM public.company WHERE orgcode = $1", [cleanOrgcode]);
    if (checkCompany.rows.length > 0) {
      return NextResponse.json({ success: false, message: "Company with this Organization Code already exists" }, { status: 400 });
    }

    const plan = subscriptionType === "monthly" ? "monthly" : "trial";
    const durationDays = plan === "monthly" ? 30 : 30; // Default subscription period is 30 days
    const endTimestamp = new Date();
    endTimestamp.setDate(endTimestamp.getDate() + durationDays);

    // Insert company
    await query(
      `INSERT INTO public.company (orgcode, orgname, subscription_type, subscription_start, subscription_end, email)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)`,
      [cleanOrgcode, orgname.trim(), plan, endTimestamp, email ? email.trim() : null]
    );

    // Check if user admin was auto-created by Supabase trigger, or if we need to insert it
    // Wait, create_default_company_user insert 'admin' with 'admin@123'
    // Let's update or insert admin user with chosen custom password
    const passwordToSet = adminPassword && adminPassword.trim() ? adminPassword.trim() : "admin@123";
    
    // We wait 100ms or check if trigger ran
    let adminCheck = await query("SELECT userid FROM public.users WHERE orgcode = $1 AND userid = 'admin'", [cleanOrgcode]);
    if (adminCheck.rows.length > 0) {
      await query(
        "UPDATE public.users SET password = $1 WHERE orgcode = $2 AND userid = 'admin'",
        [passwordToSet, cleanOrgcode]
      );
    } else {
      await query(
        `INSERT INTO public.users (orgcode, userid, password, isadmin, isactive, authtoken)
         VALUES ($1, 'admin', $2, true, true, gen_random_uuid())`,
        [cleanOrgcode, passwordToSet]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Company '${orgname}' registered successfully with Org Code: ${cleanOrgcode}.`,
    });
  } catch (error: any) {
    console.error("Super Admin POST Company Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}

// PUT: Update company settings (Plan, duration, active status, email)
export async function PUT(request: Request) {
  const auth = await verifySuperAdmin();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { orgcode, orgname, subscriptionType, subscriptionEnd, isactive, email } = body;

    if (!orgcode) {
      return NextResponse.json({ success: false, message: "Organization Code is required" }, { status: 400 });
    }

    const checkCompany = await query("SELECT orgcode FROM public.company WHERE orgcode = $1", [orgcode]);
    if (checkCompany.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
    }

    const endTimestamp = subscriptionEnd ? new Date(subscriptionEnd) : new Date();

    await query(
      `UPDATE public.company
       SET orgname = $2, subscription_type = $3, subscription_end = $4, isactive = $5, email = $6
       WHERE orgcode = $1`,
      [orgcode, orgname.trim(), subscriptionType, endTimestamp, isactive !== false, email ? email.trim() : null]
    );

    return NextResponse.json({
      success: true,
      message: `Company '${orgcode}' updated successfully.`,
    });
  } catch (error: any) {
    console.error("Super Admin PUT Company Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
