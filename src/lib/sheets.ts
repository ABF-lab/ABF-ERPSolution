// Google Sheet append + receipt-number reservation via Google Apps Script webhook.
// The Apps Script (see SETUP.md) exposes a doPost endpoint that:
//   action: "appendDonation" → appends a row, returns assigned receipt number
//   action: "listDonations"  → returns all donations as JSON (for /admin/donations)

export interface DonationLogEntry {
  paymentId: string;
  orderId: string;
  amountInr: number;
  donorName: string;
  donorEmail: string;
  donorPhone?: string;
  donorPan?: string;
  donorAddress?: string;
  donatedAt: string; // ISO
}

export interface AppendResult {
  ok: true;
  receiptNumber: string; // e.g. ABF/2025-26/0042
}

async function callSheet<T>(action: string, payload: unknown): Promise<T> {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!url) throw new Error("GOOGLE_SHEET_WEBHOOK_URL not set");
  const token = process.env.GOOGLE_SHEET_WEBHOOK_TOKEN;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, token, payload }),
  });
  if (!res.ok) throw new Error(`Sheet webhook failed: ${res.status}`);
  const data = (await res.json()) as { ok: boolean; error?: string } & T;
  if (!data.ok) throw new Error(data.error || "Sheet webhook returned not-ok");
  return data;
}

export async function appendDonation(entry: DonationLogEntry): Promise<AppendResult> {
  return callSheet<AppendResult>("appendDonation", entry);
}

export async function listDonations(): Promise<{
  ok: true;
  donations: Array<DonationLogEntry & { receiptNumber: string }>;
}> {
  return callSheet("listDonations", {});
}
