const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("Running inventory integration tests...");

    // 1. Get an existing company orgcode
    const compRes = await client.query("SELECT orgcode FROM public.company LIMIT 1");
    if (compRes.rows.length === 0) {
      console.log("No companies found in database. Exiting tests.");
      return;
    }
    const orgcode = compRes.rows[0].orgcode;
    console.log(`Using company orgcode: ${orgcode}`);

    // Clean up any existing test inventory data for this orgcode
    await client.query("DELETE FROM public.inventory_transactions WHERE orgcode = $1", [orgcode]);
    await client.query("DELETE FROM public.inventory_balances WHERE orgcode = $1", [orgcode]);
    await client.query("DELETE FROM public.inventory_locations WHERE orgcode = $1", [orgcode]);
    await client.query("DELETE FROM public.inventory_items WHERE orgcode = $1", [orgcode]);
    await client.query("DELETE FROM public.inventory_financial_years WHERE orgcode = $1", [orgcode]);

    // 2. Insert test financial year
    console.log("Inserting test Financial Year...");
    const fyRes = await client.query(
      `INSERT INTO public.inventory_financial_years (orgcode, name, start_date, end_date, is_closed)
       VALUES ($1, 'FY 2025-26', '2025-04-01', '2026-03-31', false)
       RETURNING id`,
      [orgcode]
    );
    const fyId = fyRes.rows[0].id;
    console.log(`Created Financial Year ID: ${fyId}`);

    // 3. Insert test locations
    console.log("Inserting test locations...");
    const loc1 = await client.query(
      "INSERT INTO public.inventory_locations (orgcode, name) VALUES ($1, 'Warehouse A') RETURNING id",
      [orgcode]
    );
    const loc2 = await client.query(
      "INSERT INTO public.inventory_locations (orgcode, name) VALUES ($1, 'Warehouse B') RETURNING id",
      [orgcode]
    );
    const loc1Id = loc1.rows[0].id;
    const loc2Id = loc2.rows[0].id;
    console.log(`Created Locations: Warehouse A (ID: ${loc1Id}), Warehouse B (ID: ${loc2Id})`);

    // 4. Insert test item SKU
    console.log("Inserting test SKU...");
    await client.query(
      "INSERT INTO public.inventory_items (sku, orgcode, name, description) VALUES ('SKU-WIRE', $1, 'Copper Wire Roll', 'High quality wire')",
      [orgcode]
    );

    // 5. Initialize balances
    console.log("Initializing balances...");
    await client.query(
      "INSERT INTO public.inventory_balances (orgcode, financial_year_id, location_id, sku, opening_qty) VALUES ($1, $2, $3, 'SKU-WIRE', 100)",
      [orgcode, fyId, loc1Id]
    );

    // 6. Log transactions
    // Receive 50 from vendor at Warehouse A
    console.log("Logging Receive from Vendor transaction...");
    await client.query(
      `INSERT INTO public.inventory_transactions 
         (orgcode, financial_year_id, transaction_date, transaction_type, sku, qty, to_location_id, party_name, reference_no)
       VALUES ($1, $2, '2025-05-10', 'vendor_to_location', 'SKU-WIRE', 50, $3, 'Vendor Inc', 'BILL-01')`,
      [orgcode, fyId, loc1Id]
    );

    // Transfer 30 from Warehouse A to Warehouse B
    console.log("Logging Transfer transaction...");
    await client.query(
      `INSERT INTO public.inventory_transactions 
         (orgcode, financial_year_id, transaction_date, transaction_type, sku, qty, from_location_id, to_location_id, reference_no)
       VALUES ($1, $2, '2025-06-15', 'location_to_location', 'SKU-WIRE', 30, $3, $4, 'TRANS-01')`,
      [orgcode, fyId, loc1Id, loc2Id]
    );

    // Issue 10 to customer from Warehouse B
    console.log("Logging Issue to Customer transaction...");
    await client.query(
      `INSERT INTO public.inventory_transactions 
         (orgcode, financial_year_id, transaction_date, transaction_type, sku, qty, from_location_id, party_name, reference_no)
       VALUES ($1, $2, '2025-07-20', 'location_to_customer', 'SKU-WIRE', 10, $3, 'John Doe', 'SLIP-01')`,
      [orgcode, fyId, loc2Id]
    );

    // 7. Compute Stock balances
    console.log("Computing active balances...");
    const balanceQuery = `
      WITH transactions_in AS (
        SELECT to_location_id as location_id, sku, SUM(qty) as total_in
        FROM public.inventory_transactions
        WHERE orgcode = $1 AND financial_year_id = $2
        GROUP BY to_location_id, sku
      ),
      transactions_out AS (
        SELECT from_location_id as location_id, sku, SUM(qty) as total_out
        FROM public.inventory_transactions
        WHERE orgcode = $1 AND financial_year_id = $2
        GROUP BY from_location_id, sku
      )
      SELECT 
        loc.name as location_name,
        COALESCE(bal.opening_qty, 0) as opening,
        COALESCE(tin.total_in, 0) as total_in,
        COALESCE(tout.total_out, 0) as total_out,
        (COALESCE(bal.opening_qty, 0) + COALESCE(tin.total_in, 0) - COALESCE(tout.total_out, 0)) as current_qty
      FROM public.inventory_locations loc
      LEFT JOIN public.inventory_balances bal ON bal.financial_year_id = $2 AND bal.location_id = loc.id AND bal.sku = 'SKU-WIRE'
      LEFT JOIN transactions_in tin ON tin.location_id = loc.id AND tin.sku = 'SKU-WIRE'
      LEFT JOIN transactions_out tout ON tout.location_id = loc.id AND tout.sku = 'SKU-WIRE'
      WHERE loc.orgcode = $1;
    `;
    const stockRes = await client.query(balanceQuery, [orgcode, fyId]);
    console.log("Computed stock results:", stockRes.rows);

    // Warehouse A should have: Opening = 100, In = 50 (Vendor), Out = 30 (Transfer) => Current = 120
    // Warehouse B should have: Opening = 0, In = 30 (Transfer), Out = 10 (Customer) => Current = 20
    const wA = stockRes.rows.find(r => r.location_name === 'Warehouse A');
    const wB = stockRes.rows.find(r => r.location_name === 'Warehouse B');

    console.log(`Warehouse A balance verification: Expected 120, got ${wA.current_qty}`);
    console.log(`Warehouse B balance verification: Expected 20, got ${wB.current_qty}`);

    if (parseFloat(wA.current_qty) === 120 && parseFloat(wB.current_qty) === 20) {
      console.log("🎉 Stock calculations are correct!");
    } else {
      console.error("❌ Stock calculations mismatch!");
    }

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    await client.end();
  }
}

run();
