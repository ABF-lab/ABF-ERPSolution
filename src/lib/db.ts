import { sql } from "@vercel/postgres";

export interface DonationRow {
  id: number;
  receiptNumber: string;
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

export interface InsertDonationInput {
  paymentId: string;
  orderId: string;
  amountInr: number;
  donorName: string;
  donorEmail: string;
  donorPhone?: string;
  donorPan?: string;
  donorAddress?: string;
  donatedAt: Date;
}

/** Indian fiscal year label, e.g. "2025-26" for any date between 1 Apr 2025 and 31 Mar 2026. */
function fiscalYearLabel(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-indexed; April = 3
  const startYear = m >= 3 ? y : y - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

/**
 * Create the schema if it doesn't exist. Safe to run multiple times (idempotent).
 * Called by /api/admin/init-db once at setup.
 */
export async function initSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS donations (
      id SERIAL PRIMARY KEY,
      receipt_number TEXT UNIQUE NOT NULL,
      payment_id TEXT UNIQUE NOT NULL,
      order_id TEXT NOT NULL,
      amount_inr NUMERIC NOT NULL,
      donor_name TEXT NOT NULL,
      donor_email TEXT NOT NULL,
      donor_phone TEXT,
      donor_pan TEXT,
      donor_address TEXT,
      donated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_donations_donated_at ON donations(donated_at DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS receipt_counters (
      fiscal_year TEXT PRIMARY KEY,
      last_number INT NOT NULL DEFAULT 0
    )
  `;
}

/**
 * Atomically reserve the next receipt number for the given fiscal year.
 * Returns e.g. "ABF/2025-26/0001".
 *
 * Race-safe via the ON CONFLICT … RETURNING pattern (single SQL statement,
 * Postgres serializes the update on the row's lock).
 */
async function nextReceiptNumber(date: Date): Promise<string> {
  const fy = fiscalYearLabel(date);
  const { rows } = await sql<{ last_number: number }>`
    INSERT INTO receipt_counters (fiscal_year, last_number)
    VALUES (${fy}, 1)
    ON CONFLICT (fiscal_year)
    DO UPDATE SET last_number = receipt_counters.last_number + 1
    RETURNING last_number
  `;
  const n = rows[0].last_number;
  return `ABF/${fy}/${String(n).padStart(4, "0")}`;
}

/** Insert a donation row, atomically assigning a receipt number. */
export async function insertDonation(
  input: InsertDonationInput
): Promise<{ receiptNumber: string }> {
  // If we already have a row for this paymentId, return the existing receipt
  // number (idempotent in case Razorpay calls verify twice).
  const existing = await sql<{ receipt_number: string }>`
    SELECT receipt_number FROM donations WHERE payment_id = ${input.paymentId} LIMIT 1
  `;
  if (existing.rows.length > 0) {
    return { receiptNumber: existing.rows[0].receipt_number };
  }

  const receiptNumber = await nextReceiptNumber(input.donatedAt);
  await sql`
    INSERT INTO donations (
      receipt_number, payment_id, order_id, amount_inr,
      donor_name, donor_email, donor_phone, donor_pan, donor_address,
      donated_at
    ) VALUES (
      ${receiptNumber}, ${input.paymentId}, ${input.orderId}, ${input.amountInr},
      ${input.donorName}, ${input.donorEmail}, ${input.donorPhone || null},
      ${input.donorPan || null}, ${input.donorAddress || null},
      ${input.donatedAt.toISOString()}
    )
  `;
  return { receiptNumber };
}

/** Manually insert a donation with a specific receipt number — used by admin recovery flow. */
export async function manualInsertDonation(
  input: InsertDonationInput & { receiptNumber: string }
): Promise<void> {
  await sql`
    INSERT INTO donations (
      receipt_number, payment_id, order_id, amount_inr,
      donor_name, donor_email, donor_phone, donor_pan, donor_address,
      donated_at
    ) VALUES (
      ${input.receiptNumber}, ${input.paymentId}, ${input.orderId}, ${input.amountInr},
      ${input.donorName}, ${input.donorEmail}, ${input.donorPhone || null},
      ${input.donorPan || null}, ${input.donorAddress || null},
      ${input.donatedAt.toISOString()}
    )
  `;
}

/** Fetch all donations, newest first. */
export async function listDonations(): Promise<DonationRow[]> {
  const { rows } = await sql<{
    id: number;
    receipt_number: string;
    payment_id: string;
    order_id: string;
    amount_inr: string;
    donor_name: string;
    donor_email: string;
    donor_phone: string | null;
    donor_pan: string | null;
    donor_address: string | null;
    donated_at: Date;
  }>`
    SELECT id, receipt_number, payment_id, order_id, amount_inr,
           donor_name, donor_email, donor_phone, donor_pan, donor_address,
           donated_at
    FROM donations
    ORDER BY donated_at DESC, id DESC
  `;
  return rows.map(toDonationRow);
}

/** Find one donation by paymentId. */
export async function findDonationByPaymentId(
  paymentId: string
): Promise<DonationRow | null> {
  const { rows } = await sql`
    SELECT id, receipt_number, payment_id, order_id, amount_inr,
           donor_name, donor_email, donor_phone, donor_pan, donor_address,
           donated_at
    FROM donations
    WHERE payment_id = ${paymentId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return toDonationRow(rows[0] as Record<string, unknown>);
}

function toDonationRow(r: Record<string, unknown>): DonationRow {
  return {
    id: Number(r.id),
    receiptNumber: String(r.receipt_number),
    paymentId: String(r.payment_id),
    orderId: String(r.order_id),
    amountInr: Number(r.amount_inr),
    donorName: String(r.donor_name),
    donorEmail: String(r.donor_email),
    donorPhone: r.donor_phone ? String(r.donor_phone) : undefined,
    donorPan: r.donor_pan ? String(r.donor_pan) : undefined,
    donorAddress: r.donor_address ? String(r.donor_address) : undefined,
    donatedAt: (r.donated_at instanceof Date
      ? r.donated_at
      : new Date(String(r.donated_at))
    ).toISOString(),
  };
}
