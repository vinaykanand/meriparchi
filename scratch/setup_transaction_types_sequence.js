const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  console.log("Setting up public.inventory_transaction_types_code_seq sequence...");

  const res = await client.query("SELECT COALESCE(MAX(code), 0) as max_code FROM public.inventory_transaction_types");
  const nextVal = parseInt(res.rows[0].max_code, 10) + 1;
  console.log(`Max code is currently: ${res.rows[0].max_code}. Next sequence value will be: ${nextVal}`);

  // Create sequence starting at nextVal
  await client.query(`DROP SEQUENCE IF EXISTS public.inventory_transaction_types_code_seq CASCADE`);
  await client.query(`CREATE SEQUENCE public.inventory_transaction_types_code_seq START WITH ${nextVal}`);
  console.log("Sequence created successfully!");

  await client.end();
}
main().catch(console.error);
