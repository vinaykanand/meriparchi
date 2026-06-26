const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("Altering company tables and billing plans...");

    // 1. Alter company table to add inventory_enabled
    await client.query(`
      ALTER TABLE public.company 
      ADD COLUMN IF NOT EXISTS inventory_enabled BOOLEAN DEFAULT FALSE
    `);
    console.log("Added inventory_enabled to public.company");

    // 2. Alter company_subscriptions table to add has_inventory
    await client.query(`
      ALTER TABLE public.company_subscriptions 
      ADD COLUMN IF NOT EXISTS has_inventory BOOLEAN DEFAULT FALSE
    `);
    console.log("Added has_inventory to public.company_subscriptions");

    // 3. Seed pricing plans with inventory
    await client.query(`
      INSERT INTO public.pricing_plans (plan_key, plan_name, price, duration_months) VALUES
      ('monthly_inventory', 'Monthly Plan with Inventory', 2.00, 1),
      ('3_months_inventory', '3 Months Plan with Inventory', 4.00, 3),
      ('6_months_inventory', '6 Months Plan with Inventory', 6.00, 6),
      ('12_months_inventory', '12 Months Plan with Inventory', 8.00, 12)
      ON CONFLICT (plan_key) DO UPDATE 
      SET plan_name = EXCLUDED.plan_name, price = EXCLUDED.price, duration_months = EXCLUDED.duration_months
    `);
    console.log("Seeded inventory-enabled pricing plans");

    // 4. Update the default test company to have inventory permission for validation
    const compRes = await client.query("SELECT orgcode FROM public.company LIMIT 1");
    if (compRes.rows.length > 0) {
      const orgcode = compRes.rows[0].orgcode;
      await client.query(
        "UPDATE public.company_subscriptions SET has_inventory = true WHERE orgcode = $1",
        [orgcode]
      );
      await client.query(
        "UPDATE public.company SET inventory_enabled = true WHERE orgcode = $1",
        [orgcode]
      );
      console.log(`Enabled inventory in settings and subscription for test company: ${orgcode}`);
    }

    console.log("Migration executed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
