# Donations Setup Guide

How to wire up Razorpay payments + 80G receipts + email + admin dashboard.

This is a one-time setup. Follow each step in order. Total time: **~45 minutes** if you have all your details handy.

> **💡 Want to see what the 80G receipt PDF looks like first?** After you set the `ADMIN_PASSWORD` env var (step 4 below) and redeploy, visit:
> ```
> https://activebengaluru.org/api/admin/receipt-preview
> ```
> You'll get the basic-auth prompt, then the browser will display a sample receipt PDF — no donation needed. Use this to review the design before going live.

> **💡 Need to re-send a past donor's receipt?** Visit `/admin/donations` → click the "⬇ PDF" link next to their row. The exact same PDF that was originally emailed will download.

---

## 0. What you need before you start

Have these handy:

- [ ] **Razorpay account** — sign up at https://razorpay.com (KYC verified — required for live payments)
- [ ] **Resend account** — sign up at https://resend.com (free tier is fine to start)
- [ ] **Google account** with permission to create Sheets and Apps Scripts
- [ ] **ABF legal info** for the 80G receipt:
  - PAN of Active Bengaluru Foundation
  - 12A registration number
  - 80G registration number
  - Authorised signatory name + title
- [ ] **Vercel access** to your `active-bengaluru` project (you'll add env vars)

---

## 1. Razorpay — get the API keys

1. Sign in at https://dashboard.razorpay.com
2. **Settings → API Keys → Generate Key** (use **Test Mode** first — switch to Live later)
3. Copy:
   - `Key Id` (e.g. `rzp_test_xxxxxxxxxxxxx`)
   - `Key Secret` (shown only once — copy immediately)
4. Save these two values for later (you'll paste them into Vercel)

> **Test → Live cutover:** When ready to accept real payments, repeat the same steps but in **Live Mode**. Then update the env vars in Vercel and redeploy.

### Set up the webhook (backup safety net)

1. Razorpay dashboard → **Settings → Webhooks → Add new webhook**
2. **Webhook URL**: `https://activebengaluru.org/api/donate/webhook`
3. **Active events**: tick `payment.captured` and `payment.failed`
4. **Secret**: pick any strong random string (e.g. generate one with `openssl rand -hex 32`). Copy it.
5. Save

You'll add this secret into Vercel as `RAZORPAY_WEBHOOK_SECRET`.

---

## 2. Resend — get the email API key

1. Sign in at https://resend.com
2. **API Keys → Create API Key** → name it "ABF production" → copy the `re_…` value
3. (Recommended) **Domains → Add Domain** → enter `activebengaluru.org`
   - Resend gives you 3 DNS records (TXT, MX, CNAME) — add them at your DNS host (Vercel DNS in your case → **Project → Settings → Domains → DNS Records**)
   - Wait ~10 minutes, click **Verify**
   - Once verified you can send "from" your own domain (looks more professional than `@resend.dev`)
4. Save the API key for Vercel

Until your domain is verified, the FROM address will be `Active Bengaluru <onboarding@resend.dev>` — receipts still arrive correctly, they just look less branded.

---

## 3. Google Sheet + Apps Script — donation log + receipt numbers

This is the most fiddly part. The Sheet stores every donation row AND atomically assigns the next receipt number.

### 3a. Create the Sheet

1. Go to https://sheets.google.com and create a new blank sheet
2. Rename it: **ABF Donations Log**
3. In **row 1**, paste these exact column headers:

```
receiptNumber	donatedAt	donorName	donorEmail	donorPhone	donorPan	donorAddress	amountInr	paymentId	orderId
```

(Tabs between cells. Or just type each one in its column.)

4. Freeze row 1: **View → Freeze → 1 row**
5. Format column **H (amountInr)** as Currency → INR

### 3b. Add the Apps Script

1. In the same Sheet: **Extensions → Apps Script**
2. Delete the placeholder code, paste the script below:

```javascript
// ABF Donations webhook — paste into Apps Script attached to the donations sheet.
const SHEET_NAME = "Sheet1"; // rename if your sheet's tab is different
const SHARED_TOKEN = "PUT_A_LONG_RANDOM_STRING_HERE"; // must match GOOGLE_SHEET_WEBHOOK_TOKEN env var

function fiscalYearLabel(date) {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-indexed: April = 3
  const startYear = m >= 3 ? y : y - 1;
  return startYear + "-" + String(startYear + 1).slice(-2);
}

function getNextReceiptNumber(date) {
  const fy = fiscalYearLabel(date);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const r = String(data[i][0] || "");
    const m = r.match(new RegExp("^ABF/" + fy + "/(\\d+)$"));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = String(max + 1).padStart(4, "0");
  return "ABF/" + fy + "/" + next;
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== SHARED_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (body.action === "appendDonation") {
      const p = body.payload;
      const donatedAt = new Date(p.donatedAt);
      const receiptNumber = getNextReceiptNumber(donatedAt);
      sheet.appendRow([
        receiptNumber,
        donatedAt,
        p.donorName,
        p.donorEmail,
        p.donorPhone || "",
        p.donorPan || "",
        p.donorAddress || "",
        p.amountInr,
        p.paymentId,
        p.orderId,
      ]);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, receiptNumber }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (body.action === "listDonations") {
      const data = sheet.getDataRange().getValues();
      const donations = [];
      for (let i = 1; i < data.length; i++) {
        const r = data[i];
        if (!r[0]) continue;
        donations.push({
          receiptNumber: r[0],
          donatedAt: r[1] instanceof Date ? r[1].toISOString() : String(r[1]),
          donorName: r[2],
          donorEmail: r[3],
          donorPhone: r[4],
          donorPan: r[5],
          donorAddress: r[6],
          amountInr: Number(r[7]) || 0,
          paymentId: r[8],
          orderId: r[9],
        });
      }
      return ContentService.createTextOutput(JSON.stringify({ ok: true, donations }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Unknown action" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. **Important**: replace `PUT_A_LONG_RANDOM_STRING_HERE` with a long random string. Generate one with:
   ```bash
   openssl rand -hex 32
   ```
   Save the value — you'll need it as `GOOGLE_SHEET_WEBHOOK_TOKEN`.

4. Click **Save** (💾 icon)

### 3c. Deploy as a web app

1. Top right: **Deploy → New deployment**
2. Click ⚙️ next to "Select type" → **Web app**
3. Settings:
   - Description: "ABF donations webhook v1"
   - Execute as: **Me (your Google account)**
   - Who has access: **Anyone** ⚠️ (yes, anyone — the shared token is what protects it)
4. Click **Deploy**
5. Authorize when prompted
6. Copy the **Web app URL** (looks like `https://script.google.com/macros/s/AKfyc.../exec`)

This URL is your `GOOGLE_SHEET_WEBHOOK_URL`.

> If you ever change the script: **Deploy → Manage deployments → ✏️ → New version → Deploy**. The URL stays the same.

---

## 4. Pick an admin password

Just pick a strong password — you'll use it to log in to `/admin/donations` on your live site.

```bash
openssl rand -base64 24
```

Save it. You'll add it to Vercel as `ADMIN_PASSWORD`.

---

## 5. Add ALL env vars to Vercel

Open Vercel → Project → **Settings → Environment Variables** and add each of these:

| Key | Value | Environments |
|---|---|---|
| `RAZORPAY_KEY_ID` | from step 1 | Production, Preview, Development |
| `RAZORPAY_KEY_SECRET` | from step 1 | Production, Preview, Development |
| `RAZORPAY_WEBHOOK_SECRET` | from step 1 (webhook setup) | Production, Preview, Development |
| `RESEND_API_KEY` | from step 2 | Production, Preview, Development |
| `FROM_EMAIL` | `Active Bengaluru <onboarding@resend.dev>` (or your verified domain address) | Production, Preview, Development |
| `FINANCE_EMAIL` | `activebengaluru@gmail.com` | Production, Preview, Development |
| `REPLY_TO_EMAIL` | `activebengaluru@gmail.com` | Production, Preview, Development |
| `GOOGLE_SHEET_WEBHOOK_URL` | from step 3c | Production, Preview, Development |
| `GOOGLE_SHEET_WEBHOOK_TOKEN` | the random string from step 3b | Production, Preview, Development |
| `ADMIN_USER` | `admin` (or anything you like) | Production, Preview, Development |
| `ADMIN_PASSWORD` | from step 4 | Production, Preview, Development |
| `ORG_LEGAL_NAME` | `Active Bengaluru Foundation` | Production, Preview, Development |
| `ORG_ADDRESS` | `No 12, 1st Floor, Lazar Road, Fraser Town, Bangalore 560005, Karnataka, India` | Production, Preview, Development |
| `ORG_PAN` | ABF's PAN | Production, Preview, Development |
| `ORG_CIN` | `U85500KA2024NPL184982` | Production, Preview, Development |
| `ORG_12A_NUMBER` | your 12A reg number | Production, Preview, Development |
| `ORG_80G_NUMBER` | your 80G reg number | Production, Preview, Development |
| `ORG_SIGNATORY_NAME` | name shown above signature on the receipt | Production, Preview, Development |
| `ORG_SIGNATORY_TITLE` | their title (e.g. "Director, ABF") | Production, Preview, Development |

After adding everything, trigger a redeploy: **Deployments → ⋮ on latest → Redeploy**.

---

## 6. End-to-end test (in Razorpay TEST mode)

1. Visit `https://activebengaluru.org/donate`
2. Fill in:
   - Amount: **₹100** (under ₹2000, so PAN won't be required)
   - Name, email, phone — yours
3. Click **Donate now → Razorpay Checkout opens**
4. Use a test card: **4111 1111 1111 1111**, any future expiry, CVV `123`, OTP `1111`
5. Should redirect to `/donate/thank-you?r=ABF/2025-26/0001&a=100`
6. Check:
   - [ ] Email arrives at the donor address with the PDF receipt attached
   - [ ] Email arrives at `activebengaluru@gmail.com` with the same PDF
   - [ ] New row appears in your Google Sheet
   - [ ] `/admin/donations` (after entering admin password) shows the donation

7. Then test a ₹2,000+ donation to verify PAN field becomes required and the receipt PDF includes PAN.

### If something fails

- **`Server error` on Donate** → open Vercel → **Functions** logs → see the error
- **Webhook signature error** → confirm `RAZORPAY_WEBHOOK_SECRET` matches what you set in Razorpay
- **No email** → check Resend dashboard → **Logs** — common cause: domain not verified yet, sending to a freshly-created domain not allowed
- **Sheet not appending** → open Apps Script editor → **Executions** to see errors
- **/admin gives 401** → wrong password, or `ADMIN_PASSWORD` env var missing

---

## 7. Going live (switching from Test to Live)

When ready to accept real money:

1. Razorpay dashboard → flip to **Live mode** (top right)
2. Generate a NEW pair of API keys in **Live mode** (test keys won't work for real payments)
3. Update Vercel env vars `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` with the live values
4. Re-create the webhook in Live mode (separate from test webhook) and update `RAZORPAY_WEBHOOK_SECRET`
5. Redeploy

Now real cards/UPI payments work.

---

## Files / folders this all lives in

| What | Where |
|---|---|
| Donate page | `src/pages/donate.astro` |
| Thank-you page | `src/pages/donate/thank-you.astro` |
| Admin page | `src/pages/admin/donations.astro` |
| Admin auth (basic-auth middleware) | `src/middleware.ts` |
| Razorpay create-order endpoint | `src/pages/api/donate/create-order.ts` |
| Razorpay verify endpoint | `src/pages/api/donate/verify.ts` |
| Razorpay webhook receiver | `src/pages/api/donate/webhook.ts` |
| Admin donations API | `src/pages/api/admin/donations.ts` |
| 80G receipt PDF generator | `src/lib/receipt.ts` |
| Email sender (Resend) | `src/lib/email.ts` |
| Google Sheet client | `src/lib/sheets.ts` |
| Razorpay SDK wrapper + signature verify | `src/lib/razorpay.ts` |

To change the receipt design: edit `src/lib/receipt.ts`. To change the donor email body: edit `src/lib/email.ts → sendDonorReceipt`.

---

## Costs

| Service | Free tier | When you'd start paying |
|---|---|---|
| Razorpay | Free to set up; transaction fees ~2% per donation (varies) | Per transaction, deducted from the amount |
| Resend | 3,000 emails/month, 100/day free | Above 3k/month — paid plans start at $20/mo |
| Google Sheets | Free | Never (for typical NGO volume) |
| Vercel functions | 100 GB-Hours/month free | Above that — typical NGO won't hit it |

For a typical NGO doing 500 donations/year: **₹0 in infrastructure costs**. You only pay Razorpay's per-transaction fee.

---

## Security notes

- The shared `GOOGLE_SHEET_WEBHOOK_TOKEN` is your only protection on the Apps Script endpoint — keep it secret
- Never commit `.env` to git (already in `.gitignore`)
- Rotate `ADMIN_PASSWORD` periodically
- The 80G receipt PDF is generated server-side and signed with your org details from env vars — donors can't tamper with it
