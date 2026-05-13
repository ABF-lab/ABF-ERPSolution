import { Resend } from "resend";

let _resend: Resend | null = null;
function client(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  _resend = new Resend(key);
  return _resend;
}

const FROM_EMAIL = process.env.FROM_EMAIL || "Active Bengaluru <onboarding@resend.dev>";
const FINANCE_EMAIL = process.env.FINANCE_EMAIL || "activebengaluru@gmail.com";
// Default Reply-To uses the same domain as From so spam filters don't flag a
// domain mismatch (gmail.com reply-to from a custom-domain sender is a common
// soft-fail signal). Resend inbound on activebengaluru.org catches replies.
const REPLY_TO = process.env.REPLY_TO_EMAIL || "donations@activebengaluru.org";

// One-click unsubscribe — required by Gmail & Yahoo bulk-sender rules (Feb 2024).
// Even though donation receipts are transactional and donors don't opt-in/out,
// having the header set improves inbox placement.
const UNSUB_MAILTO = process.env.UNSUB_MAILTO || "unsubscribe@activebengaluru.org";

const LOGO_URL = "https://activebengaluru.org/images/logo.png";
const SITE_URL = "https://activebengaluru.org";

const Y = "#FFE066";
const R = "#EF4136";
const INK = "#1A1A1A";

/** Yellow brand band with centered logo + tagline. Same on donor + finance emails. */
function brandBand(): string {
  return `
    <div style="background:${Y};padding:28px 20px;text-align:center">
      <img src="${LOGO_URL}" alt="Active Bengaluru Foundation"
           width="200" style="display:block;margin:0 auto;height:auto;border:0;outline:none;text-decoration:none">
      <div style="margin-top:12px;font-size:11px;color:${INK};letter-spacing:2px;text-transform:uppercase;font-weight:bold">
        A People's Movement
      </div>
    </div>
  `;
}

/** Black footer block with org legal info. */
function footerBlock(): string {
  return `
    <div style="background:${INK};color:#BBB;padding:22px 28px;font-size:11px;line-height:1.7;text-align:center">
      <strong style="color:#FFF">Active Bengaluru Foundation</strong><br>
      Section 8 NPO · 12A &amp; 80G certified<br>
      No 12, 1st Floor, Lazar Road, Fraser Town, Bangalore 560005<br>
      <a href="tel:+919364024365" style="color:${Y};text-decoration:none">+91 93640 24365</a>
      ·
      <a href="mailto:activebengaluru@gmail.com" style="color:${Y};text-decoration:none">activebengaluru@gmail.com</a>
      ·
      <a href="${SITE_URL}" style="color:${Y};text-decoration:none">activebengaluru.org</a>
    </div>
  `;
}

export interface SendReceiptParams {
  donorName: string;
  donorEmail: string;
  amountInr: number;
  receiptNumber: string;
  paymentId: string;
  pdfBuffer: Buffer;
}

export async function sendDonorReceipt(p: SendReceiptParams) {
  const amount = p.amountInr.toLocaleString("en-IN");
  const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF">
    ${brandBand()}

    <div style="padding:36px 32px 28px;color:${INK}">
      <h1 style="margin:0 0 14px;font-size:24px;font-weight:bold;line-height:1.3">
        Thank you, ${escapeHtml(p.donorName)} 🙏
      </h1>
      <p style="font-size:15.5px;line-height:1.65;margin:0 0 22px;color:#333">
        Your donation of <strong style="color:${INK}">₹ ${amount}</strong> has been received.
        Every rupee you give helps us answer a midnight call, refuel a water tanker,
        or get an oxygen concentrator into the hands of a family that can't afford one.
        You're part of a people's movement now.
      </p>

      <div style="border:1px solid #EAEAEA;border-radius:10px;padding:20px 22px;background:#FAFAFA;margin:0 0 24px">
        <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1.5px;font-weight:bold;margin-bottom:14px">
          Receipt summary
        </div>
        <table style="width:100%;font-size:14px;color:${INK};border-collapse:collapse" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:5px 0;color:#666;width:120px">Receipt #</td>
            <td style="padding:5px 0"><strong>${p.receiptNumber}</strong></td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#666">Amount</td>
            <td style="padding:5px 0"><strong>₹ ${amount}</strong></td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#666">Payment ID</td>
            <td style="padding:5px 0;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:13px">${escapeHtml(p.paymentId)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#666">Date</td>
            <td style="padding:5px 0">${date}</td>
          </tr>
        </table>
      </div>

      <div style="background:#FFFBEC;border-left:3px solid ${Y};padding:14px 18px;border-radius:4px;margin:0 0 24px">
        <div style="font-size:14px;color:${INK};line-height:1.55">
          📎 Your <strong>80G tax-exemption receipt</strong> is attached as a PDF — keep it safe and use it when filing your income tax return.
        </div>
      </div>

      <div style="margin-top:8px;padding-top:24px;border-top:1px solid #EEE;text-align:center">
        <a href="${SITE_URL}/projects" style="display:inline-block;background:${R};color:#FFF;padding:12px 22px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;margin:4px 6px">
          See our work →
        </a>
        <a href="mailto:${REPLY_TO}" style="display:inline-block;color:${R};padding:12px 18px;text-decoration:none;font-size:14px;font-weight:bold;margin:4px 6px">
          Questions? Reply →
        </a>
      </div>
    </div>

    ${footerBlock()}
  </div>
</body>
</html>
  `;

  // Plain-text body alongside HTML — multipart/alternative scores better with
  // spam filters and works for text-only clients.
  const text = [
    `Thank you, ${p.donorName}.`,
    ``,
    `Your donation of ₹ ${amount} to Active Bengaluru Foundation has been received.`,
    ``,
    `Receipt details:`,
    `  Receipt #: ${p.receiptNumber}`,
    `  Amount:    ₹ ${amount}`,
    `  Payment:   ${p.paymentId}`,
    `  Date:      ${date}`,
    ``,
    `Your 80G tax-exemption receipt is attached as a PDF — keep it safe and use it`,
    `when filing your income-tax return.`,
    ``,
    `Questions? Reply to this email, or write to activebengaluru@gmail.com`,
    `Phone: +91 93640 24365  ·  Web: https://activebengaluru.org`,
    ``,
    `Active Bengaluru Foundation · Section 8 NPO · 12A & 80G certified`,
    `No 12, 1st Floor, Lazar Road, Fraser Town, Bangalore 560005`,
  ].join("\n");

  const res = await client().emails.send({
    from: FROM_EMAIL,
    to: p.donorEmail,
    replyTo: REPLY_TO,
    subject: `Your 80G receipt — ${p.receiptNumber} · Active Bengaluru Foundation`,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<mailto:${UNSUB_MAILTO}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      "X-Entity-Type": "transactional",
    },
    attachments: [{
      filename: `${p.receiptNumber.replace(/\//g, "-")}.pdf`,
      content: p.pdfBuffer,
    }],
  });
  if (res.error) {
    throw new Error(`Resend (donor) failed: ${res.error.name} — ${res.error.message}`);
  }
  return res;
}

export interface SendFinanceParams {
  donorName: string;
  donorEmail: string;
  donorPhone?: string;
  donorPan?: string;
  amountInr: number;
  receiptNumber: string;
  paymentId: string;
  pdfBuffer: Buffer;
}

export async function sendFinanceNotification(p: SendFinanceParams) {
  const recipients = FINANCE_EMAIL.split(",").map((s) => s.trim()).filter(Boolean);
  const amount = p.amountInr.toLocaleString("en-IN");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF">
    ${brandBand()}

    <div style="padding:32px 32px 24px;color:${INK}">
      <div style="font-size:11px;color:${R};text-transform:uppercase;letter-spacing:1.5px;font-weight:bold">
        Internal · Finance notification
      </div>
      <h2 style="margin:6px 0 22px;color:${INK};font-size:22px">New donation received</h2>

      <div style="background:#FAFAFA;border:1px solid #EAEAEA;border-radius:10px;padding:20px 22px;margin:0 0 22px">
        <table style="width:100%;font-size:14px;color:${INK};border-collapse:collapse" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;color:#666;width:130px">Amount</td>
            <td style="padding:6px 0;font-weight:bold;font-size:20px;color:${INK}">₹ ${amount}</td>
          </tr>
          <tr><td style="padding:6px 0;color:#666">Receipt #</td><td style="padding:6px 0"><strong>${p.receiptNumber}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666">Payment ID</td><td style="padding:6px 0;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:13px">${escapeHtml(p.paymentId)}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Donor name</td><td style="padding:6px 0">${escapeHtml(p.donorName)}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0">${escapeHtml(p.donorEmail)}</td></tr>
          ${p.donorPhone ? `<tr><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0">${escapeHtml(p.donorPhone)}</td></tr>` : ""}
          ${p.donorPan   ? `<tr><td style="padding:6px 0;color:#666">PAN</td><td style="padding:6px 0">${escapeHtml(p.donorPan)}</td></tr>` : ""}
        </table>
      </div>

      <p style="font-size:13px;color:#666;line-height:1.65;margin:0 0 18px">
        80G receipt PDF is attached. The donor has been emailed a copy automatically.
      </p>

      <div style="text-align:center;padding-top:12px;border-top:1px solid #EEE">
        <a href="https://dashboard.razorpay.com/app/payments/${encodeURIComponent(p.paymentId)}" style="display:inline-block;background:${INK};color:#FFF;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:bold;margin:4px 6px">
          Razorpay dashboard →
        </a>
        <a href="${SITE_URL}/admin/donations" style="display:inline-block;color:${R};padding:10px 18px;text-decoration:none;font-size:13px;font-weight:bold;margin:4px 6px">
          Admin page →
        </a>
      </div>
    </div>

    ${footerBlock()}
  </div>
</body>
</html>
  `;

  const res = await client().emails.send({
    from: FROM_EMAIL,
    to: recipients,
    subject: `[Donation ₹${amount}] ${p.donorName} · ${p.receiptNumber}`,
    html,
    attachments: [{
      filename: `${p.receiptNumber.replace(/\//g, "-")}.pdf`,
      content: p.pdfBuffer,
    }],
  });
  if (res.error) {
    throw new Error(`Resend (finance) failed: ${res.error.name} — ${res.error.message}`);
  }
  return res;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]!));
}
