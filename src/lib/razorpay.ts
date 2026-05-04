import Razorpay from "razorpay";
import crypto from "node:crypto";

let _client: Razorpay | null = null;

export function razorpayClient(): Razorpay {
  if (_client) return _client;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
  }
  _client = new Razorpay({ key_id, key_secret });
  return _client;
}

export function verifyPaymentSignature(opts: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET missing");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${opts.orderId}|${opts.paymentId}`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(opts.signature)
  );
}

/**
 * Verify the signature returned by Razorpay Checkout for a subscription auth.
 * Note the order — for subscriptions Razorpay signs `paymentId|subscriptionId`,
 * which is the reverse of the orders flow (`orderId|paymentId`).
 */
export function verifySubscriptionSignature(opts: {
  subscriptionId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET missing");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${opts.paymentId}|${opts.subscriptionId}`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(opts.signature)
  );
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET missing");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}
