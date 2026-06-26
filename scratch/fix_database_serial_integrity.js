const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  console.log("Starting DB serial and referential integrity fixes...");

  await client.query("BEGIN");

  try {
    // 1. Add voucher_no column to inventory_transaction_headers if it does not exist
    console.log("Checking and adding voucher_no column...");
    await client.query(`
      ALTER TABLE public.inventory_transaction_headers 
      ADD COLUMN IF NOT EXISTS voucher_no INTEGER;
    `);

    // 2. Populate voucher_no sequentially for existing headers
    console.log("Populating existing voucher numbers...");
    const headersRes = await client.query(`
      SELECT id, orgcode, financial_year_id, created_at 
      FROM public.inventory_transaction_headers 
      ORDER BY orgcode, financial_year_id, id ASC
    `);

    const counters = {};
    for (const h of headersRes.rows) {
      const key = `${h.orgcode}-${h.financial_year_id}`;
      if (!counters[key]) {
        counters[key] = 1;
      } else {
        counters[key] += 1;
      }
      await client.query(`
        UPDATE public.inventory_transaction_headers 
        SET voucher_no = $1 
        WHERE id = $2
      `, [counters[key], h.id]);
    }

    // 3. Create or replace the trigger function to auto-assign sequential voucher_no per orgcode & financial_year_id
    console.log("Creating trigger function for voucher_no auto-generation...");
    await client.query(`
      CREATE OR REPLACE FUNCTION public.generate_inventory_voucher_no()
      RETURNS TRIGGER AS $$
      DECLARE
          next_no INT;
      BEGIN
          IF NEW.voucher_no IS NULL THEN
              SELECT COALESCE(MAX(voucher_no), 0) + 1 INTO next_no
              FROM public.inventory_transaction_headers
              WHERE orgcode = NEW.orgcode AND financial_year_id = NEW.financial_year_id;
              
              NEW.voucher_no := next_no;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Drop trigger if exists and recreate
    await client.query(`
      DROP TRIGGER IF EXISTS trg_generate_inventory_voucher_no ON public.inventory_transaction_headers;
    `);
    await client.query(`
      CREATE TRIGGER trg_generate_inventory_voucher_no
      BEFORE INSERT ON public.inventory_transaction_headers
      FOR EACH ROW
      EXECUTE FUNCTION public.generate_inventory_voucher_no();
    `);

    // 4. Ensure foreign key constraint on public.inventory_transaction_details is ON DELETE CASCADE
    console.log("Ensuring referential integrity ON DELETE CASCADE for inventory_transaction_details...");
    
    // Find the foreign key constraint name first
    const fkQuery = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'inventory_transaction_details' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%header%'
    `);
    
    const fkConstraintName = fkQuery.rows[0]?.constraint_name || "inventory_transaction_details_transaction_header_id_fkey";
    
    console.log(`Dropping existing constraint: ${fkConstraintName}`);
    await client.query(`
      ALTER TABLE public.inventory_transaction_details 
      DROP CONSTRAINT IF EXISTS ${fkConstraintName};
    `);

    console.log("Creating new constraint with ON DELETE CASCADE...");
    await client.query(`
      ALTER TABLE public.inventory_transaction_details 
      ADD CONSTRAINT inventory_transaction_details_transaction_header_id_fkey 
      FOREIGN KEY (transaction_header_id) 
      REFERENCES public.inventory_transaction_headers(id) 
      ON DELETE CASCADE;
    `);

    await client.query("COMMIT");
    console.log("Integrity changes applied successfully!");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", e);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
