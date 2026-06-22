import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import Razorpay from "razorpay";
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
    const { planKey, currency = "INR" } = body;

    if (!planKey) {
      return NextResponse.json({ success: false, message: "planKey parameter is required" }, { status: 400 });
    }

    // Retrieve pricing details from DB
    const planRes = await query("SELECT price FROM public.pricing_plans WHERE plan_key = $1", [planKey]);
    if (planRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Pricing plan not found" }, { status: 400 });
    }

    const priceRs = parseFloat(planRes.rows[0].price);
    const amountPaise = Math.round(priceRs * 100);

    if (amountPaise < 100) {
      return NextResponse.json({ success: false, message: "Invalid amount. Minimum amount is 100 paise (₹1)." }, { status: 400 });
    }

    const keyId = getEnv("RAZORPAY_KEY_ID");
    const keySecret = getEnv("RAZORPAY_KEY_SECRET");

    if (!keyId || !keySecret) {
      return NextResponse.json({ success: false, message: "Razorpay keys not configured on server" }, { status: 500 });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const receiptId = `rcpt_${orgcode}_${Date.now()}`;
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency,
      receipt: receiptId,
    });

    return NextResponse.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error: any) {
    console.error("Razorpay Create Order Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create Razorpay order" },
      { status: 500 }
    );
  }
}
