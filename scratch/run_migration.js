const { Client } = require('pg');

async function runMigration() {
  const client = new Client({
    connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
  });

  try {
    await client.connect();
    console.log("Connected to database. Running migration...");

    // 1. Add subscription columns to public.company
    await client.query(`
      ALTER TABLE public.company 
      ADD COLUMN IF NOT EXISTS subscription_type VARCHAR(50) DEFAULT 'trial',
      ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days';
    `);
    console.log("Subscription columns added to public.company table.");

    // 2. Add issuperadmin column to public.users
    await client.query(`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS issuperadmin BOOLEAN DEFAULT false;
    `);
    console.log("issuperadmin column added to public.users table.");

    // 3. Ensure SUPER company exists
    const compCheck = await client.query("SELECT orgcode FROM public.company WHERE orgcode = 'SUPER'");
    if (compCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO public.company (orgcode, orgname, subscription_type, subscription_end)
        VALUES ('SUPER', 'Super Admin Org', 'monthly', CURRENT_TIMESTAMP + INTERVAL '100 years');
      `);
      console.log("SUPER company created.");
    }

    // 4. Ensure superadmin user exists
    const userCheck = await client.query("SELECT userid FROM public.users WHERE orgcode = 'SUPER' AND userid = 'superadmin'");
    if (userCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO public.users (orgcode, userid, password, isadmin, issuperadmin, isactive, authtoken)
        VALUES ('SUPER', 'superadmin', 'super@123', true, true, true, gen_random_uuid());
      `);
      console.log("superadmin user created under SUPER organization.");
    } else {
      // Ensure superadmin has issuperadmin set to true
      await client.query(`
        UPDATE public.users 
        SET issuperadmin = true 
        WHERE orgcode = 'SUPER' AND userid = 'superadmin';
      `);
      console.log("superadmin user updated.");
    }

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

runMigration();
