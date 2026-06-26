const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  console.log("Inspecting item ID 2 details for ABC123...");

  // 1. Fetch item
  const itemRes = await client.query("SELECT * FROM public.inventory_items WHERE id = 2 OR orgcode = 'ABC123'");
  console.log("\nItems:", itemRes.rows);

  // 2. Fetch locations
  const locRes = await client.query("SELECT * FROM public.inventory_locations WHERE orgcode = 'ABC123'");
  console.log("\nLocations:", locRes.rows);

  // 3. Fetch balances
  const balRes = await client.query("SELECT * FROM public.inventory_balances WHERE item_id = 2");
  console.log("\nBalances for Item 2:", balRes.rows);

  // 4. Fetch transactions in details
  const detailRes = await client.query(`
    SELECT d.*, h.from_location_id, h.to_location_id, h.orgcode 
    FROM public.inventory_transaction_details d
    JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
    WHERE d.item_id = 2
  `);
  console.log("\nTransaction Details for Item 2:", detailRes.rows);

  await client.end();
}
main().catch(console.error);
