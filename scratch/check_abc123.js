const { Client } = require('pg');
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const comp = await client.query("SELECT * FROM public.company WHERE orgcode = 'ABC123'");
    const sub = await client.query("SELECT * FROM public.company_subscriptions WHERE orgcode = 'ABC123'");
    console.log("Company:", comp.rows);
    console.log("Subscription:", sub.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
