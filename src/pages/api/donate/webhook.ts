import type { APIRoute } from "astro";
import { verifyWebhookSignature } from "../../../lib/razorpay";
import { generateReceiptPdf, type FrequencyLabel } from "../../../lib/receipt";
import { sendDonorReceipt } from "../../../lib/email";
import {
  insertDonation,
  findSubscriptionByRazorpayId,
  updateSubscriptionStatus,
  type SubscriptionStatus,
  type Frequency,
} from "../../../lib/db";

export const prerender = false;

/**
 * Razorpay webhook receiver — primary path for recurring subscription charges.
 *
 * Configure in Razorpay dashboard → Settings → Webhooks:
 *   URL:    https://activebengaluru.org/api/donate/webhook
 *   Events: payment.captured (one-off backup),
 *           subscription.activated,
 *           subscription.charged,        ← MOST IMPORTANT — fires per charge
 *           subscription.cancelled,
 *           subscription.halted,
 *           subscription.completed
 *   Secret: copy into RAZORPAY_WEBHOOK_SECRET env var
 *
 * For one-off donations the synchronous /api/donate/verify path runs first.
 * For recurring donations every charge (including the first) generates a
 * receipt + email here. `insertDonation` is idempotent on payment_id, so if
 * verify-subscription processes the first charge before the webhook fires,
 * this code path becomes a no-op for that charge.
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
    const eventName = String(event.event || "");
    console.log("[razorpay webhook]", eventName, event.payload?.subscription?.entity?.id || event.payload?.payment?.entity?.id || "");

    switch (eventName) {
      case "subscription.charged":
        await handleSubscriptionCharged(event);
        break;
      case "subscription.activated":
        await handleSubscriptionStatus(event, "active");
        break;
      case "subscription.cancelled":
        await handleSubscriptionStatus(event, "cancelled");
        break;
      case "subscription.completed":
        await handleSubscriptionStatus(event, "completed");
        break;
      case "subscription.halted":
        await handleSubscriptionStatus(event, "halted");
        break;
      case "subscription.paused":
        await handleSubscriptionStatus(event, "paused");
        break;
      case "subscription.pending":
        await handleSubscriptionStatus(event, "pending");
        break;
      case "payment.captured":
      case "payment.failed":
        // One-off path is handled synchronously by /api/donate/verify; ignore here.
        break;
      default:
        // Unknown events: 200 OK so Razorpay doesn't retry forever.
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("webhook error:", err);
    // Return 500 so Razorpay retries — but only for genuine processing errors.
    return new Response("error", { status: 500 });
  }
};

async function handleSubscriptionCharged(event: WebhookEvent): Promise<void> {
  const sub = event.payload?.subscription?.entity;
  const payment = event.payload?.payment?.entity;
  if (!sub?.id || !payment?.id) {
    console.warn("[webhook] subscription.charged missing sub or payment payload");
    return;
  }

  const ourSub = await findSubscriptionByRazorpayId(sub.id);
  if (!ourSub) {
    // We didn't initiate this sub — could be a manual one created in the dashboard.
    // Log and bail; we have no donor info to issue a receipt against.
    console.warn(`[webhook] no subscription row for ${sub.id} — skipping`);
    return;
  }

  const amountInr = Number(payment.amount) / 100;
  const donatedAt = new Date(Number(payment.created_at || Date.now() / 1000) * 1000);

  const { receiptNumber, isNew } = await insertDonation({
    paymentId: payment.id,
    orderId: payment.order_id || sub.id,
    amountInr,
    donorName: ourSub.donorName,
    donorEmail: ourSub.donorEmail,
    donorPhone: ourSub.donorPhone,
    donorPan: ourSub.donorPan,
    donorAddress: ourSub.donorAddress,
    donorCategory: ourSub.donorCategory,
    subscriptionId: sub.id,
    donatedAt,
  });

  if (!isNew) {
    // verify-subscription already processed this charge synchronously.
    return;
  }

  const pdfBuffer = await generateReceiptPdf({
    receiptNumber,
    donatedAt,
    donor: {
      name: ourSub.donorName,
      email: ourSub.donorEmail,
      phone: ourSub.donorPhone,
      pan: ourSub.donorPan,
      address: ourSub.donorAddress,
    },
    amountInr,
    paymentId: payment.id,
    donorCategory: ourSub.donorCategory,
    frequencyLabel: ourSub.frequency as Frequency as FrequencyLabel,
  });

  try {
    await sendDonorReceipt({
      donorName: ourSub.donorName,
      donorEmail: ourSub.donorEmail,
      amountInr,
      receiptNumber,
      paymentId: payment.id,
      pdfBuffer,
    });
  } catch (err) {
    console.error("[webhook] donor email failed:", err);
  }
}

async function handleSubscriptionStatus(event: WebhookEvent, status: SubscriptionStatus): Promise<void> {
  const sub = event.payload?.subscription?.entity;
  if (!sub?.id) return;
  await updateSubscriptionStatus(sub.id, status);
}

interface WebhookEvent {
  event?: string;
  payload?: {
    subscription?: { entity?: { id?: string } };
    payment?: { entity?: { id?: string; amount?: number; order_id?: string; created_at?: number } };
  };
}
