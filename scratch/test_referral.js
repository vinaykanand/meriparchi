const { Client } = require('pg');
const crypto = require('crypto');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("=== STARTING REFERRAL FLOW INTEGRATION TEST ===");

    // 1. Get referral code of ABC123
    const referrerRes = await client.query("SELECT referral_code, referral_points FROM public.company WHERE orgcode = 'ABC123'");
    const refCode = referrerRes.rows[0]?.referral_code;
    const initialPoints = parseFloat(referrerRes.rows[0]?.referral_points || "0");
    console.log(`Referrer (ABC123) Code: ${refCode}, Initial Points: ${initialPoints}`);

    if (!refCode) {
      throw new Error("ABC123 referral code not found.");
    }

    // Generate random orgcode for new test company
    const newOrgcode = 'TST' + crypto.randomBytes(3).toString('hex').toUpperCase();
    console.log(`Creating new referred company with orgcode: ${newOrgcode}`);

    // 2. Call /api/signup with the referral code
    const signupRes = await fetch("http://localhost:3000/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgcode: newOrgcode,
        orgname: "Test Referred Company Inc",
        email: "test_referred@example.com",
        phone: "9999999999",
        adminPassword: "password123",
        referralCode: refCode
      })
    });

    const signupData = await signupRes.json();
    console.log("Signup Response:", signupData);

    if (!signupData.success) {
      throw new Error("Signup failed");
    }

    // Check DB to verify referred_by relation
    const referredCheck = await client.query("SELECT referred_by, referral_code FROM public.company WHERE orgcode = $1", [newOrgcode]);
    console.log("Referred Company DB Record:", referredCheck.rows[0]);
    if (referredCheck.rows[0].referred_by !== 'ABC123') {
      throw new Error("referred_by field is not set correctly to referrer orgcode.");
    }

    // 3. Log in as new referred company admin to get authtoken
    const userRes = await client.query("SELECT authtoken FROM public.users WHERE orgcode = $1 AND userid = 'admin'", [newOrgcode]);
    const authtoken = userRes.rows[0]?.authtoken;
    console.log(`Fetched referred company authtoken: ${authtoken}`);

    // 4. Simulate a payment for the referred company
    console.log("Calling /api/create-order for referred company...");
    const createOrderRes = await fetch("http://localhost:3000/api/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `authtoken=${authtoken}`
      },
      body: JSON.stringify({ planKey: "3_months" }) // Price is ₹2.00
    });
    
    const orderData = await createOrderRes.json();
    console.log("Create Order Response:", orderData);

    if (!orderData.success) {
      throw new Error(`Failed to create order: ${orderData.message}`);
    }

    const orderId = orderData.order_id;
    const paymentId = `pay_${Math.random().toString(36).substring(2, 11)}`;
    const keySecret = 'g0BbcQE7pva8Ac8kq10FJBZf';

    const hmac = crypto.createHmac("sha256", keySecret);
    hmac.update(`${orderId}|${paymentId}`);
    const signature = hmac.digest("hex");

    console.log("Calling /api/verify-payment for referred company...");
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

    // 5. Verify referrer (ABC123) received 10% points reward
    const referrerResAfter = await client.query("SELECT referral_points FROM public.company WHERE orgcode = 'ABC123'");
    const newPoints = parseFloat(referrerResAfter.rows[0]?.referral_points || "0");
    console.log(`Referrer Points After Reward: ${newPoints} (Expected increase: 10% of ₹2.00 = +0.20 points)`);
    if (Math.abs(newPoints - (initialPoints + 0.20)) > 0.01) {
      throw new Error("Points reward not calculated/credited correctly.");
    }

    // 6. Test Points Redemption by Referrer (ABC123)
    const referrerUserRes = await client.query("SELECT authtoken FROM public.users WHERE orgcode = 'ABC123' AND userid = 'admin'");
    const refAuthtoken = referrerUserRes.rows[0]?.authtoken;

    console.log("Calling /api/create-order for Referrer with redeemPoints = true...");
    const refOrderRes = await fetch("http://localhost:3000/api/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `authtoken=${refAuthtoken}`
      },
      body: JSON.stringify({ planKey: "3_months", redeemPoints: true })
    });
    const refOrderData = await refOrderRes.json();
    console.log("Referrer Create Order Response (Points Redeemed):", refOrderData);
    if (!refOrderData.success) {
      throw new Error("Points redemption order creation failed");
    }
    console.log(`Original Price: ₹${refOrderData.originalPrice}, Final Price: ₹${refOrderData.finalPrice}, Points Discount: ₹${refOrderData.pointsDiscount}`);
    
    // Cleanup created test company data
    await client.query("DELETE FROM public.users WHERE orgcode = $1", [newOrgcode]);
    await client.query("DELETE FROM public.company WHERE orgcode = $1", [newOrgcode]);
    console.log(`Cleaned up test company: ${newOrgcode}`);

    console.log("=== REFERRAL FLOW INTEGRATION TEST PASSED SUCCESSFULLY! ===");

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    await client.end();
  }
}

run();
