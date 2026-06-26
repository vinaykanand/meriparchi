const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  console.log("Starting SKU and Code to Integer conversion migration...");

  await client.query("BEGIN");

  try {
    // 1. Migrate inventory_transaction_types: code to INTEGER
    console.log("Migrating public.inventory_transaction_types code to integer...");
    
    // Map standard codes
    await client.query(`UPDATE public.inventory_transaction_types SET code = '1' WHERE code = 'VEN_REC'`);
    await client.query(`UPDATE public.inventory_transaction_types SET code = '2' WHERE code = 'CUST_ISS'`);
    await client.query(`UPDATE public.inventory_transaction_types SET code = '3' WHERE code = 'WH_TRANS'`);
    await client.query(`UPDATE public.inventory_transaction_types SET code = '4' WHERE code = 'CUST_RET'`);
    await client.query(`UPDATE public.inventory_transaction_types SET code = '5' WHERE code = 'VEN_RET'`);

    // In case there are other custom transaction type codes, convert them to unique numbers
    const customTypes = await client.query(`SELECT orgcode, code FROM public.inventory_transaction_types WHERE code NOT IN ('1', '2', '3', '4', '5')`);
    let customIndex = 10;
    for (const row of customTypes.rows) {
      await client.query(`
        UPDATE public.inventory_transaction_types 
        SET code = $1 
        WHERE orgcode = $2 AND code = $3
      `, [String(customIndex++), row.orgcode, row.code]);
    }

    // Drop unique constraint and recreate with altered type
    await client.query(`ALTER TABLE public.inventory_transaction_types DROP CONSTRAINT unique_org_code`);
    await client.query(`ALTER TABLE public.inventory_transaction_types ALTER COLUMN code TYPE INTEGER USING code::integer`);
    await client.query(`ALTER TABLE public.inventory_transaction_types ADD CONSTRAINT unique_org_code UNIQUE (orgcode, code)`);

    // 2. Migrate inventory_items: sku to INTEGER
    console.log("Migrating public.inventory_items sku to integer...");
    
    const itemsRes = await client.query(`SELECT id, sku, orgcode, name FROM public.inventory_items`);
    // Map existing items sequentially
    let itemSkuCounter = 1;
    for (const item of itemsRes.rows) {
      // Append original SKU text to the description or keep name clear
      await client.query(`
        UPDATE public.inventory_items 
        SET sku = $1, description = COALESCE(description, '') || ' [Original SKU: ' || $2 || ']'
        WHERE id = $3
      `, [String(itemSkuCounter++), item.sku, item.id]);
    }

    // Drop unique constraint and recreate with altered type
    await client.query(`ALTER TABLE public.inventory_items DROP CONSTRAINT unique_org_sku`);
    await client.query(`ALTER TABLE public.inventory_items ALTER COLUMN sku TYPE INTEGER USING sku::integer`);
    await client.query(`ALTER TABLE public.inventory_items ADD CONSTRAINT unique_org_sku UNIQUE (orgcode, sku)`);

    await client.query("COMMIT");
    console.log("Conversion migration finished successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
