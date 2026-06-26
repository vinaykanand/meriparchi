const { Client } = require('pg');
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    console.log("Updating subscription for company ABC123...");
    
    // Update company subscription to monthly_inventory and set has_inventory to true
    await client.query(`
      UPDATE public.company_subscriptions 
      SET subscription_type = 'monthly_inventory', has_inventory = true 
      WHERE orgcode = 'ABC123'
    `);
    
    // Enable inventory in the company profile settings
    await client.query(`
      UPDATE public.company 
      SET inventory_enabled = true 
      WHERE orgcode = 'ABC123'
    `);

    console.log("ABC123 plan successfully updated to Parchi + Inventory (monthly_inventory) and enabled in settings.");
    
    // Verify changes
    const comp = await client.query("SELECT orgcode, inventory_enabled FROM public.company WHERE orgcode = 'ABC123'");
    const sub = await client.query("SELECT orgcode, subscription_type, has_inventory FROM public.company_subscriptions WHERE orgcode = 'ABC123'");
    console.log("Updated Company Details:", comp.rows[0]);
    console.log("Updated Subscription Details:", sub.rows[0]);
  } catch (err) {
    console.error("Failed to update plan:", err);
  } finally {
    await client.end();
  }
}
run();
