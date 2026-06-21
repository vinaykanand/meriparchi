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

export async function generateBackupZip(orgcode: string): Promise<Buffer> {
  // Fetch data from all company-related tables
  const company = await query("SELECT * FROM public.company WHERE orgcode = $1", [orgcode]);
  const users = await query("SELECT * FROM public.users WHERE orgcode = $1", [orgcode]);
  const payments = await query("SELECT * FROM public.payments WHERE orgcode = $1", [orgcode]);
  const slips = await query("SELECT * FROM public.slips WHERE orgcode = $1", [orgcode]);
  const slipitems = await query(
    "SELECT * FROM public.slipitems WHERE id IN (SELECT id FROM public.slips WHERE orgcode = $1)",
    [orgcode]
  );
  const audit_logs = await query("SELECT * FROM public.audit_logs WHERE orgcode = $1", [orgcode]);

  // Create Zip file
  const zip = new AdmZip();
  zip.addFile("company.json", Buffer.from(JSON.stringify(company.rows, null, 2)));
  zip.addFile("users.json", Buffer.from(JSON.stringify(users.rows, null, 2)));
  zip.addFile("payments.json", Buffer.from(JSON.stringify(payments.rows, null, 2)));
  zip.addFile("slips.json", Buffer.from(JSON.stringify(slips.rows, null, 2)));
  zip.addFile("slipitems.json", Buffer.from(JSON.stringify(slipitems.rows, null, 2)));
  zip.addFile("audit_logs.json", Buffer.from(JSON.stringify(audit_logs.rows, null, 2)));

  const zipBuffer = zip.toBuffer();

  const backupPassword = company.rows[0]?.backup_password;
  if (backupPassword && backupPassword.trim()) {
    return encryptBuffer(zipBuffer, backupPassword.trim());
  }

  return zipBuffer;
}
