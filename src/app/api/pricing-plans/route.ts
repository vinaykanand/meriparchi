import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";

// Helper to verify that the request is made by a super admin and get session details
async function getSuperAdminSession(): Promise<{ ok: boolean; orgcode?: string; userid?: string }> {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    const orgcode = cookieStore.get("orgcode")?.value;

    if (!authtoken || !orgcode) return { ok: false };

    const result = await query(
      "SELECT userid, issuperadmin FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
      [authtoken, orgcode]
    );
    if (result.rows.length > 0 && result.rows[0].issuperadmin) {
      return { ok: true, orgcode, userid: result.rows[0].userid };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

// GET: Get all pricing plans
export async function GET(request: Request) {
  try {
    const result = await query(
      "SELECT plan_key, plan_name, price, duration_months FROM public.pricing_plans ORDER BY duration_months ASC"
    );
    return NextResponse.json({ success: true, plans: result.rows });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch pricing plans" },
      { status: 500 }
    );
  }
}

// PUT: Update pricing plan prices
export async function PUT(request: Request) {
  const sessionInfo = await getSuperAdminSession();
  if (!sessionInfo.ok || !sessionInfo.orgcode || !sessionInfo.userid) {
    return NextResponse.json({ success: false, message: "Forbidden: Super Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { plans } = body; // Array of { plan_key, price }

    if (!plans || !Array.isArray(plans)) {
      return NextResponse.json({ success: false, message: "Invalid payload: plans array required" }, { status: 400 });
    }

    for (const p of plans) {
      const parsedPrice = parseFloat(p.price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return NextResponse.json({ success: false, message: `Invalid price for plan: ${p.plan_key}` }, { status: 400 });
      }

      await query(
        "UPDATE public.pricing_plans SET price = $1 WHERE plan_key = $2",
        [parsedPrice, p.plan_key]
      );
    }

    // Log pricing model change action
    await logAction({
      orgcode: sessionInfo.orgcode,
      userid: sessionInfo.userid,
      action: "SUPER_ADMIN_CHANGE_PRICING",
      details: {
        updatedPlans: plans
      }
    });

    return NextResponse.json({ success: true, message: "Pricing plans updated successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update pricing plans" },
      { status: 500 }
    );
  }
}
