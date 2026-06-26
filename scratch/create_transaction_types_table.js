const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  console.log("Creating public.inventory_transaction_types table...");

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.inventory_transaction_types (
      orgcode VARCHAR(50) NOT NULL REFERENCES public.company(orgcode) ON DELETE CASCADE,
      code VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      stock_effect VARCHAR(20) NOT NULL, -- 'INWARD', 'OUTWARD', 'TRANSFER'
      from_type VARCHAR(20) NOT NULL,    -- 'vendor', 'location', 'customer', 'none'
      to_type VARCHAR(20) NOT NULL,      -- 'vendor', 'location', 'customer', 'none'
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (orgcode, code)
    )
  `);

  console.log("Seeding default transaction types for all existing companies...");
  // Get all companies
  const companiesRes = await client.query("SELECT orgcode FROM public.company");
  for (const row of companiesRes.rows) {
    const orgcode = row.orgcode;
    const defaults = [
      { code: "VEN_REC", name: "Vendor Receipt", stock_effect: "INWARD", from_type: "vendor", to_type: "location" },
      { code: "CUST_ISS", name: "Customer Issue", stock_effect: "OUTWARD", from_type: "location", to_type: "customer" },
      { code: "WH_TRANS", name: "Warehouse Transfer", stock_effect: "TRANSFER", from_type: "location", to_type: "location" },
      { code: "CUST_RET", name: "Customer Return", stock_effect: "INWARD", from_type: "customer", to_type: "location" },
      { code: "VEN_RET", name: "Vendor Return", stock_effect: "OUTWARD", from_type: "location", to_type: "vendor" }
    ];

    for (const d of defaults) {
      await client.query(`
        INSERT INTO public.inventory_transaction_types (orgcode, code, name, stock_effect, from_type, to_type)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (orgcode, code) DO NOTHING
      `, [orgcode, d.code, d.name, d.stock_effect, d.from_type, d.to_type]);
    }
  }

  console.log("Updating any existing inventory transactions to use standardized codes...");
  // Maps old text descriptors to new codes
  await client.query(`
    UPDATE public.inventory_transactions 
    SET transaction_type = 'VEN_REC' 
    WHERE transaction_type ILIKE '%receipt%' OR transaction_type ILIKE '%vendor%' OR transaction_type = 'inward'
  `);
  await client.query(`
    UPDATE public.inventory_transactions 
    SET transaction_type = 'CUST_ISS' 
    WHERE transaction_type ILIKE '%issue%' OR transaction_type ILIKE '%customer%' OR transaction_type = 'outward'
  `);
  await client.query(`
    UPDATE public.inventory_transactions 
    SET transaction_type = 'WH_TRANS' 
    WHERE transaction_type ILIKE '%transfer%' OR transaction_type = 'transfer'
  `);

  console.log("Migration complete!");
  await client.end();
}

main().catch(console.error);
