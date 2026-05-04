import type { APIRoute } from "astro";
import { razorpayClient, verifyPaymentSignature } from "../../../lib/razorpay";
import { generateReceiptPdf } from "../../../lib/receipt";
import { sendDonorReceipt } from "../../../lib/email";
import { insertDonation, normaliseCategory } from "../../../lib/db";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const orderId = String(body.razorpay_order_id || "");
    const paymentId = String(body.razorpay_payment_id || "");
    const signature = String(body.razorpay_signature || "");

    if (!orderId || !paymentId || !signature) {
      return json({ error: "Missing payment details" }, 400);
    }

    if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
      return json({ error: "Payment signature mismatch — possible tampering" }, 400);
    }

    // Fetch order from Razorpay to get the trusted notes (donor details)
    const order = await razorpayClient().orders.fetch(orderId);
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

    if (!donor.email) {
      return json({ error: "Donor email missing from order" }, 500);
    }

    // 1. Insert into Postgres — atomically assigns the receipt number
    const donatedAt = new Date();
    const { receiptNumber } = await insertDonation({
      paymentId,
      orderId,
      amountInr,
      donorName: donor.name,
      donorEmail: donor.email,
      donorPhone: donor.phone,
      donorPan: donor.pan,
      donorAddress: donor.address,
      donorCategory,
      donatedAt,
    });

    // 2. Generate receipt PDF
    const pdfBuffer = await generateReceiptPdf({
      receiptNumber,
      donatedAt,
      donor,
      amountInr,
      paymentId,
      donorCategory,
    });

    // 3. Email donor only — donation row + PDF are in DB for the team to access via /admin/donations.
    try {
      await sendDonorReceipt({
        donorName: donor.name,
        donorEmail: donor.email,
        amountInr,
        receiptNumber,
        paymentId,
        pdfBuffer,
      });
    } catch (err) {
      console.error("[verify] donor email failed:", err);
    }

    return json({
      ok: true,
      receiptNumber,
      paymentId,
      amountInr,
      donorEmail: donor.email,
      donorName: donor.name,
    });
  } catch (err) {
    console.error("verify error:", err);
    return json({ error: err instanceof Error ? err.message : "Server error" }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
