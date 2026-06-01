const { Client } = require('pg');
const fs = require('fs');

async function getFunctions() {
  const client = new Client({
    connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
  });

  try {
    await client.connect();
    
    const res = await client.query(`
      SELECT
          p.proname AS function_name,
          pg_get_functiondef(p.oid) AS function_definition
      FROM
          pg_proc p
      JOIN
          pg_namespace n ON p.pronamespace = n.oid
      WHERE
          n.nspname = 'public';
    `);

    let output = '# Supabase Database Functions\n\n';

    for (let row of res.rows) {
      output += `## Function: \`${row.function_name}\`\n`;
      output += '```sql\n' + row.function_definition + '\n```\n\n';
    }

    fs.writeFileSync('database_functions.md', output);
    console.log("Written to database_functions.md");

  } catch (err) {
    console.error('Connection error', err.stack);
  } finally {
    await client.end();
  }
}

getFunctions();
