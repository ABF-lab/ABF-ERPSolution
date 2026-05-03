import type { APIRoute } from "astro";
import { generateReceiptPdf } from "../../../lib/receipt";

export const prerender = false;

/**
 * Preview the 80G receipt PDF design with sample data.
 * Useful for reviewing the layout before any real donor sees it.
 * Behind /admin auth via src/middleware.ts.
 *
 *   visit:  https://activebengaluru.org/api/admin/receipt-preview
 */
export const GET: APIRoute = async () => {
  const pdf = await generateReceiptPdf({
    receiptNumber: "ABF/2025-26/SAMPLE",
    donatedAt: new Date(),
    donor: {
      name: "Sample Donor",
      email: "donor@example.com",
      phone: "+91 98765 43210",
      pan: "ABCDE1234F",
      address: "123 Sample Street, Indiranagar, Bengaluru 560038",
    },
    amountInr: 5000,
    paymentId: "pay_SamplePaymentID00",
  });

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="ABF-receipt-preview.pdf"',
      "Cache-Control": "no-store",
    },
  });
};
