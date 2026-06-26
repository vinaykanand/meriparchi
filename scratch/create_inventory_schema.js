const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    console.log("Starting inventory database migration...");
    
    // 1. Create inventory_locations table
    console.log("Creating public.inventory_locations table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_locations (
        id SERIAL PRIMARY KEY,
        orgcode VARCHAR(50) NOT NULL REFERENCES public.company(orgcode) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_org_location UNIQUE (orgcode, name)
      )
    `);

    // 2. Create inventory_financial_years table
    console.log("Creating public.inventory_financial_years table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_financial_years (
        id SERIAL PRIMARY KEY,
        orgcode VARCHAR(50) NOT NULL REFERENCES public.company(orgcode) ON DELETE CASCADE,
        name VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_closed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_org_fy UNIQUE (orgcode, name)
      )
    `);

    // 3. Create inventory_items table
    console.log("Creating public.inventory_items table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_items (
        sku VARCHAR(100) NOT NULL,
        orgcode VARCHAR(50) NOT NULL REFERENCES public.company(orgcode) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (orgcode, sku)
      )
    `);

    // 4. Create inventory_transactions table
    console.log("Creating public.inventory_transactions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_transactions (
        id BIGSERIAL PRIMARY KEY,
        orgcode VARCHAR(50) NOT NULL REFERENCES public.company(orgcode) ON DELETE CASCADE,
        financial_year_id INTEGER REFERENCES public.inventory_financial_years(id) ON DELETE CASCADE,
        transaction_date DATE NOT NULL,
        transaction_type VARCHAR(50) NOT NULL,
        sku VARCHAR(100) NOT NULL,
        qty NUMERIC(15,4) NOT NULL,
        from_location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
        to_location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
        party_name VARCHAR(200),
        reference_no VARCHAR(100),
        remarks TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Create inventory_balances table
    console.log("Creating public.inventory_balances table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_balances (
        id BIGSERIAL PRIMARY KEY,
        orgcode VARCHAR(50) NOT NULL REFERENCES public.company(orgcode) ON DELETE CASCADE,
        financial_year_id INTEGER REFERENCES public.inventory_financial_years(id) ON DELETE CASCADE,
        location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE CASCADE,
        sku VARCHAR(100) NOT NULL,
        opening_qty NUMERIC(15,4) DEFAULT 0,
        closing_qty NUMERIC(15,4) DEFAULT 0,
        CONSTRAINT unique_fy_loc_sku UNIQUE (financial_year_id, location_id, sku)
      )
    `);

    console.log("Inventory database migration finished successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
