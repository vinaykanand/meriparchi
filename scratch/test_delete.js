const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  const tempOrgcode = 'DELTEST';

  try {
    console.log("Creating test company...");
    await client.query("INSERT INTO public.company (orgcode, orgname) VALUES ($1, 'Del Test')", [tempOrgcode]);
    await client.query("INSERT INTO public.users (orgcode, userid, password, isadmin) VALUES ($1, 'admin', 'pass', true)", [tempOrgcode]);
    await client.query("INSERT INTO public.company_subscriptions (orgcode, subscription_end) VALUES ($1, NOW())", [tempOrgcode]);

    console.log("Attempting deletion transaction...");
    await client.query("BEGIN");
    
    await client.query("DELETE FROM public.slipitems WHERE id IN (SELECT id FROM public.slips WHERE orgcode = $1)", [tempOrgcode]);
    await client.query("DELETE FROM public.slips WHERE orgcode = $1", [tempOrgcode]);
    await client.query("DELETE FROM public.payments WHERE orgcode = $1", [tempOrgcode]);
    await client.query("DELETE FROM public.users WHERE orgcode = $1", [tempOrgcode]);
    await client.query("DELETE FROM public.company_subscriptions WHERE orgcode = $1", [tempOrgcode]);
    await client.query("DELETE FROM public.coupon_uses WHERE orgcode = $1", [tempOrgcode]);
    await client.query("DELETE FROM public.payment_history WHERE orgcode = $1", [tempOrgcode]);
    await client.query("DELETE FROM public.audit_logs WHERE orgcode = $1", [tempOrgcode]);
    await client.query("DELETE FROM public.company WHERE orgcode = $1", [tempOrgcode]);

    await client.query("COMMIT");
    console.log("Deletion successful!");

  } catch (err) {
    console.error("Deletion failed with error:", err);
    await client.query("ROLLBACK");
  } finally {
    // Attempt cleanup outside transaction just in case
    try {
      await client.query("DELETE FROM public.company_subscriptions WHERE orgcode = $1", [tempOrgcode]);
      await client.query("DELETE FROM public.users WHERE orgcode = $1", [tempOrgcode]);
      await client.query("DELETE FROM public.company WHERE orgcode = $1", [tempOrgcode]);
    } catch (e) {}
    await client.end();
  }
}

run();
