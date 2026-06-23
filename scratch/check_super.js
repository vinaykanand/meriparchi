const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  const res = await client.query("SELECT userid, orgcode, issuperadmin, isactive FROM public.users WHERE issuperadmin = true");
  console.log("Super Admin Users:", res.rows);
  await client.end();
}
main();
