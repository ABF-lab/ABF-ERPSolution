import { createPool } from "@vercel/postgres";

/**
 * Resolve the Postgres connection string from whatever env var Vercel injected.
 * Vercel's database integrations name the env vars inconsistently depending on
 * the provider (classic Postgres, Neon Marketplace, Supabase, etc.) and on
 * whether the user picked a "prefix" when connecting.
 *
 * We check known names first, then fall back to scanning every env var for one
 * that looks like a Postgres connection string (`postgres://` or `postgresql://`).
 */
function getConnectionString(): string {
  const candidates = [
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL",
    "NEON_DATABASE_URL",
    "POSTGRES_URL_NO_SSL",
  ];
  for (const name of candidates) {
    const v = process.env[name];
    if (v && v.length > 0) return v;
  }

  // Fallback: scan everything for a postgres-shaped URL (handles prefixed
  // variants like ABF_DONATIONS_DATABASE_URL or PRD_POSTGRES_URL).
  for (const [name, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (/^postgres(ql)?:\/\//i.test(value)) {
      console.log(`[db] using connection string from env var ${name}`);
      return value;
    }
  }

  // Helpful diagnostic: list env var names that *might* be related so the user
  // can spot a typo / wrong project.
  const hint = Object.keys(process.env)
    .filter((k) => /POSTGRES|DATABASE|NEON|SUPABASE/i.test(k))
    .sort();
  throw new Error(
    `No Postgres connection string found. Looked for: ${candidates.join(", ")}. ` +
    `Env vars I CAN see that look related: ${hint.length ? hint.join(", ") : "(none)"}. ` +
    "Check Vercel → Settings → Environment Variables and confirm a Postgres database is connected to THIS project."
  );
}

let _pool: ReturnType<typeof createPool> | null = null;
function pool() {
  if (_pool) return _pool;
  _pool = createPool({ connectionString: getConnectionString() });
  return _pool;
}

// Tagged-template wrapper so the rest of this file reads identically to `sql\`...\``
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sql = ((strings: TemplateStringsArray, ...values: any[]) =>
  pool().sql(strings, ...values)) as ReturnType<typeof createPool>["sql"];

export type DonorCategory = "general" | "zakat" | "sadqa" | "interest";
export type Frequency = "monthly" | "quarterly" | "yearly";
export type SubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "completed"
  | "cancelled"
  | "halted"
  | "pending"
  | "paused";

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
  donorCategory: DonorCategory;
  subscriptionId?: string;
  frequency?: Frequency; // joined from subscriptions when this row is a recurring charge
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
  donorCategory?: DonorCategory;
  subscriptionId?: string;
  donatedAt: Date;
}

export interface SubscriptionRow {
  id: number;
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  donorName: string;
  donorEmail: string;
  donorPhone?: string;
  donorPan?: string;
  donorAddress?: string;
  donorCategory: DonorCategory;
  amountInr: number;
  frequency: Frequency;
  totalCount: number;
  status: SubscriptionStatus;
  startedAt: string;
  cancelledAt?: string;
}

export interface InsertSubscriptionInput {
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  donorName: string;
  donorEmail: string;
  donorPhone?: string;
  donorPan?: string;
  donorAddress?: string;
  donorCategory: DonorCategory;
  amountInr: number;
  frequency: Frequency;
  totalCount: number;
  status?: SubscriptionStatus;
}

const VALID_CATEGORIES: ReadonlySet<DonorCategory> = new Set(["general", "zakat", "sadqa", "interest"]);
const VALID_FREQUENCIES: ReadonlySet<Frequency> = new Set(["monthly", "quarterly", "yearly"]);

/** Coerce any incoming string to a valid DonorCategory; defaults to "general". */
export function normaliseCategory(raw: unknown): DonorCategory {
  const v = String(raw || "").toLowerCase().trim();
  return VALID_CATEGORIES.has(v as DonorCategory) ? (v as DonorCategory) : "general";
}

/** Coerce any incoming string to a valid Frequency, or null if not recurring. */
export function normaliseFrequency(raw: unknown): Frequency | null {
  const v = String(raw || "").toLowerCase().trim();
  return VALID_FREQUENCIES.has(v as Frequency) ? (v as Frequency) : null;
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
  // Migration: donor_category column. Existing rows get 'general'.
  await sql`
    ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS donor_category TEXT NOT NULL DEFAULT 'general'
  `;
  // Migration: subscription_id column links each donation to its parent subscription
  // (NULL for one-off donations).
  await sql`
    ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS subscription_id TEXT
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_donations_subscription_id ON donations(subscription_id)`;

  // Cache of Razorpay plans we've created — one per (amount, frequency) combo.
  await sql`
    CREATE TABLE IF NOT EXISTS razorpay_plans (
      id SERIAL PRIMARY KEY,
      razorpay_plan_id TEXT UNIQUE NOT NULL,
      amount_inr NUMERIC NOT NULL,
      frequency TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (amount_inr, frequency)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      razorpay_subscription_id TEXT UNIQUE NOT NULL,
      razorpay_plan_id TEXT NOT NULL,
      donor_name TEXT NOT NULL,
      donor_email TEXT NOT NULL,
      donor_phone TEXT,
      donor_pan TEXT,
      donor_address TEXT,
      donor_category TEXT NOT NULL DEFAULT 'general',
      amount_inr NUMERIC NOT NULL,
      frequency TEXT NOT NULL,
      total_count INT NOT NULL,
      status TEXT NOT NULL DEFAULT 'created',
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cancelled_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(donor_email)`;
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

/**
 * Insert a donation row, atomically assigning a receipt number.
 * Returns `isNew: false` if a row already existed for this paymentId — the caller
 * can then skip duplicate work (PDF + email) when re-entered via webhook + verify.
 */
export async function insertDonation(
  input: InsertDonationInput
): Promise<{ receiptNumber: string; isNew: boolean }> {
  // If we already have a row for this paymentId, return the existing receipt
  // number (idempotent in case Razorpay calls verify twice or webhook + verify both run).
  const existing = await sql<{ receipt_number: string }>`
    SELECT receipt_number FROM donations WHERE payment_id = ${input.paymentId} LIMIT 1
  `;
  if (existing.rows.length > 0) {
    return { receiptNumber: existing.rows[0].receipt_number, isNew: false };
  }

  const receiptNumber = await nextReceiptNumber(input.donatedAt);
  const category = input.donorCategory || "general";
  await sql`
    INSERT INTO donations (
      receipt_number, payment_id, order_id, amount_inr,
      donor_name, donor_email, donor_phone, donor_pan, donor_address,
      donor_category, subscription_id, donated_at
    ) VALUES (
      ${receiptNumber}, ${input.paymentId}, ${input.orderId}, ${input.amountInr},
      ${input.donorName}, ${input.donorEmail}, ${input.donorPhone || null},
      ${input.donorPan || null}, ${input.donorAddress || null},
      ${category}, ${input.subscriptionId || null}, ${input.donatedAt.toISOString()}
    )
  `;
  return { receiptNumber, isNew: true };
}

/** Manually insert a donation with a specific receipt number — used by admin recovery flow. */
export async function manualInsertDonation(
  input: InsertDonationInput & { receiptNumber: string }
): Promise<void> {
  const category = input.donorCategory || "general";
  await sql`
    INSERT INTO donations (
      receipt_number, payment_id, order_id, amount_inr,
      donor_name, donor_email, donor_phone, donor_pan, donor_address,
      donor_category, subscription_id, donated_at
    ) VALUES (
      ${input.receiptNumber}, ${input.paymentId}, ${input.orderId}, ${input.amountInr},
      ${input.donorName}, ${input.donorEmail}, ${input.donorPhone || null},
      ${input.donorPan || null}, ${input.donorAddress || null},
      ${category}, ${input.subscriptionId || null}, ${input.donatedAt.toISOString()}
    )
  `;
}

/** Fetch all donations, newest first. Joins subscriptions to surface frequency on recurring charges. */
export async function listDonations(): Promise<DonationRow[]> {
  const { rows } = await sql`
    SELECT d.id, d.receipt_number, d.payment_id, d.order_id, d.amount_inr,
           d.donor_name, d.donor_email, d.donor_phone, d.donor_pan, d.donor_address,
           d.donor_category, d.subscription_id, d.donated_at,
           s.frequency AS frequency
    FROM donations d
    LEFT JOIN subscriptions s ON s.razorpay_subscription_id = d.subscription_id
    ORDER BY d.donated_at DESC, d.id DESC
  `;
  return rows.map((r) => toDonationRow(r as Record<string, unknown>));
}

/** Find one donation by paymentId. */
export async function findDonationByPaymentId(
  paymentId: string
): Promise<DonationRow | null> {
  const { rows } = await sql`
    SELECT id, receipt_number, payment_id, order_id, amount_inr,
           donor_name, donor_email, donor_phone, donor_pan, donor_address,
           donor_category, subscription_id, donated_at
    FROM donations
    WHERE payment_id = ${paymentId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return toDonationRow(rows[0] as Record<string, unknown>);
}

/* ============================================================
 *                        SUBSCRIPTIONS
 * ============================================================ */

/**
 * Get a cached Razorpay plan_id for (amount, frequency), or null if we haven't
 * created one yet. Caller is responsible for creating + caching when null.
 */
export async function findCachedPlanId(
  amountInr: number,
  frequency: Frequency
): Promise<string | null> {
  const { rows } = await sql<{ razorpay_plan_id: string }>`
    SELECT razorpay_plan_id FROM razorpay_plans
    WHERE amount_inr = ${amountInr} AND frequency = ${frequency}
    LIMIT 1
  `;
  return rows.length > 0 ? rows[0].razorpay_plan_id : null;
}

/** Cache a freshly-created Razorpay plan_id for future lookups. */
export async function cachePlanId(
  razorpayPlanId: string,
  amountInr: number,
  frequency: Frequency
): Promise<void> {
  await sql`
    INSERT INTO razorpay_plans (razorpay_plan_id, amount_inr, frequency)
    VALUES (${razorpayPlanId}, ${amountInr}, ${frequency})
    ON CONFLICT (amount_inr, frequency) DO NOTHING
  `;
}

/** Insert a subscription row. Idempotent on razorpay_subscription_id. */
export async function insertSubscription(input: InsertSubscriptionInput): Promise<void> {
  await sql`
    INSERT INTO subscriptions (
      razorpay_subscription_id, razorpay_plan_id,
      donor_name, donor_email, donor_phone, donor_pan, donor_address, donor_category,
      amount_inr, frequency, total_count, status
    ) VALUES (
      ${input.razorpaySubscriptionId}, ${input.razorpayPlanId},
      ${input.donorName}, ${input.donorEmail}, ${input.donorPhone || null},
      ${input.donorPan || null}, ${input.donorAddress || null}, ${input.donorCategory},
      ${input.amountInr}, ${input.frequency}, ${input.totalCount}, ${input.status || "created"}
    )
    ON CONFLICT (razorpay_subscription_id) DO NOTHING
  `;
}

/** Find a subscription by Razorpay's subscription_id. */
export async function findSubscriptionByRazorpayId(
  razorpaySubscriptionId: string
): Promise<SubscriptionRow | null> {
  const { rows } = await sql`
    SELECT id, razorpay_subscription_id, razorpay_plan_id,
           donor_name, donor_email, donor_phone, donor_pan, donor_address, donor_category,
           amount_inr, frequency, total_count, status, started_at, cancelled_at
    FROM subscriptions
    WHERE razorpay_subscription_id = ${razorpaySubscriptionId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return toSubscriptionRow(rows[0] as Record<string, unknown>);
}

/** Update a subscription's status. Sets cancelled_at when the new status indicates termination. */
export async function updateSubscriptionStatus(
  razorpaySubscriptionId: string,
  status: SubscriptionStatus
): Promise<void> {
  const isTerminal = status === "cancelled" || status === "completed" || status === "halted";
  if (isTerminal) {
    await sql`
      UPDATE subscriptions
      SET status = ${status}, cancelled_at = COALESCE(cancelled_at, NOW())
      WHERE razorpay_subscription_id = ${razorpaySubscriptionId}
    `;
  } else {
    await sql`
      UPDATE subscriptions
      SET status = ${status}
      WHERE razorpay_subscription_id = ${razorpaySubscriptionId}
    `;
  }
}

function toSubscriptionRow(r: Record<string, unknown>): SubscriptionRow {
  return {
    id: Number(r.id),
    razorpaySubscriptionId: String(r.razorpay_subscription_id),
    razorpayPlanId: String(r.razorpay_plan_id),
    donorName: String(r.donor_name),
    donorEmail: String(r.donor_email),
    donorPhone: r.donor_phone ? String(r.donor_phone) : undefined,
    donorPan: r.donor_pan ? String(r.donor_pan) : undefined,
    donorAddress: r.donor_address ? String(r.donor_address) : undefined,
    donorCategory: normaliseCategory(r.donor_category),
    amountInr: Number(r.amount_inr),
    frequency: (normaliseFrequency(r.frequency) || "monthly") as Frequency,
    totalCount: Number(r.total_count),
    status: String(r.status) as SubscriptionStatus,
    startedAt: (r.started_at instanceof Date ? r.started_at : new Date(String(r.started_at))).toISOString(),
    cancelledAt: r.cancelled_at
      ? (r.cancelled_at instanceof Date ? r.cancelled_at : new Date(String(r.cancelled_at))).toISOString()
      : undefined,
  };
}

/** Delete a donation row by paymentId. Returns the number of rows deleted (0 or 1). */
export async function deleteDonationByPaymentId(paymentId: string): Promise<number> {
  const result = await sql`DELETE FROM donations WHERE payment_id = ${paymentId}`;
  return result.rowCount ?? 0;
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
    donorCategory: normaliseCategory(r.donor_category),
    subscriptionId: r.subscription_id ? String(r.subscription_id) : undefined,
    frequency: r.frequency ? (normaliseFrequency(r.frequency) ?? undefined) : undefined,
    donatedAt: (r.donated_at instanceof Date
      ? r.donated_at
      : new Date(String(r.donated_at))
    ).toISOString(),
  };
}
