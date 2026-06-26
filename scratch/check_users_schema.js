const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  try {
    // Check audit_logs columns
    const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' ORDER BY ordinal_position");
    console.log("audit_logs columns:", r.rows.map(x => x.column_name).join(', '));
  } catch(e) {
    console.error("Error:", e.message);
  } finally {
    await pool.end();
  }
}
main();
