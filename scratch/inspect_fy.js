const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  const res = await client.query("SELECT * FROM public.inventory_financial_years WHERE orgcode = 'ABC123'");
  console.log("Financial Years for ABC123:", res.rows);
  await client.end();
}
main().catch(console.error);
