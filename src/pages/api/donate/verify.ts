import type { APIRoute } from "astro";
import { razorpayClient, verifyPaymentSignature, verifySubscriptionSignature } from "../../../lib/razorpay";
import { generateReceiptPdf, type FrequencyLabel } from "../../../lib/receipt";
import { sendDonorReceipt } from "../../../lib/email";
import {
  insertDonation,
  insertSubscription,
  normaliseCategory,
  normaliseFrequency,
  type Frequency,
} from "../../../lib/db";

export const prerender = false;

const FREQUENCY_TOTAL_COUNT: Record<Frequency, number> = {
  monthly: 240,
  quarterly: 80,
  yearly: 20,
};

/**
 * Verify a Razorpay Checkout response. Two payload shapes are accepted:
 *
 * One-off (Razorpay Orders):
 *   { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * Recurring (Razorpay Subscriptions):
 *   { razorpay_subscription_id, razorpay_payment_id, razorpay_signature }
 *
 * For one-off we generate the receipt PDF + email here synchronously.
 * For subscriptions we also process the first charge optimistically — the
 * webhook will fire shortly after for the same payment_id but `insertDonation`
 * is idempotent on payment_id, so duplicate processing is impossible.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const paymentId = String(body.razorpay_payment_id || "");
    const signature = String(body.razorpay_signature || "");
    const orderId = String(body.razorpay_order_id || "");
    const subscriptionId = String(body.razorpay_subscription_id || "");

    if (!paymentId || !signature || (!orderId && !subscriptionId)) {
      return json({ error: "Missing payment details" }, 400);
    }

    if (subscriptionId) {
      return await verifySubscriptionPath({ subscriptionId, paymentId, signature });
    }
    return await verifyOrderPath({ orderId, paymentId, signature });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : undefined;
    console.error("verify error:", { message: errMsg, stack: errStack });
    return json({
      error: `Server error during verify: ${errMsg}`,
      // safe to expose: helps you/admin diagnose without re-running prod
      stack: errStack ? errStack.split("\n").slice(0, 6).join(" | ") : undefined,
    }, 500);
  }
};

async function verifyOrderPath(opts: { orderId: string; paymentId: string; signature: string }) {
  if (!verifyPaymentSignature(opts)) {
    return json({ error: "Payment signature mismatch — possible tampering" }, 400);
  }
  const order = await razorpayClient().orders.fetch(opts.orderId);
  const notes = (order.notes || {}) as Record<string, string>;
  const amountInr = Number(order.amount) / 100;

  const donor = {
    name: notes.donorName || "Donor",
    email: notes.donorEmail || "",
    phone: notes.donorPhone || undefined,
    pan: notes.donorPan || undefined,
    address: notes.donorAddress || undefined,
  };
  const donorCategory = normaliseCategory(notes.donorCategory);
  if (!donor.email) return json({ error: "Donor email missing from order" }, 500);

  const donatedAt = new Date();
  const { receiptNumber, isNew } = await insertDonation({
    paymentId: opts.paymentId,
    orderId: opts.orderId,
    amountInr,
    donorName: donor.name,
    donorEmail: donor.email,
    donorPhone: donor.phone,
    donorPan: donor.pan,
    donorAddress: donor.address,
    donorCategory,
    donatedAt,
  });

  let emailError: string | undefined;
  if (isNew) {
    const r = await sendReceipt({
      receiptNumber, donatedAt, donor, amountInr,
      paymentId: opts.paymentId, donorCategory,
    });
    if (!r.ok) emailError = r.error;
  }

  return json({
    ok: true,
    receiptNumber,
    paymentId: opts.paymentId,
    amountInr,
    donorEmail: donor.email,
    donorName: donor.name,
    emailError,
  });
}

async function verifySubscriptionPath(opts: {
  subscriptionId: string;
  paymentId: string;
  signature: string;
}) {
  if (!verifySubscriptionSignature(opts)) {
    return json({ error: "Subscription signature mismatch — possible tampering" }, 400);
  }
  const client = razorpayClient();
  const sub = await client.subscriptions.fetch(opts.subscriptionId);
  const notes = (sub.notes || {}) as Record<string, string>;

  const donor = {
    name: notes.donorName || "Donor",
    email: notes.donorEmail || "",
    phone: notes.donorPhone || undefined,
    pan: notes.donorPan || undefined,
    address: notes.donorAddress || undefined,
  };
  const donorCategory = normaliseCategory(notes.donorCategory);
  const frequency = (normaliseFrequency(notes.frequency) || "monthly") as Frequency;
  if (!donor.email) return json({ error: "Donor email missing from subscription" }, 500);

  // Plan amount lives on the plan, not the subscription — fetch it.
  const plan = await client.plans.fetch(String(sub.plan_id));
  const amountInr = Number((plan.item as { amount?: number }).amount || 0) / 100;

  // Persist the subscription row idempotently (matches by razorpay_subscription_id).
  await insertSubscription({
    razorpaySubscriptionId: sub.id,
    razorpayPlanId: String(sub.plan_id),
    donorName: donor.name,
    donorEmail: donor.email,
    donorPhone: donor.phone,
    donorPan: donor.pan,
    donorAddress: donor.address,
    donorCategory,
    amountInr,
    frequency,
    totalCount: Number(sub.total_count || FREQUENCY_TOTAL_COUNT[frequency]),
    status: "active",
  });

  // Process the first charge optimistically. `insertDonation` is idempotent on
  // payment_id, so the webhook firing later for the same charge is a no-op.
  const donatedAt = new Date();
  const { receiptNumber, isNew } = await insertDonation({
    paymentId: opts.paymentId,
    orderId: opts.subscriptionId, // we don't have an order_id for subs; reuse subId
    amountInr,
    donorName: donor.name,
    donorEmail: donor.email,
    donorPhone: donor.phone,
    donorPan: donor.pan,
    donorAddress: donor.address,
    donorCategory,
    subscriptionId: sub.id,
    donatedAt,
  });

  let emailError: string | undefined;
  if (isNew) {
    const r = await sendReceipt({
      receiptNumber, donatedAt, donor, amountInr,
      paymentId: opts.paymentId, donorCategory,
      frequencyLabel: frequency as FrequencyLabel,
    });
    if (!r.ok) emailError = r.error;
  }

  return json({
    ok: true,
    receiptNumber,
    paymentId: opts.paymentId,
    amountInr,
    donorEmail: donor.email,
    donorName: donor.name,
    subscription: { id: sub.id, frequency },
    emailError,
  });
}

async function sendReceipt(p: {
  receiptNumber: string;
  donatedAt: Date;
  donor: { name: string; email: string; phone?: string; pan?: string; address?: string };
  amountInr: number;
  paymentId: string;
  donorCategory: ReturnType<typeof normaliseCategory>;
  frequencyLabel?: FrequencyLabel;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateReceiptPdf({
      receiptNumber: p.receiptNumber,
      donatedAt: p.donatedAt,
      donor: p.donor,
      amountInr: p.amountInr,
      paymentId: p.paymentId,
      donorCategory: p.donorCategory,
      frequencyLabel: p.frequencyLabel,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[verify] PDF generation failed:", msg);
    return { ok: false, error: `PDF generation failed: ${msg}` };
  }
  try {
    await sendDonorReceipt({
      donorName: p.donor.name,
      donorEmail: p.donor.email,
      amountInr: p.amountInr,
      receiptNumber: p.receiptNumber,
      paymentId: p.paymentId,
      pdfBuffer,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[verify] donor email failed:", msg);
    return { ok: false, error: msg };
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
