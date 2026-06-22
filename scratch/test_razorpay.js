const { Client } = require('pg');
const crypto = require('crypto');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    const userRes = await client.query("SELECT authtoken FROM public.users WHERE orgcode = 'ABC123' AND userid = 'admin'");
    const authtoken = userRes.rows[0]?.authtoken;
    
    if (!authtoken) {
      throw new Error("Admin authtoken not found in database.");
    }
    console.log(`Fetched admin authtoken: ${authtoken}`);

    const companyBefore = await client.query("SELECT subscription_type, subscription_end FROM public.company_subscriptions WHERE orgcode = 'ABC123'");
    console.log("Before Payment:", companyBefore.rows[0]);

    console.log("Calling /api/create-order...");
    const createOrderRes = await fetch("http://localhost:3000/api/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `authtoken=${authtoken}`
      },
      body: JSON.stringify({ planKey: "3_months" })
    });
    
    const orderData = await createOrderRes.json();
    console.log("Create Order Response:", orderData);

    if (!orderData.success) {
      throw new Error(`Failed to create order: ${orderData.message}`);
    }

    const orderId = orderData.order_id;
    const paymentId = `pay_${Math.random().toString(36).substring(2, 11)}`;
    const keySecret = 'MoIl6N0aD7eSbJyjgcTSqpDu';

    const hmac = crypto.createHmac("sha256", keySecret);
    hmac.update(`${orderId}|${paymentId}`);
    const signature = hmac.digest("hex");

    console.log(`Simulating payment success: Order ID = ${orderId}, Payment ID = ${paymentId}`);

    console.log("Calling /api/verify-payment...");
    const verifyRes = await fetch("http://localhost:3000/api/verify-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `authtoken=${authtoken}`
      },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        planKey: "3_months"
      })
    });

    const verifyData = await verifyRes.json();
    console.log("Verify Payment Response:", verifyData);

    if (!verifyData.success) {
      throw new Error(`Verification failed: ${verifyData.message}`);
    }

    const companyAfter = await client.query("SELECT subscription_type, subscription_end FROM public.company_subscriptions WHERE orgcode = 'ABC123'");
    console.log("After Payment (Verification Success):", companyAfter.rows[0]);

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    await client.end();
  }
}

run();
