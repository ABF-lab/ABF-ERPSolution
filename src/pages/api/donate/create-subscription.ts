import type { APIRoute } from "astro";
import { razorpayClient } from "../../../lib/razorpay";
import { findCachedPlanId, cachePlanId, normaliseCategory, normaliseFrequency, type Frequency } from "../../../lib/db";

export const prerender = false;

const FREQUENCY_CONFIG: Record<Frequency, { period: "monthly" | "yearly"; interval: number; totalCount: number }> = {
  monthly:   { period: "monthly", interval: 1, totalCount: 240 }, // 20 years
  quarterly: { period: "monthly", interval: 3, totalCount: 80  }, // 20 years
  yearly:    { period: "yearly",  interval: 1, totalCount: 20  }, // 20 years
};

/**
 * Create a Razorpay subscription for the donor.
 *
 * Flow:
 *   1. Validate amount + donor + PAN (same rules as one-off /create-order).
 *   2. Look up cached razorpay_plan_id for (amount, frequency); if missing, create
 *      it via Razorpay's plans API and cache it.
 *   3. Create the subscription with donor info in `notes` so the webhook can
 *      reconstruct the donor on each charge.
 *   4. Return subscription_id for the frontend to feed Razorpay Checkout.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const amountInr = Number(body.amountInr);

    if (!Number.isFinite(amountInr) || amountInr < 100) {
      return json({ error: "Minimum donation is ₹100" }, 400);
    }
    if (amountInr > 1_00_00_000) {
      return json({ error: "Amount too large — please contact us directly for large donations" }, 400);
    }

    const frequency = normaliseFrequency(body.frequency);
    if (!frequency) {
      return json({ error: "Invalid frequency. Pick monthly, quarterly, or yearly." }, 400);
    }

    const pan = (body.donorPan || "").toUpperCase().trim();
    if (amountInr >= 2000 && !pan) {
      return json({ error: "PAN is required for donations of ₹2,000 or more (per 80G regulations)" }, 400);
    }
    if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
      return json({ error: "PAN format invalid (expected: ABCDE1234F)" }, 400);
    }

    const name = String(body.donorName || "").trim();
    const email = String(body.donorEmail || "").trim();
    if (!name || name.length < 2) return json({ error: "Please enter your name" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Please enter a valid email" }, 400);

    const donorCategory = normaliseCategory(body.donorCategory);
    const cfg = FREQUENCY_CONFIG[frequency];
    const client = razorpayClient();

    // Resolve plan_id (cached → reused; otherwise create + cache).
    let planId = await findCachedPlanId(amountInr, frequency);
    if (!planId) {
      const plan = await client.plans.create({
        period: cfg.period,
        interval: cfg.interval,
        item: {
          name: `ABF ${frequency} ₹${amountInr}`,
          amount: Math.round(amountInr * 100),
          currency: "INR",
          description: `Recurring donation to Active Bengaluru Foundation (${frequency})`,
        },
      });
      planId = plan.id;
      await cachePlanId(planId, amountInr, frequency);
    }

    // Donor metadata travels in `notes` — the webhook reads it back per charge.
    // Razorpay enforces a max-15 keys / max-256 chars-per-value limit on notes.
    const subscription = await client.subscriptions.create({
      plan_id: planId,
      total_count: cfg.totalCount,
      customer_notify: 1,
      notes: {
        donorName: name.slice(0, 256),
        donorEmail: email.slice(0, 256),
        donorPhone: String(body.donorPhone || "").slice(0, 256),
        donorPan: pan,
        donorAddress: String(body.donorAddress || "").slice(0, 256),
        donorCategory,
        frequency,
      },
    });

    return json({
      ok: true,
      subscriptionId: subscription.id,
      amountInr,
      frequency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("create-subscription error:", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return json({ error: msg }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
