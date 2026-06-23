import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";

// GET: Check if public signup is enabled
export async function GET() {
  try {
    const configRes = await query("SELECT allow_public_signup FROM public.company WHERE orgcode = 'SUPER'");
    const isSignupAllowed = configRes.rows.length > 0 && configRes.rows[0].allow_public_signup !== false;

    return NextResponse.json({
      success: true,
      allowed: isSignupAllowed
    });
  } catch (error: any) {
    console.error("Signup status GET API Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server Error" }, { status: 500 });
  }
}

// POST: Sign up a new organization
export async function POST(request: Request) {
  try {
    // 1. Check if public signup is allowed
    const configRes = await query("SELECT allow_public_signup FROM public.company WHERE orgcode = 'SUPER'");
    const isSignupAllowed = configRes.rows.length > 0 && configRes.rows[0].allow_public_signup !== false;

    if (!isSignupAllowed) {
      return NextResponse.json(
        { success: false, message: "Public signup is currently disabled by administrator." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { orgcode, orgname, email, phone, adminPassword } = body;

    if (!orgcode || !orgname || !adminPassword) {
      return NextResponse.json({ success: false, message: "Organization Code, Name, and Admin Password are required" }, { status: 400 });
    }

    const cleanOrgcode = orgcode.trim().toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(cleanOrgcode)) {
      return NextResponse.json({ success: false, message: "Invalid Org Code: Only uppercase letters, numbers, and hyphens/underscores allowed." }, { status: 400 });
    }

    if (cleanOrgcode === "SUPER") {
      return NextResponse.json({ success: false, message: "Unauthorized Org Code choice." }, { status: 400 });
    }

    // Check if company already exists
    const checkCompany = await query("SELECT orgcode FROM public.company WHERE orgcode = $1", [cleanOrgcode]);
    if (checkCompany.rows.length > 0) {
      return NextResponse.json({ success: false, message: "Company with this Organization Code already exists" }, { status: 400 });
    }

    // Set up a 10-day trial plan
    const trialDays = 10;
    const endTimestamp = new Date();
    endTimestamp.setDate(endTimestamp.getDate() + trialDays);

    // Insert company
    await query(
      `INSERT INTO public.company (orgcode, orgname, isactive, email, phone)
       VALUES ($1, $2, true, $3, $4)`,
      [cleanOrgcode, orgname.trim(), email ? email.trim() : null, phone ? phone.trim() : null]
    );

    // Insert trial subscription
    await query(
      `INSERT INTO public.company_subscriptions (orgcode, subscription_type, subscription_start, subscription_end)
       VALUES ($1, 'trial', CURRENT_TIMESTAMP, $2)`,
      [cleanOrgcode, endTimestamp]
    );

    // Insert admin user
    const passwordToSet = adminPassword.trim();
    await query(
      `INSERT INTO public.users (orgcode, userid, password, isadmin, isactive, authtoken)
       VALUES ($1, 'admin', $2, true, true, gen_random_uuid())`,
      [cleanOrgcode, passwordToSet]
    );

    const userAgent = request.headers.get("user-agent") || "unknown";
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    // Write audit log under the newly registered company
    await logAction({
      orgcode: cleanOrgcode,
      userid: "admin",
      action: "PUBLIC_SIGNUP",
      details: {
        orgcode: cleanOrgcode,
        orgname: orgname.trim(),
        email: email ? email.trim() : null,
        phone: phone ? phone.trim() : null,
        ip,
        userAgent
      }
    });

    return NextResponse.json({
      success: true,
      message: `Organization '${orgname}' registered successfully with Org Code: ${cleanOrgcode}.`
    });
  } catch (error: any) {
    console.error("Public Signup API Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
