const { Client } = require('pg');

async function addCompanyEmailColumn() {
  const client = new Client({
    connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
  });

  try {
    await client.connect();
    
    await client.query(`
      ALTER TABLE public.company ADD COLUMN IF NOT EXISTS email VARCHAR(255) DEFAULT '';
    `);

    console.log("Added email column to public.company successfully!");
  } catch (err) {
    console.error('Connection error', err.stack);
  } finally {
    await client.end();
  }
}

addCompanyEmailColumn();
