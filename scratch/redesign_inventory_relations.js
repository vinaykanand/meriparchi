const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  console.log("Starting relational redesign migration...");

  // Begin transaction
  await client.query("BEGIN");

  try {
    // 1. Redesign inventory_items
    console.log("Restructuring public.inventory_items...");
    const checkItemCol = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'inventory_items' AND column_name = 'id'
    `);
    
    if (checkItemCol.rows.length === 0) {
      await client.query(`ALTER TABLE public.inventory_items ADD COLUMN id SERIAL`);
      await client.query(`ALTER TABLE public.inventory_items DROP CONSTRAINT inventory_items_pkey CASCADE`);
      await client.query(`ALTER TABLE public.inventory_items ADD PRIMARY KEY (id)`);
      await client.query(`ALTER TABLE public.inventory_items ADD CONSTRAINT unique_org_sku UNIQUE (orgcode, sku)`);
    }

    // 2. Redesign inventory_transaction_types
    console.log("Restructuring public.inventory_transaction_types...");
    const checkTypeCol = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'inventory_transaction_types' AND column_name = 'id'
    `);

    if (checkTypeCol.rows.length === 0) {
      await client.query(`ALTER TABLE public.inventory_transaction_types ADD COLUMN id SERIAL`);
      await client.query(`ALTER TABLE public.inventory_transaction_types DROP CONSTRAINT inventory_transaction_types_pkey CASCADE`);
      await client.query(`ALTER TABLE public.inventory_transaction_types ADD PRIMARY KEY (id)`);
      await client.query(`ALTER TABLE public.inventory_transaction_types ADD CONSTRAINT unique_org_code UNIQUE (orgcode, code)`);
    }

    // 3. Redesign inventory_transactions
    console.log("Restructuring public.inventory_transactions...");
    const checkTxnItemCol = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'inventory_transactions' AND column_name = 'item_id'
    `);

    if (checkTxnItemCol.rows.length === 0) {
      // Standarize the transaction types first
      await client.query(`
        UPDATE public.inventory_transactions 
        SET transaction_type = 'WH_TRANS' 
        WHERE transaction_type = 'location_to_location'
      `);

      // Add integer columns
      await client.query(`ALTER TABLE public.inventory_transactions ADD COLUMN item_id INTEGER REFERENCES public.inventory_items(id)`);
      await client.query(`ALTER TABLE public.inventory_transactions ADD COLUMN transaction_type_id INTEGER REFERENCES public.inventory_transaction_types(id)`);

      // Populate item_id by joining on sku & orgcode
      await client.query(`
        UPDATE public.inventory_transactions t
        SET item_id = i.id
        FROM public.inventory_items i
        WHERE t.sku = i.sku AND t.orgcode = i.orgcode
      `);

      // Populate transaction_type_id by joining on code & orgcode
      await client.query(`
        UPDATE public.inventory_transactions t
        SET transaction_type_id = tt.id
        FROM public.inventory_transaction_types tt
        WHERE t.transaction_type = tt.code AND t.orgcode = tt.orgcode
      `);

      // Drop old columns
      await client.query(`ALTER TABLE public.inventory_transactions DROP COLUMN sku`);
      await client.query(`ALTER TABLE public.inventory_transactions DROP COLUMN transaction_type`);

      // Make columns NOT NULL
      await client.query(`ALTER TABLE public.inventory_transactions ALTER COLUMN item_id SET NOT NULL`);
      await client.query(`ALTER TABLE public.inventory_transactions ALTER COLUMN transaction_type_id SET NOT NULL`);
    }

    // 4. Redesign inventory_balances
    console.log("Restructuring public.inventory_balances...");
    const checkBalItemCol = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'inventory_balances' AND column_name = 'item_id'
    `);

    if (checkBalItemCol.rows.length === 0) {
      await client.query(`ALTER TABLE public.inventory_balances ADD COLUMN item_id INTEGER REFERENCES public.inventory_items(id)`);

      // Populate item_id
      await client.query(`
        UPDATE public.inventory_balances b
        SET item_id = i.id
        FROM public.inventory_items i
        WHERE b.sku = i.sku AND b.orgcode = i.orgcode
      `);

      // Drop constraint and column
      await client.query(`ALTER TABLE public.inventory_balances DROP CONSTRAINT unique_fy_loc_sku`);
      await client.query(`ALTER TABLE public.inventory_balances DROP COLUMN sku`);

      // Make column NOT NULL
      await client.query(`ALTER TABLE public.inventory_balances ALTER COLUMN item_id SET NOT NULL`);

      // Add new unique constraint
      await client.query(`ALTER TABLE public.inventory_balances ADD CONSTRAINT unique_fy_loc_item UNIQUE (financial_year_id, location_id, item_id)`);
    }

    await client.query("COMMIT");
    console.log("Relational redesign migration completed successfully!");
  } catch (e) {
    await client.query("ROLLBACK");
    console.log("Migration failed! Rolled back changes.");
    throw e;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
