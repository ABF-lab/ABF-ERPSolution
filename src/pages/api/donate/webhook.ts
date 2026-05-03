import type { APIRoute } from "astro";
import { verifyWebhookSignature } from "../../../lib/razorpay";

export const prerender = false;

/**
 * Razorpay webhook receiver — backup safety net.
 *
 * The primary path is the synchronous `/api/donate/verify` call after Razorpay
 * Checkout completes successfully. But if the user's browser closes mid-flow
 * or the verify call fails for any reason, this webhook acts as the backup —
 * Razorpay will retry it for up to 24 hours until 2xx is returned.
 *
 * Configure in Razorpay dashboard → Settings → Webhooks:
 *   URL:    https://activebengaluru.org/api/donate/webhook
 *   Events: payment.captured, payment.failed
 *   Secret: copy into RAZORPAY_WEBHOOK_SECRET env var
 *
 * For now this just logs — it's a place you can extend later if you want
 * automatic retries of the receipt generation when the sync flow fails.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";
    if (!signature) return new Response("missing signature", { status: 400 });

    if (!verifyWebhookSignature(rawBody, signature)) {
      return new Response("bad signature", { status: 400 });
    }

    const event = JSON.parse(rawBody);
    console.log("[razorpay webhook]", event.event, event.payload?.payment?.entity?.id);

    // We acknowledge fast; receipt generation is handled by /api/donate/verify
    // on the success-redirect path. Future work: idempotent reconciliation here.

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("webhook error:", err);
    return new Response("error", { status: 500 });
  }
};
