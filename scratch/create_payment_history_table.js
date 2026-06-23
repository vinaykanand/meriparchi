const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    console.log("Starting payment_history database migration...");
    
    // Create payment_history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.payment_history (
        id SERIAL PRIMARY KEY,
        orgcode VARCHAR(50) NOT NULL REFERENCES public.company(orgcode) ON DELETE CASCADE,
        order_id VARCHAR(100) NOT NULL,
        payment_id VARCHAR(100) NOT NULL,
        plan_key VARCHAR(50) NOT NULL,
        amount NUMERIC NOT NULL,
        coupon_code VARCHAR(50),
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        invoice_url VARCHAR(500)
      )
    `);
    console.log("Created table public.payment_history");

    console.log("payment_history database migration finished successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
