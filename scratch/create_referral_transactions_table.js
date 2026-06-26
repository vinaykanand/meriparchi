const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("Creating referral_transactions table...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.referral_transactions (
        id            SERIAL PRIMARY KEY,
        referrer_orgcode  VARCHAR(50) NOT NULL,
        referred_orgcode  VARCHAR(50) NOT NULL,
        payment_amount    NUMERIC NOT NULL,
        reward_points     NUMERIC NOT NULL,
        created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Created table public.referral_transactions");

    // Index for fast lookups by referrer
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_txn_referrer
        ON public.referral_transactions (referrer_orgcode, created_at DESC)
    `);
    console.log("✓ Created index idx_referral_txn_referrer");

    // Index for fast lookups by referred company
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_txn_referred
        ON public.referral_transactions (referred_orgcode)
    `);
    console.log("✓ Created index idx_referral_txn_referred");

    console.log("\nMigration complete!");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
