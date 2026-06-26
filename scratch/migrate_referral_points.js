const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("Adding points_redeemed to payment_history table...");
    await client.query(`
      ALTER TABLE public.payment_history 
      ADD COLUMN IF NOT EXISTS points_redeemed NUMERIC DEFAULT 0;
    `);
    console.log("✓ Added column points_redeemed to payment_history");

    console.log("Dropping referral_points from company table...");
    await client.query(`
      ALTER TABLE public.company 
      DROP COLUMN IF EXISTS referral_points;
    `);
    console.log("✓ Dropped column referral_points from company");

    console.log("\nMigration complete!");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
