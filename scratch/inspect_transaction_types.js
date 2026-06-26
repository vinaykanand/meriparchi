const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  const res = await client.query("SELECT DISTINCT transaction_type, orgcode FROM public.inventory_transactions");
  console.log("Distinct transaction types in transactions table:", res.rows);
  
  const res2 = await client.query("SELECT code, name, orgcode FROM public.inventory_transaction_types");
  console.log("Transaction type codes in types master:", res2.rows);

  await client.end();
}
main().catch(console.error);
