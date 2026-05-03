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
- [ ] **Vercel project** with the `active-bengaluru` GitHub repo connected (you already have this)
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

## 3. Vercel Postgres — donation log + atomic receipt numbering

Donations are stored in a Postgres database hosted on Vercel. Free tier gives you 256 MB / 60 hours of compute per month — more than enough for any NGO scale.

### 3a. Create the database

1. Vercel → your `active-bengaluru` project → **Storage** tab (top nav)
2. Click **Create Database** (or **Connect Store** if you already have one)
3. Choose **Postgres** (or "Neon Postgres" — same thing)
4. Region: **Mumbai (bom1)** if available, otherwise **Singapore (sin1)** — close to your Vercel functions
5. Database name: `abf-donations` (any name is fine)
6. Click **Create**
7. Vercel automatically adds these env vars to your project:
   - `POSTGRES_URL`
   - `POSTGRES_URL_NON_POOLING`
   - `POSTGRES_USER`
   - `POSTGRES_HOST`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DATABASE`

You don't need to copy/paste these anywhere — they're injected automatically.

### 3b. Trigger the schema setup

After Vercel finishes provisioning the database (~30 seconds) and your project redeploys (auto-triggered by the Storage connection):

1. Visit `https://activebengaluru.org/api/admin/init-db` in your browser
2. Login with your admin credentials when prompted (basic auth — username `admin`, password from your env var)
3. You should see:
   ```json
   { "ok": true, "message": "Schema is up to date." }
   ```
4. If you see an error, the database isn't connected yet — wait 1 more minute and refresh

This creates two tables:
- `donations` — every donation row (atomic UNIQUE constraint on payment_id and receipt_number)
- `receipt_counters` — one row per fiscal year, atomically incremented for each new receipt number

You only need to run this once. (Running it again is safe — it's idempotent.)

> **Why Postgres instead of Google Sheets?**
> Google Apps Script web apps are notoriously unreliable for production webhooks (anonymous "Anyone" access has been getting flaky in some accounts since 2024). Postgres on Vercel is rock-solid, faster, and has zero auth setup.

### 3c. Browsing the data

You have two ways to see your donations:

1. **`/admin/donations`** on your live site — pretty UI with search and PDF re-download
2. **Vercel dashboard → Storage → your DB → Data tab** — raw SQL view, exportable to CSV

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
| `POSTGRES_*` (6 vars) | **auto-injected** when you create the database in Step 3 | (auto) |
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
   - [ ] `/admin/donations` (after entering admin password) shows the donation

7. Then test a ₹2,000+ donation to verify PAN field becomes required and the receipt PDF includes PAN.

### If something fails

- **`Server error` on Donate** → open Vercel → **Logs** tab → see the error
- **`POSTGRES_URL not set`** → database not connected yet. Vercel → Storage tab → make sure the DB is "Connected" to your project. Redeploy.
- **`relation "donations" does not exist`** → schema not initialised. Visit `/api/admin/init-db` once.
- **Webhook signature error** → confirm `RAZORPAY_WEBHOOK_SECRET` matches what you set in Razorpay
- **No email** → check Resend dashboard → **Logs** — common cause: domain not verified yet, sending to a freshly-created domain not allowed
- **/admin gives 401** → wrong password, or `ADMIN_PASSWORD` env var missing

### Recovering a donation that wasn't logged

If a Razorpay payment went through but no receipt was emailed (e.g. during initial setup before the DB was ready), you can manually record it and trigger the receipt:

```bash
curl -u admin:YOUR_ADMIN_PASSWORD \
  -X POST https://activebengaluru.org/api/admin/recover-donation \
  -H "Content-Type: application/json" \
  -d '{
    "receiptNumber": "ABF/2025-26/0001",
    "paymentId": "pay_xxx_from_razorpay",
    "orderId": "order_xxx_from_razorpay",
    "amountInr": 100,
    "donorName": "Donor Name",
    "donorEmail": "donor@example.com",
    "donatedAt": "2026-05-04T10:30:00.000Z"
  }'
```

This inserts the row into the database, generates the PDF, and emails it to the donor + finance team.

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
| Postgres client | `src/lib/db.ts` |
| Schema setup endpoint | `src/pages/api/admin/init-db.ts` |
| Manual donation recovery | `src/pages/api/admin/recover-donation.ts` |
| Razorpay SDK wrapper + signature verify | `src/lib/razorpay.ts` |

To change the receipt design: edit `src/lib/receipt.ts`. To change the donor email body: edit `src/lib/email.ts → sendDonorReceipt`.

---

## Costs

| Service | Free tier | When you'd start paying |
|---|---|---|
| Razorpay | Free to set up; transaction fees ~2% per donation (varies) | Per transaction, deducted from the amount |
| Resend | 3,000 emails/month, 100/day free | Above 3k/month — paid plans start at $20/mo |
| Vercel Postgres | Free (256 MB / 60 compute hours / month) | Never (for typical NGO volume) |
| Vercel functions | 100 GB-Hours/month free | Above that — typical NGO won't hit it |

For a typical NGO doing 500 donations/year: **₹0 in infrastructure costs**. You only pay Razorpay's per-transaction fee.

---

## Security notes

- The shared `GOOGLE_SHEET_WEBHOOK_TOKEN` is your only protection on the Apps Script endpoint — keep it secret
- Never commit `.env` to git (already in `.gitignore`)
- Rotate `ADMIN_PASSWORD` periodically
- The 80G receipt PDF is generated server-side and signed with your org details from env vars — donors can't tamper with it
