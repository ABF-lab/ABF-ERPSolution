# Deploying Active Bengaluru Foundation to Vercel

A step-by-step guide for deploying this Astro site to Vercel and wiring up the custom domain.

---

## Step 1 — Import the GitHub repo

Go to **https://vercel.com/new** and pick the `active-bengaluru` repo from the list.

## Step 2 — Configure the project

Vercel auto-detects Astro. Verify these settings (they're the defaults — don't change anything):

| Field | Value |
|---|---|
| Framework Preset | **Astro** (auto-detected) |
| Root Directory | `./` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Node.js version | leave default |

> **Skip Environment Variables for now** — we'll add `PUBLIC_IMPACT_CSV_URL` after the first deploy.

Click the big black **Deploy** button.

## Step 3 — Wait for the build (~60–90 seconds)

You'll see a build log streaming. It should end with:

```
✓ 29 page(s) built
Build Completed
```

Vercel shows confetti and a preview URL like `active-bengaluru-xyz.vercel.app`.

---

## Step 4 — Smoke-test on your phone

Open the Vercel URL on your phone and check:

- [ ] The 24/7 helpline button opens the dialer with **+91 93640 24365**
- [ ] The donate QR scans correctly to `abf007.06@cmsidfc` (open camera, point at QR)
- [ ] Volunteer QR scans to your intended destination
- [ ] Tap-through Home → Projects → Events → Relief → Updates → Media → Donate
- [ ] Hero collage photos all load
- [ ] No horizontal scrolling anywhere

## Step 5 — Test the share preview

Send the Vercel URL to yourself on WhatsApp. Confirm the link preview shows the ABF logo, title, and tagline.

---

## Step 6 — (Optional) Wire the live impact counter

The Active Health counter on the dark strip currently shows fallback numbers (1,625 cases / ₹3.77 Cr). To make it pull live numbers from a Google Sheet:

1. Create a Google Sheet with **two cells only**:
   - `A1` = total cases (e.g. `1625`) — raw number, no commas
   - `A2` = total saved INR (e.g. `37752575`) — raw number, no commas/symbols
2. **File → Share → Publish to web**
3. Choose the sheet → format **Comma-separated values (.csv)** → click **Publish**
4. Copy the URL it gives you
5. In Vercel: **Project → Settings → Environment Variables**
   - Key: `PUBLIC_IMPACT_CSV_URL`
   - Value: the published CSV URL
   - Apply to: **Production, Preview, Development** (tick all three)
   - Click **Save**
6. Trigger a redeploy: **Deployments tab → ⋮ on latest deployment → Redeploy**

You can update the sheet any time — the site picks up new numbers within ~5 minutes (Google's CSV cache).

---

## Step 7 — Point activebengaluru.org at the new site

> ⚠️ **Don't do this until you're 100% happy with the Vercel preview URL.** The moment DNS propagates, the old site goes dark.

1. In Vercel: **Project → Settings → Domains**
2. Add `activebengaluru.org` and `www.activebengaluru.org`
3. Vercel shows the exact DNS records to add. Typically:
   - **Apex** `activebengaluru.org` → A record `76.76.21.21`
   - **www** subdomain → CNAME `cname.vercel-dns.com`
4. Log in to your domain registrar (GoDaddy / Namecheap / wherever the domain is)
5. Add the records exactly as Vercel shows them
6. Wait 5–60 minutes for DNS to propagate
7. Vercel's domain panel will show **Valid Configuration** with a green check
8. SSL certificate (Let's Encrypt) is automatic — no action needed

### DNS cutover safety tips

- Do this late at night (Bengaluru time) when traffic is lowest
- Have your old hosting login open in another tab in case you need to roll back
- Keep the old DNS records noted somewhere before changing them

---

## Step 8 — Submit to Google Search Console

After cutover (so Google indexes the new site, not the Vercel URL):

1. Go to **https://search.google.com/search-console**
2. Add property: `activebengaluru.org`
3. Verify via DNS TXT record (Vercel makes this easy — same DNS panel where you added the A record)
4. Submit a sitemap URL once you have one (currently disabled due to Node version — see backlog below)

---

## Adding analytics (recommended)

Pick one and tell your developer to add it. The placeholder is in `src/layouts/BaseLayout.astro` (look for `<!-- Analytics: drop a Plausible/GA snippet here when ready -->`).

| Option | Cost | Notes |
|---|---|---|
| **Vercel Analytics** | Free (small NGO scale) | One click in Vercel dashboard, no code needed |
| **Plausible** | ~₹500/mo | Privacy-friendly, GDPR-compliant, no cookie banners |
| **Google Analytics 4** | Free | Most data, but cookie banner required for EU compliance |

---

## What's NOT in this build (intentional non-goals)

These are explicit follow-ups for later versions:

- **Razorpay / Instamojo** — proper online donation gateway with auto 80G receipts
- **Volunteer signup form** — Web3Forms or a Cloudflare Worker writing to a Google Sheet
- **Decap CMS** — UI for non-technical team members to edit content without git
- **Kannada / Urdu translations**
- **Sitemap** — disabled because the plugin needs Node 20+. Re-enable once you upgrade Node locally.

---

## Cost summary

| Item | Cost |
|---|---|
| Vercel (Hobby plan) | **₹0/mo** — covers small NGO traffic |
| GitHub repo | **₹0/mo** |
| Google Sheet (counter source) | **₹0/mo** |
| Domain `activebengaluru.org` | (your existing renewal cost) |
| **Total marginal cost of this site** | **₹0/mo** |

---

## Bus-factor: give 2+ people admin access

The most common reason NGO websites die is single-person ownership. Make sure at least 2 people on your team have admin access to:

- [ ] **GitHub repo** — Settings → Collaborators → add by username
- [ ] **Vercel project** — Settings → Members → invite by email
- [ ] **Domain registrar account** — wherever `activebengaluru.org` is registered
- [ ] **Google account** that owns the impact-counter Sheet

---

## Rollback plan (if something goes badly wrong)

- **Bad deploy?** Vercel → Deployments → find a previous green deployment → ⋮ → **Promote to Production**. Live site reverts in ~5 seconds.
- **Bad DNS cutover?** At your registrar, restore the old A/CNAME records. DNS rolls back in 5–60 minutes.
- **Lost code?** It's all in GitHub. Clone it down on any machine, run `npm install && npm run dev`.

---

## Need help

- **Vercel docs**: https://vercel.com/docs
- **Astro docs**: https://docs.astro.build
- **This site's structure**: see `README.md` in the repo for content-editing instructions
