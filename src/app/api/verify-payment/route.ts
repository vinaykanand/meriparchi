import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import crypto from "crypto";
import fs from "fs";
import path from "path";

function getEnv(key: string): string | undefined {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = new RegExp(`^${key}=(.*)$`, "m").exec(content);
      if (match) {
        return match[1].trim();
      }
    }
  } catch (e) {
    console.error("Error reading fallback .env:", e);
  }
  return process.env[key]?.trim();
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (!authtoken) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const sessionCheck = await query(
      "SELECT orgcode, userid FROM public.users WHERE authtoken = $1 AND isactive = true",
      [authtoken]
    );
    if (sessionCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { orgcode } = sessionCheck.rows[0];

    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planKey } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planKey) {
      return NextResponse.json({ success: false, message: "Missing required verification fields" }, { status: 400 });
    }

    const keySecret = getEnv("RAZORPAY_KEY_SECRET");
    if (!keySecret) {
      return NextResponse.json({ success: false, message: "Razorpay configuration missing on server" }, { status: 500 });
    }

    const hmac = crypto.createHmac("sha256", keySecret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json({ success: false, message: "Payment verification failed: Signature mismatch" }, { status: 400 });
    }

    // Retrieve pricing plan duration
    const planRes = await query("SELECT duration_months FROM public.pricing_plans WHERE plan_key = $1", [planKey]);
    const durationMonths = planRes.rows.length > 0 ? parseInt(planRes.rows[0].duration_months, 10) : 1;

    // Update Company subscription in independent table
    const subscriptionRes = await query(
      "SELECT subscription_end, subscription_type FROM public.company_subscriptions WHERE orgcode = $1",
      [orgcode]
    );

    const now = new Date();
    let currentEnd = now;
    let subscriptionType = "monthly";

    if (subscriptionRes.rows.length > 0) {
      const sub = subscriptionRes.rows[0];
      subscriptionType = sub.subscription_type;
      if (sub.subscription_end) {
        currentEnd = new Date(sub.subscription_end);
      }
    }

    let newEnd: Date;
    if (subscriptionType === "trial" || currentEnd < now) {
      newEnd = new Date(now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);
    } else {
      newEnd = new Date(currentEnd.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);
    }

    await query(
      `INSERT INTO public.company_subscriptions (orgcode, subscription_type, subscription_end)
       VALUES ($1, 'monthly', $2)
       ON CONFLICT (orgcode) DO UPDATE 
       SET subscription_type = 'monthly', subscription_end = EXCLUDED.subscription_end`,
      [orgcode, newEnd]
    );

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully. Subscription upgraded/extended by 30 days.",
      subscription_end: newEnd,
    });
  } catch (error: any) {
    console.error("Razorpay Verify Payment Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to verify payment" },
      { status: 500 }
    );
  }
}
