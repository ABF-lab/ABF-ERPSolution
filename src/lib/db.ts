import { createPool } from "@vercel/postgres";

/**
 * Resolve the Postgres connection string from whatever env var Vercel injected.
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

  for (const [name, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (/^postgres(ql)?:\/\//i.test(value)) {
      console.log(`[db] using connection string from env var ${name}`);
      return value;
    }
  }

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

// Tagged-template wrapper
const sql = ((strings: TemplateStringsArray, ...values: any[]) =>
  pool().sql(strings, ...values)) as ReturnType<typeof createPool>["sql"];

export type DonorCategory = "general" | "zakat" | "sadqa" | "interest";
export type PaymentMethod = "online" | "bank" | "upi" | "cash";
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
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  subscriptionId?: string;
  frequency?: Frequency;
  donatedAt: string;
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
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
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
const VALID_PAYMENT_METHODS: ReadonlySet<PaymentMethod> = new Set(["online", "bank", "upi", "cash"]);
const VALID_FREQUENCIES: ReadonlySet<Frequency> = new Set(["monthly", "quarterly", "yearly"]);

export function normaliseCategory(raw: unknown): DonorCategory {
  const v = String(raw || "").toLowerCase().trim();
  return VALID_CATEGORIES.has(v as DonorCategory) ? (v as DonorCategory) : "general";
}

export function normalisePaymentMethod(raw: unknown): PaymentMethod {
  const v = String(raw || "").toLowerCase().trim();
  return VALID_PAYMENT_METHODS.has(v as PaymentMethod) ? (v as PaymentMethod) : "online";
}

export function normaliseFrequency(raw: unknown): Frequency | null {
  const v = String(raw || "").toLowerCase().trim();
  return VALID_FREQUENCIES.has(v as Frequency) ? (v as Frequency) : null;
}

function fiscalYearLabel(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const startYear = m >= 3 ? y : y - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

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
  await sql`
    ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS donor_category TEXT NOT NULL DEFAULT 'general'
  `;
  await sql`
    ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS subscription_id TEXT
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_donations_subscription_id ON donations(subscription_id)`;

  await sql`
    ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'online'
  `;
  await sql`
    ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS payment_reference TEXT
  `;

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

  // --- CASE MANAGEMENT SCHEMA ---
  await sql`
    CREATE TABLE IF NOT EXISTS cases (
      id SERIAL PRIMARY KEY,
      case_number TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      patient_name TEXT NOT NULL,
      gender TEXT,
      age INT,
      entitlements TEXT,
      bpl_status TEXT,
      patient_mobile TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      chief_complaint TEXT NOT NULL,
      attender_name TEXT,
      attender_mobile TEXT,
      attender_relation TEXT,
      history TEXT,
      case_details TEXT,
      suggestions TEXT,
      attachments TEXT,
      case_type TEXT,
      referred TEXT,
      status TEXT NOT NULL DEFAULT 'Open',
      referral_name TEXT,
      referral_number TEXT,
      additional_comments TEXT,
      follow_up_1 TEXT,
      follow_up_2 TEXT,
      follow_up_3 TEXT,
      estimated_cost TEXT,
      actual_spend NUMERIC,
      actual_saved NUMERIC
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC)`;
  
  await sql`
    CREATE TABLE IF NOT EXISTS case_counters (
      year INT PRIMARY KEY,
      last_number INT NOT NULL DEFAULT 0
    )
  `;
}

async function nextCaseNumber(date: Date): Promise<string> {
  const y = date.getFullYear();
  const { rows } = await sql<{ last_number: number }>`
    INSERT INTO case_counters (year, last_number)
    VALUES (${y}, 1)
    ON CONFLICT (year)
    DO UPDATE SET last_number = case_counters.last_number + 1
    RETURNING last_number
  `;
  const n = rows[0].last_number;
  return `ABF/MC/${y}/${String(n).padStart(4, "0")}`;
}

export interface InsertCaseInput {
  patientName: string;
  gender?: string;
  age?: number;
  entitlements?: string;
  bplStatus?: string;
  patientMobile?: string;
  address?: string;
  city?: string;
  state?: string;
  chiefComplaint: string;
  attenderName?: string;
  attenderMobile?: string;
  attenderRelation?: string;
  history?: string;
  caseDetails?: string;
  suggestions?: string;
  attachments?: string;
  caseType?: string;
  referred?: string;
  status?: string;
  referralName?: string;
  referralNumber?: string;
  additionalComments?: string;
  followUp1?: string;
  followUp2?: string;
  followUp3?: string;
  estimatedCost?: string;
  actualSpend?: number;
  actualSaved?: number;
}

export async function insertCase(input: InsertCaseInput): Promise<string> {
  const now = new Date();
  const caseNumber = await nextCaseNumber(now);
  const status = input.status || "Open";
  
  await sql`
    INSERT INTO cases (
      case_number, patient_name, gender, age, entitlements, bpl_status, patient_mobile,
      address, city, state, chief_complaint, attender_name, attender_mobile, attender_relation,
      history, case_details, suggestions, attachments, case_type, referred, status,
      referral_name, referral_number, additional_comments, follow_up_1, follow_up_2, follow_up_3,
      estimated_cost, actual_spend, actual_saved, created_at
    ) VALUES (
      ${caseNumber}, ${input.patientName}, ${input.gender || null}, ${input.age || null},
      ${input.entitlements || null}, ${input.bplStatus || null}, ${input.patientMobile || null},
      ${input.address || null}, ${input.city || null}, ${input.state || null}, ${input.chiefComplaint},
      ${input.attenderName || null}, ${input.attenderMobile || null}, ${input.attenderRelation || null},
      ${input.history || null}, ${input.caseDetails || null}, ${input.suggestions || null},
      ${input.attachments || null}, ${input.caseType || null}, ${input.referred || null}, ${status},
      ${input.referralName || null}, ${input.referralNumber || null}, ${input.additionalComments || null},
      ${input.followUp1 || null}, ${input.followUp2 || null}, ${input.followUp3 || null},
      ${input.estimatedCost || null}, ${input.actualSpend || null}, ${input.actualSaved || null},
      ${now.toISOString()}
    )
  `;
  return caseNumber;
}

export async function listCases(): Promise<any[]> {
  const { rows } = await sql`
    SELECT * FROM cases ORDER BY created_at DESC, id DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    caseNumber: r.case_number,
    createdAt: r.created_at,
    patientName: r.patient_name,
    gender: r.gender,
    age: r.age,
    entitlements: r.entitlements,
    bplStatus: r.bpl_status,
    patientMobile: r.patient_mobile,
    address: r.address,
    city: r.city,
    state: r.state,
    chiefComplaint: r.chief_complaint,
    attenderName: r.attender_name,
    attenderMobile: r.attender_mobile,
    attenderRelation: r.attender_relation,
    history: r.history,
    caseDetails: r.case_details,
    suggestions: r.suggestions,
    attachments: r.attachments,
    caseType: r.case_type,
    referred: r.referred,
    status: r.status,
    referralName: r.referral_name,
    referralNumber: r.referral_number,
    additionalComments: r.additional_comments,
    followUp1: r.follow_up_1,
    followUp2: r.follow_up_2,
    followUp3: r.follow_up_3,
    estimatedCost: r.estimated_cost,
    actualSpend: r.actual_spend ? Number(r.actual_spend) : null,
    actualSaved: r.actual_saved ? Number(r.actual_saved) : null
  }));
}

export async function updateCase(caseNumber: string, updates: Partial<InsertCaseInput>): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];
  let index = 1;

  const mapping: Record<string, string> = {
    patientName: "patient_name",
    gender: "gender",
    age: "age",
    entitlements: "entitlements",
    bplStatus: "bpl_status",
    patientMobile: "patient_mobile",
    address: "address",
    city: "city",
    state: "state",
    chiefComplaint: "chief_complaint",
    attenderName: "attender_name",
    attenderMobile: "attender_mobile",
    attenderRelation: "attender_relation",
    history: "history",
    caseDetails: "case_details",
    suggestions: "suggestions",
    attachments: "attachments",
    caseType: "case_type",
    referred: "referred",
    status: "status",
    referralName: "referral_name",
    referralNumber: "referral_number",
    additionalComments: "additional_comments",
    followUp1: "follow_up_1",
    followUp2: "follow_up_2",
    followUp3: "follow_up_3",
    estimatedCost: "estimated_cost",
    actualSpend: "actual_spend",
    actualSaved: "actual_saved"
  };

  for (const [key, val] of Object.entries(updates)) {
    const dbCol = mapping[key];
    if (dbCol) {
      fields.push(`${dbCol} = $${index}`);
      values.push(val === undefined ? null : val);
      index++;
    }
  }

  if (fields.length === 0) return;

  values.push(caseNumber);
  const query = `UPDATE cases SET ${fields.join(", ")} WHERE case_number = $${index}`;
  await pool().query(query, values);
}

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

export async function insertDonation(
  input: InsertDonationInput
): Promise<{ receiptNumber: string; isNew: boolean }> {
  const existing = await sql<{ receipt_number: string }>`
    SELECT receipt_number FROM donations WHERE payment_id = ${input.paymentId} LIMIT 1
  `;
  if (existing.rows.length > 0) {
    return { receiptNumber: existing.rows[0].receipt_number, isNew: false };
  }

  const receiptNumber = await nextReceiptNumber(input.donatedAt);
  const category = input.donorCategory || "general";
  const method = input.paymentMethod || "online";
  await sql`
    INSERT INTO donations (
      receipt_number, payment_id, order_id, amount_inr,
      donor_name, donor_email, donor_phone, donor_pan, donor_address,
      donor_category, payment_method, payment_reference, subscription_id, donated_at
    ) VALUES (
      ${receiptNumber}, ${input.paymentId}, ${input.orderId}, ${input.amountInr},
      ${input.donorName}, ${input.donorEmail}, ${input.donorPhone || null},
      ${input.donorPan || null}, ${input.donorAddress || null},
      ${category}, ${method}, ${input.paymentReference || null},
      ${input.subscriptionId || null}, ${input.donatedAt.toISOString()}
    )
  `;
  return { receiptNumber, isNew: true };
}

export async function manualInsertDonation(
  input: InsertDonationInput & { receiptNumber: string }
): Promise<void> {
  const category = input.donorCategory || "general";
  const method = input.paymentMethod || "online";
  await sql`
    INSERT INTO donations (
      receipt_number, payment_id, order_id, amount_inr,
      donor_name, donor_email, donor_phone, donor_pan, donor_address,
      donor_category, payment_method, payment_reference, subscription_id, donated_at
    ) VALUES (
      ${input.receiptNumber}, ${input.paymentId}, ${input.orderId}, ${input.amountInr},
      ${input.donorName}, ${input.donorEmail}, ${input.donorPhone || null},
      ${input.donorPan || null}, ${input.donorAddress || null},
      ${category}, ${method}, ${input.paymentReference || null},
      ${input.subscriptionId || null}, ${input.donatedAt.toISOString()}
    )
  `;
}

export async function listDonations(): Promise<DonationRow[]> {
  const { rows } = await sql`
    SELECT d.id, d.receipt_number, d.payment_id, d.order_id, d.amount_inr,
           d.donor_name, d.donor_email, d.donor_phone, d.donor_pan, d.donor_address,
           d.donor_category, d.payment_method, d.payment_reference, d.subscription_id, d.donated_at,
           s.frequency AS frequency
    FROM donations d
    LEFT JOIN subscriptions s ON s.razorpay_subscription_id = d.subscription_id
    ORDER BY d.donated_at DESC, d.id DESC
  `;
  return rows.map((r) => toDonationRow(r as Record<string, unknown>));
}

export async function findDonationByPaymentId(
  paymentId: string
): Promise<DonationRow | null> {
  const { rows } = await sql`
    SELECT id, receipt_number, payment_id, order_id, amount_inr,
           donor_name, donor_email, donor_phone, donor_pan, donor_address,
           donor_category, payment_method, payment_reference, subscription_id, donated_at
    FROM donations
    WHERE payment_id = ${paymentId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return toDonationRow(rows[0] as Record<string, unknown>);
}

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
    paymentMethod: normalisePaymentMethod(r.payment_method),
    paymentReference: r.payment_reference ? String(r.payment_reference) : undefined,
    subscriptionId: r.subscription_id ? String(r.subscription_id) : undefined,
    frequency: r.frequency ? (normaliseFrequency(r.frequency) ?? undefined) : undefined,
    donatedAt: (r.donated_at instanceof Date
      ? r.donated_at
      : new Date(String(r.donated_at))
    ).toISOString(),
  };
}
