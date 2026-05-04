import type { APIRoute } from "astro";
import { Resend } from "resend";

export const prerender = false;

/**
 * Diagnose Resend connectivity end-to-end. Visit:
 *
 *   https://activebengaluru.org/api/admin/debug-email?to=YOUR@EMAIL.com
 *
 * (basic auth) and read the JSON result. Tells you:
 *   - whether RESEND_API_KEY is set and what its prefix is
 *   - what FROM_EMAIL we're using
 *   - exactly what Resend's API responded — success ID OR the error name + message
 *
 * No DB writes, no PDF, no template — just a one-line plain-text email so we
 * can isolate whether the email pipeline itself is broken vs. some upstream step.
 */
export const GET: APIRoute = async ({ url }) => {
  const to = url.searchParams.get("to") || "";
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return json({ error: "Pass a valid ?to= email param" }, 400);
  }

  const apiKey = process.env.RESEND_API_KEY || "";
  const fromEmail = process.env.FROM_EMAIL || "Active Bengaluru <onboarding@resend.dev>";
  const replyTo = process.env.REPLY_TO_EMAIL || "activebengaluru@gmail.com";

  const config = {
    apiKeyPresent: apiKey.length > 0,
    apiKeyPrefix: apiKey ? `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}` : null,
    apiKeyLength: apiKey.length,
    fromEmail,
    replyTo,
    nodeEnv: process.env.NODE_ENV || "unknown",
  };

  if (!apiKey) {
    return json({ ok: false, stage: "config", error: "RESEND_API_KEY env var is not set on this Vercel deployment", config });
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromEmail,
      to,
      replyTo,
      subject: "ABF email pipeline test (debug-email)",
      html: `<p>If you received this, the Resend → ${to} pipeline is healthy.</p>
             <p style="color:#888;font-size:12px">Sent from /api/admin/debug-email at ${new Date().toISOString()}</p>`,
    });

    if (result.error) {
      return json({
        ok: false,
        stage: "resend-rejected",
        error: {
          name: result.error.name,
          message: result.error.message,
        },
        config,
      });
    }

    return json({
      ok: true,
      stage: "delivered-to-resend",
      messageId: result.data?.id || null,
      note: "Resend accepted the email. Check the recipient inbox + the Resend dashboard (https://resend.com/emails) to confirm delivery vs. bounce.",
      config,
    });
  } catch (err) {
    return json({
      ok: false,
      stage: "exception-thrown",
      error: {
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : "Unknown",
      },
      config,
    }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
