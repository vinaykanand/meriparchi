const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_transaction_headers'
  `);
  console.log("Columns of inventory_transaction_headers:", res.rows);

  const res2 = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_transaction_details'
  `);
  console.log("Columns of inventory_transaction_details:", res2.rows);

  await client.end();
}
main().catch(console.error);
