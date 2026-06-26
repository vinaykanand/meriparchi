const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  console.log("Seeding Stock Adjustment transaction types for all existing companies...");

  const companiesRes = await client.query("SELECT orgcode FROM public.company");
  for (const row of companiesRes.rows) {
    const orgcode = row.orgcode;
    const adjustments = [
      { code: 6, name: "Stock Adjustment (Shortage/Damage/Theft)", stock_effect: "OUTWARD", from_type: "location", to_type: "none" },
      { code: 7, name: "Stock Adjustment (Surplus/Found)", stock_effect: "INWARD", from_type: "none", to_type: "location" }
    ];

    for (const adj of adjustments) {
      await client.query(`
        INSERT INTO public.inventory_transaction_types (orgcode, code, name, stock_effect, from_type, to_type)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (orgcode, code) DO UPDATE 
        SET name = EXCLUDED.name, stock_effect = EXCLUDED.stock_effect, from_type = EXCLUDED.from_type, to_type = EXCLUDED.to_type
      `, [orgcode, adj.code, adj.name, adj.stock_effect, adj.from_type, adj.to_type]);
    }
  }

  console.log("Seeding complete!");
  await client.end();
}

main().catch(console.error);
