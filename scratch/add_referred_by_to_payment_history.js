const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("Adding referred_by to payment_history table...");
    await client.query(`
      ALTER TABLE public.payment_history 
      ADD COLUMN IF NOT EXISTS referred_by VARCHAR(50);
    `);
    console.log("✓ Added column referred_by to payment_history");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
