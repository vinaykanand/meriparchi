const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  console.log("Adding reorder_level column to public.inventory_items...");
  await client.query(`
    ALTER TABLE public.inventory_items 
    ADD COLUMN IF NOT EXISTS reorder_level NUMERIC(15,4) DEFAULT 0
  `);
  console.log("Column added successfully!");
  await client.end();
}
main().catch(console.error);
