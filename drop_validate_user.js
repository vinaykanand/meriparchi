const { Client } = require('pg');

async function dropFunctions() {
  const client = new Client({
    connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
  });

  try {
    await client.connect();
    
    await client.query(`
      DROP FUNCTION IF EXISTS public.validate_user(character varying, character varying, character varying);
      DROP FUNCTION IF EXISTS public.validate_user(character varying, character varying, character varying, integer);
    `);

    console.log("Dropped validate_user successfully!");
  } catch (err) {
    console.error('Connection error', err.stack);
  } finally {
    await client.end();
  }
}

dropFunctions();
