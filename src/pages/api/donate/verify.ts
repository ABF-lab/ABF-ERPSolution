import type { APIRoute } from "astro";
import { razorpayClient, verifyPaymentSignature } from "../../../lib/razorpay";
import { generateReceiptPdf } from "../../../lib/receipt";
import { sendDonorReceipt, sendFinanceNotification } from "../../../lib/email";
import { appendDonation } from "../../../lib/sheets";

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

    if (!donor.email) {
      return json({ error: "Donor email missing from order" }, 500);
    }

    // 1. Append to Google Sheet — this also assigns the receipt number
    const donatedAt = new Date();
    const sheetResult = await appendDonation({
      paymentId,
      orderId,
      amountInr,
      donorName: donor.name,
      donorEmail: donor.email,
      donorPhone: donor.phone,
      donorPan: donor.pan,
      donorAddress: donor.address,
      donatedAt: donatedAt.toISOString(),
    });
    const receiptNumber = sheetResult.receiptNumber;

    // 2. Generate receipt PDF
    const pdfBuffer = await generateReceiptPdf({
      receiptNumber,
      donatedAt,
      donor,
      amountInr,
      paymentId,
    });

    // 3. Email donor + finance team in parallel
    await Promise.allSettled([
      sendDonorReceipt({
        donorName: donor.name,
        donorEmail: donor.email,
        amountInr,
        receiptNumber,
        paymentId,
        pdfBuffer,
      }),
      sendFinanceNotification({
        donorName: donor.name,
        donorEmail: donor.email,
        donorPhone: donor.phone,
        donorPan: donor.pan,
        amountInr,
        receiptNumber,
        paymentId,
        pdfBuffer,
      }),
    ]);

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
