import { query } from "@/lib/db";
import AdmZip from "adm-zip";

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

  return zip.toBuffer();
}
