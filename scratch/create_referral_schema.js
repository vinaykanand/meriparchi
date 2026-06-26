const { Client } = require('pg');
const crypto = require('crypto');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

function generateRandomCode() {
  return 'REF-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("Starting database migration for referral program...");

    // 1. Add referral columns to public.company
    await client.query(`
      ALTER TABLE public.company 
      ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE,
      ADD COLUMN IF NOT EXISTS referred_by VARCHAR(50),
      ADD COLUMN IF NOT EXISTS referral_points NUMERIC NOT NULL DEFAULT 0.00
    `);
    console.log("Added columns: referral_code, referred_by, referral_points to public.company");

    // 2. Backfill existing companies with unique referral codes
    const companiesRes = await client.query("SELECT orgcode, referral_code FROM public.company");
    console.log(`Found ${companiesRes.rows.length} existing companies to check/backfill.`);

    for (const row of companiesRes.rows) {
      if (!row.referral_code) {
        let code = generateRandomCode();
        let isUnique = false;
        
        // Ensure uniqueness
        while (!isUnique) {
          const checkRes = await client.query("SELECT orgcode FROM public.company WHERE referral_code = $1", [code]);
          if (checkRes.rows.length === 0) {
            isUnique = true;
          } else {
            code = generateRandomCode();
          }
        }

        await client.query("UPDATE public.company SET referral_code = $1 WHERE orgcode = $2", [code, row.orgcode]);
        console.log(`Assigned referral code ${code} to company ${row.orgcode}`);
      } else {
        console.log(`Company ${row.orgcode} already has referral code: ${row.referral_code}`);
      }
    }

    console.log("Referral database migration finished successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
