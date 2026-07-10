import type { APIRoute } from "astro";
import crypto from "node:crypto";
import { insertDonation, normaliseCategory, normalisePaymentMethod } from "../../../lib/db";
import { generateReceiptPdf } from "../../../lib/receipt";
import { sendDonorReceipt, sendFinanceNotification } from "../../../lib/email";

export const prerender = false;

/**
 * Admin-entered "offline" bill — a donation paid directly by bank transfer, UPI,
 * or cash rather than through the public Razorpay checkout. Mints a real receipt
 * number via the same auto-numbering path as online donations, generates the 80G
 * PDF, and emails it to the donor.
 *
 * Behind /admin auth via src/middleware.ts.
 *
 * POST /api/admin/create-bill
 *   {
 *     "donorName":        "Full Name",
 *     "donorEmail":       "donor@example.com",
 *     "amountInr":        1000,
 *     "paymentMethod":    "bank" | "upi" | "cash",
 *     "donorPhone":       "+91 …" (optional),
 *     "donorPan":         "ABCDE1234F" (required if amountInr >= 2000),
 *     "donorAddress":     "…" (optional),
 *     "donorCategory":    "general" | "zakat" | "sadqa" | "interest" (optional),
 *     "paymentReference": "UTR / UPI ref / cheque no." (optional),
 *     "donatedAt":        "2026-07-10T10:30:00.000Z" (optional, defaults to now)
 *   }
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const amountInr = Number(body.amountInr);
    if (!Number.isFinite(amountInr) || amountInr < 100) {
      return json({ error: "Minimum bill amount is ₹100" }, 400);
    }
    if (amountInr > 1_00_00_000) {
      return json({ error: "Amount too large — please split into multiple bills or contact tech support" }, 400);
    }

    const method = normalisePaymentMethod(body.paymentMethod);
    if (method === "online") {
      return json({ error: "Payment method must be one of: bank, upi, cash" }, 400);
    }

    // Cash above ₹2,000 is not eligible for 80G deduction under the Income Tax Act —
    // block it here rather than issue a certificate that won't hold up.
    if (method === "cash" && amountInr > 2000) {
      return json({
        error: "Cash donations above ₹2,000 are not eligible for an 80G deduction. Please record this as Bank Transfer or UPI instead.",
      }, 400);
    }

    const name = String(body.donorName || "").trim();
    if (!name || name.length < 2) return json({ error: "Please enter the donor's name" }, 400);

    const email = String(body.donorEmail || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Please enter a valid donor email" }, 400);
    }

    const pan = String(body.donorPan || "").toUpperCase().trim();
    if (amountInr >= 2000 && !pan) {
      return json({ error: "PAN is required for bills of ₹2,000 or more (per 80G regulations)" }, 400);
    }
    if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
      return json({ error: "PAN format invalid (expected: ABCDE1234F)" }, 400);
    }

    const donorCategory = normaliseCategory(body.donorCategory);
    const paymentReference = String(body.paymentReference || "").trim() || undefined;
    const donorPhone = String(body.donorPhone || "").trim() || undefined;
    const donorAddress = String(body.donorAddress || "").trim() || undefined;

    const donatedAt = body.donatedAt ? new Date(body.donatedAt) : new Date();
    if (Number.isNaN(donatedAt.getTime())) {
      return json({ error: "Invalid donatedAt date" }, 400);
    }

    // Synthesize a unique paymentId — offline bills have no Razorpay payment to key on.
    const paymentId = `offline_${method}_${crypto.randomUUID()}`;

    const { receiptNumber } = await insertDonation({
      paymentId,
      orderId: "manual-offline",
      amountInr,
      donorName: name,
      donorEmail: email,
      donorPhone,
      donorPan: pan || undefined,
      donorAddress,
      donorCategory,
      paymentMethod: method,
      paymentReference,
      donatedAt,
    });

    const donor = { name, email, phone: donorPhone, pan: pan || undefined, address: donorAddress };

    const pdfBuffer = await generateReceiptPdf({
      receiptNumber,
      donatedAt,
      donor,
      amountInr,
      paymentId,
      donorCategory,
      paymentMethod: method,
      paymentReference,
    });

    let emailError: string | null = null;
    try {
      await sendDonorReceipt({
        donorName: name,
        donorEmail: email,
        amountInr,
        receiptNumber,
        paymentId,
        pdfBuffer,
        paymentMethod: method,
        paymentReference,
      });
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
    }

    // Best-effort internal copy for finance reconciliation — offline bills have no
    // Razorpay dashboard record, so this is the only paper trail besides the DB row.
    try {
      await sendFinanceNotification({
        donorName: name,
        donorEmail: email,
        donorPhone,
        donorPan: pan || undefined,
        amountInr,
        receiptNumber,
        paymentId,
        pdfBuffer,
        paymentMethod: method,
        paymentReference,
      });
    } catch (err) {
      console.error("[create-bill] finance notification failed:", err);
    }

    return json({ ok: true, receiptNumber, emailError });
  } catch (err) {
    console.error("create-bill error:", err);
    return json({ error: err instanceof Error ? err.message : "Server error" }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}
