import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import Razorpay from "razorpay";
import { logAction } from "@/lib/audit";

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

    const { orgcode, userid } = sessionCheck.rows[0];

    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planKey, couponCode } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planKey) {
      return NextResponse.json({ success: false, message: "Missing required verification fields" }, { status: 400 });
    }

    const keyId = getEnv("RAZORPAY_KEY_ID");
    const keySecret = getEnv("RAZORPAY_KEY_SECRET");
    if (!keySecret || !keyId) {
      return NextResponse.json({ success: false, message: "Razorpay configuration missing on server" }, { status: 500 });
    }

    const hmac = crypto.createHmac("sha256", keySecret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json({ success: false, message: "Payment verification failed: Signature mismatch" }, { status: 400 });
    }

    // Retrieve pricing plan duration and original price
    const planRes = await query("SELECT price, duration_months, plan_name FROM public.pricing_plans WHERE plan_key = $1", [planKey]);
    if (planRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Plan not found" }, { status: 400 });
    }

    const planName = planRes.rows[0].plan_name;
    const priceRs = parseFloat(planRes.rows[0].price);
    const durationMonths = parseInt(planRes.rows[0].duration_months, 10);
    let finalPriceRs = priceRs;
    let appliedDiscountRs = 0;

    // Validate Coupon
    let validCouponApplied = false;
    if (couponCode) {
      const couponCheck = await query(
        "SELECT code, discount, type, value, status, start_date, expiry_date FROM public.coupons WHERE code = $1",
        [couponCode.trim().toUpperCase()]
      );

      if (couponCheck.rows.length > 0) {
        const coupon = couponCheck.rows[0];
        const now = new Date();
        const startDate = new Date(coupon.start_date);
        const expiryDate = new Date(coupon.expiry_date);

        if (coupon.status === "active" && now >= startDate && now <= expiryDate) {
          validCouponApplied = true;
          const couponVal = parseFloat(coupon.value);
          if (coupon.type === "percentage") {
            appliedDiscountRs = (priceRs * couponVal) / 100;
          } else {
            appliedDiscountRs = couponVal;
          }
          finalPriceRs = Math.max(1.00, priceRs - appliedDiscountRs);
        }
      }
    }

    // Update Company subscription in independent table
    const subscriptionRes = await query(
      "SELECT subscription_end, subscription_type FROM public.company_subscriptions WHERE orgcode = $1",
      [orgcode]
    );

    const now = new Date();
    let currentEnd = now;
    let oldSubscriptionType = "trial";

    if (subscriptionRes.rows.length > 0) {
      const sub = subscriptionRes.rows[0];
      oldSubscriptionType = sub.subscription_type;
      if (sub.subscription_end) {
        currentEnd = new Date(sub.subscription_end);
      }
    }

    let newEnd: Date;
    if (oldSubscriptionType === "trial" || currentEnd < now) {
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

    // Increment coupon usage and log coupon apply if valid
    if (validCouponApplied) {
      await query(
        "INSERT INTO public.coupon_uses (orgcode, code) VALUES ($1, $2)",
        [orgcode, couponCode.trim().toUpperCase()]
      );
      await query(
        "UPDATE public.coupons SET total_usage = total_usage + 1 WHERE code = $1",
        [couponCode.trim().toUpperCase()]
      );
      
      // Audit Log for Coupon Application
      await logAction({
        orgcode,
        userid,
        action: "COUPON_APPLIED",
        details: {
          couponCode: couponCode.trim().toUpperCase(),
          discount: appliedDiscountRs,
          originalPrice: priceRs,
          finalPrice: finalPriceRs
        }
      });
    }

    // Retrieve Company Info for Razorpay Invoice creation
    const companyRes = await query("SELECT email, orgname FROM public.company WHERE orgcode = $1", [orgcode]);
    const companyEmail = companyRes.rows.length > 0 ? companyRes.rows[0].email : null;
    const companyName = companyRes.rows.length > 0 ? companyRes.rows[0].orgname : orgcode;

    // Create Razorpay Invoice
    let invoiceUrl = null;
    try {
      const razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      const invoice = await razorpay.invoices.create({
        type: "invoice",
        date: Math.floor(Date.now() / 1000),
        customer: {
          name: companyName,
          email: companyEmail || "billing@example.com",
        },
        line_items: [
          {
            name: `${planName} Subscription Renewal`,
            amount: Math.round(finalPriceRs * 100), // in paise
            currency: "INR",
            quantity: 1
          }
        ]
      } as any);
      invoiceUrl = invoice.short_url;
    } catch (invErr) {
      console.error("Razorpay Invoice Creation Failed:", invErr);
    }

    // Record checkout to public.payment_history
    await query(
      `INSERT INTO public.payment_history (orgcode, order_id, payment_id, plan_key, amount, coupon_code, invoice_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orgcode, razorpay_order_id, razorpay_payment_id, planKey, finalPriceRs, validCouponApplied ? couponCode.trim().toUpperCase() : null, invoiceUrl]
    );

    // Audit Log for Payment success
    await logAction({
      orgcode,
      userid,
      action: "LOG_PAYMENT",
      details: {
        amount: finalPriceRs,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        planKey,
        couponCode: validCouponApplied ? couponCode.trim().toUpperCase() : null,
        invoiceUrl
      }
    });

    // Audit Log for Subscription Payment success
    await logAction({
      orgcode,
      userid,
      action: "SUBSCRIPTION_PAYMENT",
      details: {
        amount: finalPriceRs,
        planKey,
        couponCode: validCouponApplied ? couponCode.trim().toUpperCase() : null,
        durationMonths,
        newEnd
      }
    });

    // Audit Log for Subscription Extension
    await logAction({
      orgcode,
      userid,
      action: "UPDATE_COMPANY_SETTINGS",
      details: {
        subscription_type: "premium_upgraded",
        durationMonths,
        oldEnd: currentEnd,
        newEnd
      }
    });

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully. Subscription upgraded/extended.",
      subscription_end: newEnd,
      invoice_url: invoiceUrl
    });
  } catch (error: any) {
    console.error("Razorpay Verify Payment Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to verify payment" },
      { status: 500 }
    );
  }
}
