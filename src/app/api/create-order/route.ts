import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import Razorpay from "razorpay";
import fs from "fs";
import path from "path";

function getEnv(key: string): string | undefined {
  const envVal = process.env[key];
  if (envVal) return envVal.trim();

  try {
    let dir = process.cwd();
    for (let i = 0; i < 4; i++) {
      const envPath = path.join(dir, ".env");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const match = new RegExp(`^${key}=(.*)$`, "m").exec(content);
        if (match) {
          return match[1].trim();
        }
      }
      const parentDir = path.dirname(dir);
      if (parentDir === dir) break;
      dir = parentDir;
    }
  } catch (e) {
    console.error("Error reading fallback .env:", e);
  }
  return undefined;
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
    const { planKey, couponCode, redeemPoints, currency = "INR" } = body;

    if (!planKey) {
      return NextResponse.json({ success: false, message: "planKey parameter is required" }, { status: 400 });
    }

    // Retrieve pricing details from DB
    const planRes = await query("SELECT price, plan_name FROM public.pricing_plans WHERE plan_key = $1", [planKey]);
    if (planRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Pricing plan not found" }, { status: 400 });
    }

    const planName = planRes.rows[0].plan_name;
    const priceRs = parseFloat(planRes.rows[0].price);
    let finalPriceRs = priceRs;
    let appliedDiscountRs = 0;

    // Validate and Apply Coupon if provided
    if (couponCode) {
      const couponCheck = await query(
        "SELECT code, discount, type, value, status, start_date, expiry_date FROM public.coupons WHERE code = $1",
        [couponCode.trim().toUpperCase()]
      );

      if (couponCheck.rows.length === 0) {
        return NextResponse.json({ success: false, message: "Invalid coupon code" }, { status: 400 });
      }

      const coupon = couponCheck.rows[0];
      if (coupon.status !== "active") {
        return NextResponse.json({ success: false, message: "This coupon is inactive" }, { status: 400 });
      }

      const now = new Date();
      const startDate = new Date(coupon.start_date);
      const expiryDate = new Date(coupon.expiry_date);

      if (now < startDate || now > expiryDate) {
        return NextResponse.json({ success: false, message: "This coupon has expired or is not yet active" }, { status: 400 });
      }

      const couponVal = parseFloat(coupon.value);
      if (coupon.type === "percentage") {
        appliedDiscountRs = (priceRs * couponVal) / 100;
      } else {
        appliedDiscountRs = couponVal;
      }

      if (priceRs - appliedDiscountRs < 1.00) {
        appliedDiscountRs = Math.max(0, priceRs - 1.00);
      }
      finalPriceRs = priceRs - appliedDiscountRs;
    }

    // Apply Referral Points if requested
    let pointsDiscount = 0;
    if (redeemPoints) {
      const pointsQuery = await query(
        `SELECT GREATEST(0,
           (SELECT COALESCE(SUM(points_earned), 0) FROM public.payment_history WHERE referred_by = $1) - 
           (SELECT COALESCE(SUM(points_redeemed), 0) FROM public.payment_history WHERE orgcode = $1)
         ) AS available_points`,
        [orgcode]
      );
      const availablePoints = parseFloat(pointsQuery.rows[0]?.available_points || "0");
      if (availablePoints > 0) {
        const maxRedeemable = Math.max(0, finalPriceRs - 1.00);
        pointsDiscount = Math.min(availablePoints, maxRedeemable);
        finalPriceRs = finalPriceRs - pointsDiscount;
      }
    }

    const amountPaise = Math.round(finalPriceRs * 100);

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
      originalPrice: priceRs,
      finalPrice: finalPriceRs,
      appliedDiscount: appliedDiscountRs,
      pointsDiscount: pointsDiscount,
      planName
    });
  } catch (error: any) {
    console.error("Razorpay Create Order Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create Razorpay order" },
      { status: 500 }
    );
  }
}
