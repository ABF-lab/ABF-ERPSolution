import type { APIRoute } from "astro";
import { razorpayClient } from "../../../lib/razorpay";
import { normaliseCategory } from "../../../lib/db";

export const prerender = false;

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

    // Validate PAN-required threshold (≥ ₹2000 → PAN mandatory under Section 80G)
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

    const order = await razorpayClient().orders.create({
      amount: Math.round(amountInr * 100), // paise
      currency: "INR",
      receipt: `abf_${Date.now()}`,
      notes: {
        donorName: name,
        donorEmail: email,
        donorPhone: String(body.donorPhone || ""),
        donorPan: pan,
        donorAddress: String(body.donorAddress || ""),
        donorCategory,
      },
    });

    return json({
      ok: true,
      orderId: order.id,
      amountInr,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("create-order error:", err);
    return json({ error: err instanceof Error ? err.message : "Server error" }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
