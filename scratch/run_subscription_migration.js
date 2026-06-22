const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    console.log("Starting database migration...");
    
    // 1. Create company_subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.company_subscriptions (
        orgcode VARCHAR(50) PRIMARY KEY REFERENCES public.company(orgcode) ON DELETE CASCADE,
        subscription_type VARCHAR(50) NOT NULL DEFAULT 'trial',
        subscription_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        subscription_end TIMESTAMP NOT NULL
      )
    `);
    console.log("Created table public.company_subscriptions");

    // 2. Migrate existing subscription records
    await client.query(`
      INSERT INTO public.company_subscriptions (orgcode, subscription_type, subscription_start, subscription_end)
      SELECT orgcode, COALESCE(subscription_type, 'trial'), COALESCE(subscription_start, CURRENT_TIMESTAMP), COALESCE(subscription_end, CURRENT_TIMESTAMP + INTERVAL '10 days')
      FROM public.company
      ON CONFLICT (orgcode) DO UPDATE 
      SET 
        subscription_type = EXCLUDED.subscription_type,
        subscription_start = EXCLUDED.subscription_start,
        subscription_end = EXCLUDED.subscription_end
    `);
    console.log("Migrated existing subscription data");

    // 3. Drop columns from public.company if they exist
    const columnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'company' AND table_schema = 'public'
    `);
    const existingColumns = columnsCheck.rows.map(r => r.column_name);

    if (existingColumns.includes('subscription_type')) {
      await client.query("ALTER TABLE public.company DROP COLUMN subscription_type");
      console.log("Dropped column subscription_type from company");
    }
    if (existingColumns.includes('subscription_start')) {
      await client.query("ALTER TABLE public.company DROP COLUMN subscription_start");
      console.log("Dropped column subscription_start from company");
    }
    if (existingColumns.includes('subscription_end')) {
      await client.query("ALTER TABLE public.company DROP COLUMN subscription_end");
      console.log("Dropped column subscription_end from company");
    }

    // 4. Create pricing_plans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.pricing_plans (
        plan_key VARCHAR(50) PRIMARY KEY,
        plan_name VARCHAR(100) NOT NULL,
        price NUMERIC NOT NULL,
        duration_months INT NOT NULL
      )
    `);
    console.log("Created table public.pricing_plans");

    // 5. Seed default plans (low prices for testing)
    await client.query(`
      INSERT INTO public.pricing_plans (plan_key, plan_name, price, duration_months) VALUES
      ('monthly', 'Monthly Plan', 1.00, 1),
      ('3_months', '3 Months Plan', 2.00, 3),
      ('6_months', '6 Months Plan', 3.00, 6),
      ('12_months', '12 Months Plan', 4.00, 12)
      ON CONFLICT (plan_key) DO UPDATE 
      SET plan_name = EXCLUDED.plan_name, price = EXCLUDED.price, duration_months = EXCLUDED.duration_months
    `);
    console.log("Seeded pricing plans");

    console.log("Database migration finished successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
