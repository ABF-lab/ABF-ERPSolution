import type { APIRoute } from "astro";
import { manualInsertDonation, findDonationByPaymentId } from "../../../lib/db";
import { generateReceiptPdf } from "../../../lib/receipt";
import { sendDonorReceipt, sendFinanceNotification } from "../../../lib/email";

export const prerender = false;

/**
 * Recover a donation that was paid via Razorpay but didn't get logged
 * (e.g. the verify endpoint failed because the storage layer was broken).
 *
 * Manually create the row in DB, generate the receipt PDF, and email it.
 *
 * Behind /admin auth via src/middleware.ts.
 *
 * POST /api/admin/recover-donation
 *   Content-Type: application/json
 *   {
 *     "receiptNumber": "ABF/2025-26/0001",
 *     "paymentId":     "pay_xxx",
 *     "orderId":       "order_xxx",
 *     "amountInr":     1000,
 *     "donorName":     "Full Name",
 *     "donorEmail":    "donor@example.com",
 *     "donorPhone":    "+91 …" (optional),
 *     "donorPan":      "ABCDE1234F" (optional),
 *     "donorAddress":  "…" (optional),
 *     "donatedAt":     "2026-05-04T10:30:00.000Z"
 *   }
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const required = ["receiptNumber", "paymentId", "orderId", "amountInr",
                      "donorName", "donorEmail", "donatedAt"];
    for (const field of required) {
      if (!body[field]) return json({ error: `Missing field: ${field}` }, 400);
    }

    const existing = await findDonationByPaymentId(body.paymentId);
    if (existing) {
      return json({
        error: "Donation already exists for this paymentId",
        existing: { receiptNumber: existing.receiptNumber },
      }, 409);
    }

    const donatedAt = new Date(body.donatedAt);
    const amountInr = Number(body.amountInr);

    await manualInsertDonation({
      receiptNumber: body.receiptNumber,
      paymentId: body.paymentId,
      orderId: body.orderId,
      amountInr,
      donorName: body.donorName,
      donorEmail: body.donorEmail,
      donorPhone: body.donorPhone || undefined,
      donorPan: body.donorPan || undefined,
      donorAddress: body.donorAddress || undefined,
      donatedAt,
    });

    const pdfBuffer = await generateReceiptPdf({
      receiptNumber: body.receiptNumber,
      donatedAt,
      donor: {
        name: body.donorName,
        email: body.donorEmail,
        phone: body.donorPhone,
        pan: body.donorPan,
        address: body.donorAddress,
      },
      amountInr,
      paymentId: body.paymentId,
    });

    const emailResults = await Promise.allSettled([
      sendDonorReceipt({
        donorName: body.donorName,
        donorEmail: body.donorEmail,
        amountInr,
        receiptNumber: body.receiptNumber,
        paymentId: body.paymentId,
        pdfBuffer,
      }),
      sendFinanceNotification({
        donorName: body.donorName,
        donorEmail: body.donorEmail,
        donorPhone: body.donorPhone,
        donorPan: body.donorPan,
        amountInr,
        receiptNumber: body.receiptNumber,
        paymentId: body.paymentId,
        pdfBuffer,
      }),
    ]);

    const emailErrors = emailResults
      .map((r, i) => r.status === "rejected"
        ? { recipient: i === 0 ? "donor" : "finance", error: String(r.reason) }
        : null)
      .filter(Boolean);

    return json({ ok: true, receiptNumber: body.receiptNumber, emailErrors });
  } catch (err) {
    console.error("recover-donation error:", err);
    return json({ error: err instanceof Error ? err.message : "Server error" }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}
