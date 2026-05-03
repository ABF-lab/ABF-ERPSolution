import type { APIRoute } from "astro";
import { deleteDonationByPaymentId } from "../../../lib/db";

export const prerender = false;

/**
 * Delete a donation row by paymentId. Used to clean up test/recovery rows
 * that shouldn't appear in /admin/donations.
 *
 * Behind /admin auth via src/middleware.ts.
 *
 *   POST /api/admin/delete-donation
 *   { "paymentId": "pay_xxx" }
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body.paymentId) return json({ error: "Missing field: paymentId" }, 400);

    const deleted = await deleteDonationByPaymentId(String(body.paymentId));
    if (deleted === 0) {
      return json({ error: `No donation found for paymentId=${body.paymentId}` }, 404);
    }
    return json({ ok: true, deleted });
  } catch (err) {
    console.error("delete-donation error:", err);
    return json({ error: err instanceof Error ? err.message : "Server error" }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}
