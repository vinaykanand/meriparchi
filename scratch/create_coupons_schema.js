const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    console.log("Starting coupons database migration...");
    
    // Create coupons table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.coupons (
        code VARCHAR(50) PRIMARY KEY,
        discount VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL,
        value NUMERIC NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expiry_date TIMESTAMP NOT NULL,
        total_usage INT NOT NULL DEFAULT 0
      )
    `);
    console.log("Created table public.coupons");

    // Seed default coupons
    await client.query(`
      INSERT INTO public.coupons (code, discount, type, value, status, start_date, expiry_date, total_usage)
      VALUES 
        ('WELCOME50', '50% Off', 'percentage', 50, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 year', 0),
        ('FLAT100', '₹100 Off', 'flat', 100, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 year', 0)
      ON CONFLICT (code) DO NOTHING
    `);
    console.log("Seeded default coupons");

    console.log("Coupons database migration finished successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
