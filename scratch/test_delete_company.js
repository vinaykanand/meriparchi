const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres' });

async function testDelete() {
  const client = await pool.connect();
  try {
    // Check which tables exist
    const tablesRes = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log('=== Existing tables ===');
    console.log(tables.sort().join(', '));

    // Try a mock delete of ABC123 to see what fails
    const orgcode = 'ABC123';
    console.log(`\n=== Testing DELETE for ${orgcode} ===`);
    
    await client.query('BEGIN');
    
    const steps = [
      "DELETE FROM public.slipitems WHERE id IN (SELECT id FROM public.slips WHERE orgcode = $1)",
      "DELETE FROM public.slips WHERE orgcode = $1",
      "DELETE FROM public.payments WHERE orgcode = $1",
      "DELETE FROM public.users WHERE orgcode = $1",
      "DELETE FROM public.company_subscriptions WHERE orgcode = $1",
      "DELETE FROM public.coupon_uses WHERE orgcode = $1",
      "DELETE FROM public.payment_history WHERE orgcode = $1",
      "DELETE FROM public.audit_logs WHERE orgcode = $1",
      "DELETE FROM public.company WHERE orgcode = $1",
    ];
    
    for (const step of steps) {
      try {
        const r = await client.query(step, [orgcode]);
        console.log(`OK (${r.rowCount} rows): ${step.substring(0, 60)}...`);
      } catch (e) {
        console.error(`FAIL: ${step.substring(0, 60)}...`);
        console.error('  Error:', e.message);
        await client.query('ROLLBACK');
        return;
      }
    }
    
    // ROLLBACK — we don't actually want to delete
    await client.query('ROLLBACK');
    console.log('\nROLLBACK done (dry run only)');
    
  } finally {
    client.release();
    pool.end();
  }
}

testDelete().catch(console.error);
