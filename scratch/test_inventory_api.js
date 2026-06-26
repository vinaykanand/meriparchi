const { Client } = require("pg");
const client = new Client({
  connectionString: 'postgresql://postgres.ekzrjsjulqkoqvqgtsgi:XnktyeCEzLi41W5K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  const orgcode = "ABC123";
  const selectedFyId = 2;

  const stockQuery = `
      WITH transactions_in AS (
        SELECT 
          h.to_location_id as location_id,
          d.item_id,
          SUM(d.qty) as total_in
        FROM public.inventory_transaction_details d
        JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
        WHERE h.orgcode = $1 AND h.financial_year_id = $2
        GROUP BY h.to_location_id, d.item_id
      ),
      transactions_out AS (
        SELECT 
          h.from_location_id as location_id,
          d.item_id,
          SUM(d.qty) as total_out
        FROM public.inventory_transaction_details d
        JOIN public.inventory_transaction_headers h ON d.transaction_header_id = h.id
        WHERE h.orgcode = $1 AND h.financial_year_id = $2
        GROUP BY h.from_location_id, d.item_id
      )
      SELECT 
        items.id as item_id,
        items.sku,
        items.name as item_name,
        loc.id as location_id,
        loc.name as location_name,
        COALESCE(bal.opening_qty, 0) as opening_qty,
        COALESCE(tin.total_in, 0) as total_in,
        COALESCE(tout.total_out, 0) as total_out,
        (COALESCE(bal.opening_qty, 0) + COALESCE(tin.total_in, 0) - COALESCE(tout.total_out, 0)) as current_qty
      FROM public.inventory_items items
      CROSS JOIN public.inventory_locations loc
      LEFT JOIN public.inventory_balances bal ON bal.financial_year_id = $2 AND bal.location_id = loc.id AND bal.item_id = items.id
      LEFT JOIN transactions_in tin ON tin.location_id = loc.id AND tin.item_id = items.id
      LEFT JOIN transactions_out tout ON tout.location_id = loc.id AND tout.item_id = items.id
      WHERE items.orgcode = $1 AND loc.orgcode = $1
      ORDER BY items.name, loc.name;
  `;

  const stockResult = await client.query(stockQuery, [orgcode, selectedFyId]);
  console.log("Stock overview records:", stockResult.rows);

  await client.end();
}
main().catch(console.error);
