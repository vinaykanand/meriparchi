import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";

// Helper to verify that the request is made by a super admin
async function verifySuperAdmin(): Promise<{ ok: boolean; status: number; message: string; adminOrgcode?: string; adminUserid?: string }> {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (!authtoken) {
      return { ok: false, status: 401, message: "Unauthorized: Missing authtoken" };
    }

    const result = await query(
      "SELECT userid, issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = 'SUPER' AND isactive = true",
      [authtoken]
    );

    if (result.rows.length === 0 || !result.rows[0].issuperadmin) {
      return { ok: false, status: 403, message: "Forbidden: Super Admin access required" };
    }

    return { ok: true, status: 200, message: "Authorized", adminOrgcode: "SUPER", adminUserid: result.rows[0].userid };
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
      `SELECT c.orgcode, c.orgname, s.subscription_type, s.subscription_start, s.subscription_end, c.isactive, c.email, c.phone,
              CASE 
                WHEN s.subscription_end IS NULL THEN 0
                ELSE EXTRACT(EPOCH FROM (s.subscription_end - NOW())) / 86400.0
              END as remaining_days
       FROM public.company c
       LEFT JOIN public.company_subscriptions s ON c.orgcode = s.orgcode
       ORDER BY c.orgcode ASC`
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
    const { orgcode, orgname, adminPassword, subscriptionType, email, phone } = body;

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

    const plan = subscriptionType && subscriptionType !== "trial" ? subscriptionType : "trial";
    let durationDays = 10;
    if (plan !== "trial") {
      const planResult = await query("SELECT duration_months FROM public.pricing_plans WHERE plan_key = $1", [plan]);
      if (planResult.rows.length > 0) {
        durationDays = planResult.rows[0].duration_months * 30;
      } else {
        durationDays = 30;
      }
    }

    // Insert company
    await query(
      `INSERT INTO public.company (orgcode, orgname, isactive, email, phone)
       VALUES ($1, $2, true, $3, $4)`,
      [cleanOrgcode, orgname.trim(), email ? email.trim() : null, phone ? phone.trim() : null]
    );

    // Insert company subscription record using database CURRENT_TIMESTAMP and interval addition
    await query(
      `INSERT INTO public.company_subscriptions (orgcode, subscription_type, subscription_start, subscription_end)
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + ($3 || ' days')::INTERVAL)`,
      [cleanOrgcode, plan, durationDays]
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

    // Audit Log for Company Creation (log in target company's logs)
    await logAction({
      orgcode: cleanOrgcode,
      userid: auth.adminUserid || "superadmin",
      action: "SUPER_ADMIN_CREATE_COMPANY",
      details: {
        orgcode: cleanOrgcode,
        orgname: orgname.trim(),
        subscriptionType: plan,
        email: email ? email.trim() : null
      }
    });

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
    const { orgcode, orgname, subscriptionType, subscriptionEnd, isactive, email, phone, adminPassword } = body;

    if (!orgcode) {
      return NextResponse.json({ success: false, message: "Organization Code is required" }, { status: 400 });
    }

    const cleanOrgcode = orgcode.trim().toUpperCase();
    if (cleanOrgcode === "SUPER" && isactive === false) {
      return NextResponse.json({ success: false, message: "Unauthorized: Cannot deactivate SUPER organization." }, { status: 400 });
    }

    const checkCompany = await query(
      `SELECT c.orgcode, s.subscription_start 
       FROM public.company c
       LEFT JOIN public.company_subscriptions s ON c.orgcode = s.orgcode
       WHERE c.orgcode = $1`, 
      [cleanOrgcode]
    );
    if (checkCompany.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
    }

    let endTimestamp;
    if (subscriptionType === "trial") {
      const start = checkCompany.rows[0].subscription_start 
        ? new Date(checkCompany.rows[0].subscription_start) 
        : new Date();
      endTimestamp = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000);
    } else {
      endTimestamp = subscriptionEnd ? new Date(subscriptionEnd) : new Date();
    }

    await query(
      `UPDATE public.company
       SET orgname = $2, isactive = $3, email = $4, phone = $5
       WHERE orgcode = $1`,
      [orgcode, orgname.trim(), isactive !== false, email ? email.trim() : null, phone ? phone.trim() : null]
    );

    if (adminPassword && adminPassword.trim()) {
      await query(
        "UPDATE public.users SET password = $1 WHERE orgcode = $2 AND userid = 'admin'",
        [adminPassword.trim(), orgcode]
      );
    }

    await query(
      `INSERT INTO public.company_subscriptions (orgcode, subscription_type, subscription_end)
       VALUES ($1, $2, $3)
       ON CONFLICT (orgcode) DO UPDATE 
       SET subscription_type = EXCLUDED.subscription_type, subscription_end = EXCLUDED.subscription_end`,
      [orgcode, subscriptionType, endTimestamp]
    );

    // Audit Log for Company Update (log in target company's logs)
    await logAction({
      orgcode: orgcode,
      userid: auth.adminUserid || "superadmin",
      action: "SUPER_ADMIN_UPDATE_COMPANY",
      details: {
        orgcode,
        orgname: orgname.trim(),
        subscriptionType,
        subscriptionEnd: endTimestamp,
        isactive: isactive !== false,
        email: email ? email.trim() : null,
        phone: phone ? phone.trim() : null,
        passwordReset: !!(adminPassword && adminPassword.trim())
      }
    });

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

// DELETE: Delete a company and all its data permanently
export async function DELETE(request: Request) {
  const auth = await verifySuperAdmin();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    let targetOrgcode = searchParams.get("orgcode");

    const body = await request.json().catch(() => ({}));
    const { superAdminPassword } = body;

    if (!targetOrgcode) {
      targetOrgcode = body.orgcode;
    }

    if (!targetOrgcode) {
      return NextResponse.json({ success: false, message: "Organization Code is required" }, { status: 400 });
    }

    const cleanOrgcode = targetOrgcode.trim().toUpperCase();
    if (cleanOrgcode === "SUPER") {
      return NextResponse.json({ success: false, message: "Unauthorized: Cannot delete SUPER admin organization." }, { status: 400 });
    }

    if (!superAdminPassword || !superAdminPassword.trim()) {
      return NextResponse.json({ success: false, message: "Super Admin password confirmation is required" }, { status: 400 });
    }

    // Verify Super Admin Password
    const superUserRes = await query(
      "SELECT password FROM public.users WHERE orgcode = 'SUPER' AND userid = $1 AND issuperadmin = true AND isactive = true",
      [auth.adminUserid]
    );

    if (superUserRes.rows.length === 0 || superUserRes.rows[0].password !== superAdminPassword.trim()) {
      return NextResponse.json({ success: false, message: "Invalid Super Admin password confirmation." }, { status: 401 });
    }

    // Perform transaction deletion
    await query("BEGIN");

    try {
      await query("DELETE FROM public.slipitems WHERE id IN (SELECT id FROM public.slips WHERE orgcode = $1)", [cleanOrgcode]);
      await query("DELETE FROM public.slips WHERE orgcode = $1", [cleanOrgcode]);
      await query("DELETE FROM public.payments WHERE orgcode = $1", [cleanOrgcode]);
      await query("DELETE FROM public.users WHERE orgcode = $1", [cleanOrgcode]);
      await query("DELETE FROM public.company_subscriptions WHERE orgcode = $1", [cleanOrgcode]);
      await query("DELETE FROM public.coupon_uses WHERE orgcode = $1", [cleanOrgcode]);
      await query("DELETE FROM public.payment_history WHERE orgcode = $1", [cleanOrgcode]);
      await query("DELETE FROM public.audit_logs WHERE orgcode = $1", [cleanOrgcode]);
      await query("DELETE FROM public.company WHERE orgcode = $1", [cleanOrgcode]);

      await query("COMMIT");
    } catch (txErr) {
      await query("ROLLBACK");
      throw txErr;
    }

    // Log audit log under SUPER organization
    await logAction({
      orgcode: "SUPER",
      userid: auth.adminUserid || "superadmin",
      action: "SUPER_ADMIN_DELETE_COMPANY",
      details: {
        targetOrgcode: cleanOrgcode
      }
    });

    return NextResponse.json({
      success: true,
      message: `Organization '${cleanOrgcode}' and all associated data have been permanently deleted.`
    });
  } catch (error: any) {
    console.error("Super Admin DELETE Company Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
