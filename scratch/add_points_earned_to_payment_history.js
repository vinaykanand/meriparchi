const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("Adding points_earned to payment_history table...");
    await client.query(`
      ALTER TABLE public.payment_history 
      ADD COLUMN IF NOT EXISTS points_earned NUMERIC DEFAULT 0;
    `);
    console.log("✓ Added column points_earned to payment_history");

    // Backfill points_earned for existing records where referred_by is set (10% of amount)
    console.log("Backfilling points_earned for existing referred payments...");
    await client.query(`
      UPDATE public.payment_history 
      SET points_earned = ROUND(amount * 0.10, 2)
      WHERE referred_by IS NOT NULL AND (points_earned = 0 OR points_earned IS NULL);
    `);
    console.log("✓ Backfill complete!");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
