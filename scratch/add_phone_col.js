const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE public.company ADD COLUMN IF NOT EXISTS phone character varying;
    `);
    console.log("Column 'phone' added to table 'company' successfully.");
  } catch (err) {
    console.error("Error adding column:", err);
  } finally {
    await client.end();
  }
}
main();
