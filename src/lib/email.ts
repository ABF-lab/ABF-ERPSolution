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
const REPLY_TO = process.env.REPLY_TO_EMAIL || "activebengaluru@gmail.com";

export interface SendReceiptParams {
  donorName: string;
  donorEmail: string;
  amountInr: number;
  receiptNumber: string;
  paymentId: string;
  pdfBuffer: Buffer;
}

export async function sendDonorReceipt(p: SendReceiptParams) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#FFFDF5;padding:32px;border-radius:12px">
      <div style="background:#FFD23F;padding:18px 22px;border-radius:10px;margin-bottom:24px">
        <h1 style="margin:0;font-size:22px;color:#1A1A1A">Thank you, ${escapeHtml(p.donorName)} 🙏</h1>
        <p style="margin:6px 0 0;color:#1A1A1A;font-size:14px">Active Bengaluru Foundation</p>
      </div>
      <p style="font-size:16px;color:#1A1A1A;line-height:1.6">
        Your donation of <strong>₹ ${p.amountInr.toLocaleString("en-IN")}</strong> has been received.
        Your 80G receipt (<strong>${p.receiptNumber}</strong>) is attached as a PDF.
      </p>
      <p style="font-size:15px;color:#444;line-height:1.6">
        Every rupee helps us pick up the phone at 3 a.m., refuel a water tanker, or refurbish an
        oxygen concentrator for a family that can't afford one. You're part of a people's movement now.
      </p>
      <div style="background:white;padding:16px 18px;border-radius:8px;margin-top:24px;border:1px solid #eee">
        <div style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px">Receipt details</div>
        <div style="margin-top:6px;font-size:14px;color:#1A1A1A">
          <div><strong>Receipt #:</strong> ${p.receiptNumber}</div>
          <div><strong>Payment ID:</strong> ${p.paymentId}</div>
          <div><strong>Amount:</strong> ₹ ${p.amountInr.toLocaleString("en-IN")}</div>
        </div>
      </div>
      <p style="margin-top:24px;font-size:14px;color:#666">
        Questions about your donation? Reply to this email or call <strong>+91 93640 24365</strong>.
      </p>
      <p style="margin-top:18px;font-size:12px;color:#999">
        Active Bengaluru Foundation · No 12, 1st Floor, Lazar Road, Fraser Town, Bangalore 560005<br>
        Section 8 Company · 12A &amp; 80G certified
      </p>
    </div>
  `;
  const res = await client().emails.send({
    from: FROM_EMAIL,
    to: p.donorEmail,
    replyTo: REPLY_TO,
    subject: `Your 80G receipt — ${p.receiptNumber} · Active Bengaluru Foundation`,
    html,
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
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#EF4136;margin:0 0 16px">New donation received</h2>
      <table style="width:100%;font-size:14px;color:#1A1A1A;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#666;width:140px">Amount</td><td style="font-weight:bold;font-size:18px">₹ ${p.amountInr.toLocaleString("en-IN")}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Receipt #</td><td>${p.receiptNumber}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Payment ID</td><td>${p.paymentId}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Donor name</td><td>${escapeHtml(p.donorName)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Email</td><td>${escapeHtml(p.donorEmail)}</td></tr>
        ${p.donorPhone ? `<tr><td style="padding:6px 0;color:#666">Phone</td><td>${escapeHtml(p.donorPhone)}</td></tr>` : ""}
        ${p.donorPan   ? `<tr><td style="padding:6px 0;color:#666">PAN</td><td>${escapeHtml(p.donorPan)}</td></tr>` : ""}
      </table>
      <p style="margin-top:20px;font-size:13px;color:#666">
        80G receipt PDF is attached. The donor has been emailed a copy automatically.
        Full transaction details available in your <a href="https://dashboard.razorpay.com/app/payments/${p.paymentId}" style="color:#EF4136">Razorpay dashboard</a>
        and the <a href="https://activebengaluru.org/admin/donations" style="color:#EF4136">Donations admin page</a>.
      </p>
    </div>
  `;
  const res = await client().emails.send({
    from: FROM_EMAIL,
    to: recipients,
    subject: `[Donation ₹${p.amountInr.toLocaleString("en-IN")}] ${p.donorName} · ${p.receiptNumber}`,
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
