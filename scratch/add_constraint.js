const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  
  // 1. Ensure no violating records exist (set issuperadmin = false for non-SUPER companies if any exist)
  await client.query("UPDATE public.users SET issuperadmin = false WHERE orgcode != 'SUPER' AND (issuperadmin = true OR issuperadmin IS NULL)");
  
  // 2. Add CHECK constraint
  try {
    await client.query("ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_issuperadmin");
    await client.query("ALTER TABLE public.users ADD CONSTRAINT chk_issuperadmin CHECK (issuperadmin = false OR orgcode = 'SUPER')");
    console.log("CHECK constraint chk_issuperadmin added successfully!");
  } catch (err) {
    console.error("Error adding CHECK constraint:", err);
  }

  await client.end();
}
main();
