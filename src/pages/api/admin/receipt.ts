import type { APIRoute } from "astro";
import { generateReceiptPdf } from "../../../lib/receipt";
import { findDonationByPaymentId } from "../../../lib/db";

export const prerender = false;

/**
 * Re-generate and download the 80G receipt PDF for a past donation.
 * Looks up the donation by paymentId, then regenerates the same PDF
 * (same receipt number, same data) that was originally emailed.
 *
 * Use case: a donor lost their email and asks for a copy. Click the
 * "Download" link on /admin/donations next to their row.
 *
 * Behind /admin auth via src/middleware.ts.
 *
 *   visit:  /api/admin/receipt?paymentId=pay_xxx
 */
export const GET: APIRoute = async ({ url }) => {
  const paymentId = url.searchParams.get("paymentId");
  if (!paymentId) {
    return text("paymentId query param required", 400);
  }

  let row;
  try {
    row = await findDonationByPaymentId(paymentId);
  } catch (err) {
    return text(
      `Could not load donation: ${err instanceof Error ? err.message : "unknown error"}`,
      500
    );
  }

  if (!row) {
    return text(`No donation found for paymentId=${paymentId}`, 404);
  }

  let pdf: Buffer;
  try {
    pdf = await generateReceiptPdf({
      receiptNumber: row.receiptNumber,
      donatedAt: new Date(row.donatedAt),
      donor: {
        name: row.donorName,
        email: row.donorEmail,
        phone: row.donorPhone,
        pan: row.donorPan,
        address: row.donorAddress,
      },
      amountInr: row.amountInr,
      paymentId: row.paymentId,
      donorCategory: row.donorCategory,
    });
  } catch (err) {
    return text(
      `Could not generate PDF: ${err instanceof Error ? err.message : "unknown error"}`,
      500
    );
  }

  const safeFilename = row.receiptNumber.replace(/[^a-zA-Z0-9.-]/g, "-");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
};

function text(body: string, status: number) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}
