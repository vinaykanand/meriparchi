import { query } from "../src/lib/db";

async function main() {
  try {
    await query(`
      ALTER TABLE public.company 
      ADD COLUMN IF NOT EXISTS backup_retention_count integer DEFAULT 5;
    `);
    console.log("Column backup_retention_count added or already exists.");
  } catch (err) {
    console.error("Error altering table:", err);
  }
}

main();
