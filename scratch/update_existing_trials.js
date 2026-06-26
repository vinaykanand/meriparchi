const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query(`
      UPDATE public.company
      SET 
        subscription_start = COALESCE(subscription_start, CURRENT_TIMESTAMP),
        subscription_end = COALESCE(subscription_start, CURRENT_TIMESTAMP) + INTERVAL '10 days'
      WHERE subscription_type = 'trial'
    `);
    console.log(`Successfully updated ${res.rowCount} trial companies.`);
  } catch (err) {
    console.error("Error updating trial companies:", err);
  } finally {
    await client.end();
  }
}

run();
