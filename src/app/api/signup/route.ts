import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";
import crypto from "crypto";

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
    const { orgcode, orgname, email, phone, adminPassword, referralCode } = body;

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

    // Validate referral code if provided
    let referredByOrgcode = null;
    if (referralCode && referralCode.trim()) {
      const refCheck = await query("SELECT orgcode FROM public.company WHERE referral_code = $1", [referralCode.trim().toUpperCase()]);
      if (refCheck.rows.length === 0) {
        return NextResponse.json({ success: false, message: "Invalid referral code" }, { status: 400 });
      }
      referredByOrgcode = refCheck.rows[0].orgcode;
    }

    // Generate new unique referral code
    let newRefCode = "";
    let isUnique = false;
    while (!isUnique) {
      newRefCode = "REF-" + crypto.randomBytes(3).toString("hex").toUpperCase();
      const uniqueCheck = await query("SELECT orgcode FROM public.company WHERE referral_code = $1", [newRefCode]);
      if (uniqueCheck.rows.length === 0) {
        isUnique = true;
      }
    }

    // Insert company
    await query(
      `INSERT INTO public.company (orgcode, orgname, isactive, email, phone, referral_code, referred_by)
       VALUES ($1, $2, true, $3, $4, $5, $6)`,
      [cleanOrgcode, orgname.trim(), email ? email.trim() : null, phone ? phone.trim() : null, newRefCode, referredByOrgcode]
    );

    // Insert trial subscription (exactly 10 days)
    await query(
      `INSERT INTO public.company_subscriptions (orgcode, subscription_type, subscription_start, subscription_end, has_inventory)
       VALUES ($1, 'trial', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '10 days', true)`,
      [cleanOrgcode]
    );

    // Insert admin user
    const passwordToSet = adminPassword.trim();
    await query(
      `INSERT INTO public.users (orgcode, userid, password, isadmin, isactive, authtoken)
       VALUES ($1, 'admin', $2, true, true, gen_random_uuid())`,
      [cleanOrgcode, passwordToSet]
    );

    // Seed default transaction types for the new company
    const defaultTxnTypes = [
      { code: 1, name: "Vendor Receipt", stock_effect: "INWARD", from_type: "vendor", to_type: "location" },
      { code: 2, name: "Customer Issue", stock_effect: "OUTWARD", from_type: "location", to_type: "customer" },
      { code: 3, name: "Warehouse Transfer", stock_effect: "TRANSFER", from_type: "location", to_type: "location" },
      { code: 4, name: "Customer Return", stock_effect: "INWARD", from_type: "customer", to_type: "location" },
      { code: 5, name: "Vendor Return", stock_effect: "OUTWARD", from_type: "location", to_type: "vendor" },
      { code: 6, name: "Stock Adjustment (Shortage/Damage/Theft)", stock_effect: "OUTWARD", from_type: "location", to_type: "none" },
      { code: 7, name: "Stock Adjustment (Surplus/Found)", stock_effect: "INWARD", from_type: "none", to_type: "location" }
    ];

    for (const d of defaultTxnTypes) {
      await query(
        `INSERT INTO public.inventory_transaction_types (orgcode, code, name, stock_effect, from_type, to_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (orgcode, code) DO NOTHING`,
        [cleanOrgcode, d.code, d.name, d.stock_effect, d.from_type, d.to_type]
      );
    }

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
