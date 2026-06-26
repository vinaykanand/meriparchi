import { query } from "@/lib/db";
import AdmZip from "adm-zip";
import crypto from "crypto";

function encryptBuffer(buffer: Buffer, password: string): Buffer {
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([salt, iv, encrypted]);
}

export function decryptBuffer(buffer: Buffer, password: string): Buffer {
  const salt = buffer.subarray(0, 16);
  const iv = buffer.subarray(16, 32);
  const encrypted = buffer.subarray(32);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export async function generateBackupZip(orgcode: string, isSuperAdmin: boolean = false): Promise<Buffer> {
  let company, users, payments, slips, slipitems, audit_logs;
  let pricing_plans: any, coupons: any, coupon_uses: any, payment_history: any, company_subscriptions: any;
  let inv_locations: any, inv_financial_years: any, inv_items: any, inv_txn_headers: any, inv_txn_details: any, inv_balances: any, inv_transaction_types: any;

  const actualIsSuperAdmin = isSuperAdmin || orgcode === "SUPER";

  if (actualIsSuperAdmin) {
    // Super admin: back up ALL data across every org
    company = await query("SELECT * FROM public.company");
    users = await query("SELECT * FROM public.users");
    payments = { rows: [] };
    slips = { rows: [] };
    slipitems = { rows: [] };
    audit_logs = await query("SELECT * FROM public.audit_logs WHERE orgcode = $1", [orgcode]);
    pricing_plans = await query("SELECT * FROM public.pricing_plans");
    coupons = await query("SELECT * FROM public.coupons");
    coupon_uses = await query("SELECT * FROM public.coupon_uses");
    payment_history = await query("SELECT * FROM public.payment_history");
    company_subscriptions = await query("SELECT * FROM public.company_subscriptions");
    
    // Inventory tables backup
    inv_locations = await query("SELECT * FROM public.inventory_locations");
    inv_financial_years = await query("SELECT * FROM public.inventory_financial_years");
    inv_items = await query("SELECT * FROM public.inventory_items");
    inv_txn_headers = await query("SELECT * FROM public.inventory_transaction_headers");
    inv_txn_details = await query("SELECT * FROM public.inventory_transaction_details");
    inv_balances = await query("SELECT * FROM public.inventory_balances");
    inv_transaction_types = await query("SELECT * FROM public.inventory_transaction_types");
  } else {
    // Company backup: only rows that belong to this org
    company = await query("SELECT * FROM public.company WHERE orgcode = $1", [orgcode]);
    users = await query(
      "SELECT * FROM public.users WHERE orgcode = $1 AND (issuperadmin = false OR issuperadmin IS NULL)",
      [orgcode]
    );
    payments = await query("SELECT * FROM public.payments WHERE orgcode = $1", [orgcode]);
    slips = await query("SELECT * FROM public.slips WHERE orgcode = $1", [orgcode]);
    slipitems = await query(
      "SELECT * FROM public.slipitems WHERE id IN (SELECT id FROM public.slips WHERE orgcode = $1)",
      [orgcode]
    );
    audit_logs = await query("SELECT * FROM public.audit_logs WHERE orgcode = $1", [orgcode]);
    
    // Inventory tables backup
    inv_locations = await query("SELECT * FROM public.inventory_locations WHERE orgcode = $1", [orgcode]);
    inv_financial_years = await query("SELECT * FROM public.inventory_financial_years WHERE orgcode = $1", [orgcode]);
    inv_items = await query("SELECT * FROM public.inventory_items WHERE orgcode = $1", [orgcode]);
    inv_txn_headers = await query("SELECT * FROM public.inventory_transaction_headers WHERE orgcode = $1", [orgcode]);
    inv_txn_details = await query(`
      SELECT * FROM public.inventory_transaction_details 
      WHERE transaction_header_id IN (
        SELECT id FROM public.inventory_transaction_headers WHERE orgcode = $1
      )
    `, [orgcode]);
    inv_balances = await query("SELECT * FROM public.inventory_balances WHERE orgcode = $1", [orgcode]);
    inv_transaction_types = await query("SELECT * FROM public.inventory_transaction_types WHERE orgcode = $1", [orgcode]);
  }

  // Build Zip
  const zip = new AdmZip();
  zip.addFile("company.json", Buffer.from(JSON.stringify(company.rows)));

  if (actualIsSuperAdmin) {
    zip.addFile("users.json", Buffer.from(JSON.stringify(users.rows)));
  } else {
    // Strip issuperadmin column from normal company backups
    const strippedUsers = users.rows.map(({ issuperadmin, ...rest }: any) => rest);
    zip.addFile("users.json", Buffer.from(JSON.stringify(strippedUsers)));
  }

  if (!actualIsSuperAdmin) {
    zip.addFile("payments.json", Buffer.from(JSON.stringify(payments.rows)));
    zip.addFile("slips.json", Buffer.from(JSON.stringify(slips.rows)));
    zip.addFile("slipitems.json", Buffer.from(JSON.stringify(slipitems.rows)));
  }

  zip.addFile("audit_logs.json", Buffer.from(JSON.stringify(audit_logs.rows)));

  // Write inventory JSONs to backup zip
  zip.addFile("inventory_locations.json", Buffer.from(JSON.stringify(inv_locations.rows)));
  zip.addFile("inventory_financial_years.json", Buffer.from(JSON.stringify(inv_financial_years.rows)));
  zip.addFile("inventory_items.json", Buffer.from(JSON.stringify(inv_items.rows)));
  zip.addFile("inventory_transaction_headers.json", Buffer.from(JSON.stringify(inv_txn_headers.rows)));
  zip.addFile("inventory_transaction_details.json", Buffer.from(JSON.stringify(inv_txn_details.rows)));
  zip.addFile("inventory_balances.json", Buffer.from(JSON.stringify(inv_balances.rows)));
  zip.addFile("inventory_transaction_types.json", Buffer.from(JSON.stringify(inv_transaction_types.rows)));

  if (actualIsSuperAdmin) {
    zip.addFile("pricing_plans.json", Buffer.from(JSON.stringify(pricing_plans.rows)));
    zip.addFile("coupons.json", Buffer.from(JSON.stringify(coupons.rows)));
    zip.addFile("coupon_uses.json", Buffer.from(JSON.stringify(coupon_uses.rows)));
    zip.addFile("payment_history.json", Buffer.from(JSON.stringify(payment_history.rows)));
    zip.addFile("company_subscriptions.json", Buffer.from(JSON.stringify(company_subscriptions.rows)));
  }

  const zipBuffer = zip.toBuffer();

  const backupPassword = company.rows[0]?.backup_password;
  if (backupPassword && backupPassword.trim()) {
    return encryptBuffer(zipBuffer, backupPassword.trim());
  }

  return zipBuffer;
}

