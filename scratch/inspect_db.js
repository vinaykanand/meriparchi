const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const companies = await client.query("SELECT orgcode, orgname, referral_code, referred_by, referral_points FROM public.company LIMIT 10");
    console.log("=== COMPANIES ===");
    console.table(companies.rows);

    const users = await client.query("SELECT orgcode, userid, password, isadmin, issuperadmin FROM public.users LIMIT 10");
    console.log("=== USERS ===");
    console.table(users.rows);
  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    await client.end();
  }
}

run();
