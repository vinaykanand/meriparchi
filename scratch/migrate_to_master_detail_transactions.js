const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  console.log("Starting master-detail transaction schema migration...");

  await client.query("BEGIN");

  try {
    // 1. Create inventory_transaction_headers
    console.log("Creating public.inventory_transaction_headers table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_transaction_headers (
        id BIGSERIAL PRIMARY KEY,
        orgcode VARCHAR(50) NOT NULL REFERENCES public.company(orgcode) ON DELETE CASCADE,
        financial_year_id INTEGER REFERENCES public.inventory_financial_years(id) ON DELETE CASCADE,
        transaction_date DATE NOT NULL,
        transaction_type_id INTEGER REFERENCES public.inventory_transaction_types(id),
        from_location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
        to_location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
        party_name VARCHAR(200),
        reference_no VARCHAR(100),
        remarks TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Create inventory_transaction_details
    console.log("Creating public.inventory_transaction_details table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_transaction_details (
        id BIGSERIAL PRIMARY KEY,
        transaction_header_id BIGINT NOT NULL REFERENCES public.inventory_transaction_headers(id) ON DELETE CASCADE,
        item_id INTEGER NOT NULL REFERENCES public.inventory_items(id),
        qty NUMERIC(15,4) NOT NULL
      )
    `);

    // 3. Migrate data if old flat table exists
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'inventory_transactions'
    `);

    if (tableCheck.rows.length > 0) {
      console.log("Migrating transaction data from inventory_transactions to master-detail tables...");
      
      // Fetch all old transactions
      const txnsRes = await client.query(`
        SELECT id, orgcode, financial_year_id, transaction_date, transaction_type_id, item_id, qty, from_location_id, to_location_id, party_name, reference_no, remarks, created_at 
        FROM public.inventory_transactions
      `);

      // We group them by unique header properties: (orgcode, financial_year_id, transaction_date, transaction_type_id, from_location_id, to_location_id, party_name, reference_no, remarks)
      const groups = {};
      for (const t of txnsRes.rows) {
        const key = `${t.orgcode}|${t.financial_year_id}|${t.transaction_date}|${t.transaction_type_id}|${t.from_location_id}|${t.to_location_id}|${t.party_name}|${t.reference_no}|${t.remarks}`;
        if (!groups[key]) {
          groups[key] = {
            orgcode: t.orgcode,
            financial_year_id: t.financial_year_id,
            transaction_date: t.transaction_date,
            transaction_type_id: t.transaction_type_id,
            from_location_id: t.from_location_id,
            to_location_id: t.to_location_id,
            party_name: t.party_name,
            reference_no: t.reference_no,
            remarks: t.remarks,
            created_at: t.created_at,
            items: []
          };
        }
        groups[key].items.push({
          item_id: t.item_id,
          qty: t.qty
        });
      }

      // Insert headers and details
      for (const key in groups) {
        const g = groups[key];
        const headerRes = await client.query(`
          INSERT INTO public.inventory_transaction_headers 
            (orgcode, financial_year_id, transaction_date, transaction_type_id, from_location_id, to_location_id, party_name, reference_no, remarks, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `, [
          g.orgcode, g.financial_year_id, g.transaction_date, g.transaction_type_id, 
          g.from_location_id, g.to_location_id, g.party_name, g.reference_no, g.remarks, g.created_at
        ]);

        const headerId = headerRes.rows[0].id;
        for (const item of g.items) {
          await client.query(`
            INSERT INTO public.inventory_transaction_details (transaction_header_id, item_id, qty)
            VALUES ($1, $2, $3)
          `, [headerId, item.item_id, item.qty]);
        }
      }

      // Drop old inventory_transactions
      console.log("Dropping old public.inventory_transactions table...");
      await client.query("DROP TABLE public.inventory_transactions CASCADE");
    }

    await client.query("COMMIT");
    console.log("Master-detail database migration finished successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
