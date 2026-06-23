const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    console.log("Starting coupon_uses database migration...");
    
    // Create coupon_uses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.coupon_uses (
        id SERIAL PRIMARY KEY,
        orgcode VARCHAR(50) NOT NULL REFERENCES public.company(orgcode) ON DELETE CASCADE,
        code VARCHAR(50) NOT NULL REFERENCES public.coupons(code) ON DELETE CASCADE,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Created table public.coupon_uses");

    console.log("coupon_uses database migration finished successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
