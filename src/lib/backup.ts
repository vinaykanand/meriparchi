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

  const actualIsSuperAdmin = isSuperAdmin || orgcode === "SUPER";

  if (actualIsSuperAdmin) {
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
  } else {
    company = await query("SELECT * FROM public.company WHERE orgcode = $1", [orgcode]);
    users = await query("SELECT * FROM public.users WHERE orgcode = $1 AND (issuperadmin = false OR issuperadmin IS NULL)", [orgcode]);
    payments = await query("SELECT * FROM public.payments WHERE orgcode = $1", [orgcode]);
    slips = await query("SELECT * FROM public.slips WHERE orgcode = $1", [orgcode]);
    slipitems = await query(
      "SELECT * FROM public.slipitems WHERE id IN (SELECT id FROM public.slips WHERE orgcode = $1)",
      [orgcode]
    );
    audit_logs = await query("SELECT * FROM public.audit_logs WHERE orgcode = $1", [orgcode]);
  }

  // Create Zip file
  const zip = new AdmZip();
  zip.addFile("company.json", Buffer.from(JSON.stringify(company.rows, null, 2)));
  
  if (actualIsSuperAdmin) {
    zip.addFile("users.json", Buffer.from(JSON.stringify(users.rows, null, 2)));
  } else {
    // Strip issuperadmin column from normal company backups
    const strippedUsers = users.rows.map(({ issuperadmin, ...rest }: any) => rest);
    zip.addFile("users.json", Buffer.from(JSON.stringify(strippedUsers, null, 2)));
  }

  if (!actualIsSuperAdmin) {
    zip.addFile("payments.json", Buffer.from(JSON.stringify(payments.rows, null, 2)));
    zip.addFile("slips.json", Buffer.from(JSON.stringify(slips.rows, null, 2)));
    zip.addFile("slipitems.json", Buffer.from(JSON.stringify(slipitems.rows, null, 2)));
  }
  zip.addFile("audit_logs.json", Buffer.from(JSON.stringify(audit_logs.rows, null, 2)));

  if (actualIsSuperAdmin) {
    zip.addFile("pricing_plans.json", Buffer.from(JSON.stringify(pricing_plans.rows, null, 2)));
    zip.addFile("coupons.json", Buffer.from(JSON.stringify(coupons.rows, null, 2)));
    zip.addFile("coupon_uses.json", Buffer.from(JSON.stringify(coupon_uses.rows, null, 2)));
    zip.addFile("payment_history.json", Buffer.from(JSON.stringify(payment_history.rows, null, 2)));
    zip.addFile("company_subscriptions.json", Buffer.from(JSON.stringify(company_subscriptions.rows, null, 2)));
  }

  const zipBuffer = zip.toBuffer();

  const backupPassword = company.rows[0]?.backup_password;
  if (backupPassword && backupPassword.trim()) {
    return encryptBuffer(zipBuffer, backupPassword.trim());
  }

  return zipBuffer;
}
