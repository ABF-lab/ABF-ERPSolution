# Active Bengaluru Foundation — Website

The official site for **Active Bengaluru Foundation (ABF)** — a Section 8 NGO bridging civil society, government, and underprivileged communities in Bengaluru and Karnataka.

Built with **[Astro](https://astro.build)** + **[Tailwind CSS](https://tailwindcss.com)**. Static, fast, free to host.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs to ./dist
npm run preview  # serves ./dist locally
```

> Requires Node 18+ (Node 20+ recommended).

---

## Project structure

```
public/
  data/impact.json          # Fallback values for the Active Health counters
  images/                   # Logo, QR codes, project photos
src/
  components/               # Header, Footer, ImpactStrip, ProjectCard, etc.
  content/
    projects/               # Long-term initiatives (one .md per project)
    relief/                 # Time-bound campaigns (one .md per campaign)
    updates/                # Active Updates blog issues
    config.ts               # Content collection schemas (Zod)
  layouts/
    BaseLayout.astro        # Global shell (header, footer, impact strip)
    EntryLayout.astro       # Hero + body for project/relief detail pages
  lib/format.ts             # INR formatter (₹3.77 Cr style)
  pages/
    index.astro             # Home
    about.astro
    projects/index.astro
    projects/[slug].astro   # Renders any project from content collection
    relief/index.astro
    relief/[slug].astro
    updates/index.astro
    updates/[slug].astro
    media.astro
    get-involved.astro
    contact.astro
  styles/globals.css        # Tailwind + brand tokens + utility classes
```

---

## Editing content

### Adding a new project

Create a new file in `src/content/projects/<slug>.md`:

```markdown
---
title: "My new project"
tagline: "One-line hook."
summary: "2-3 sentences summarising what this is and the impact."
heroImage: "/images/projects/my-project.jpg"
status: "active"            # active | ongoing | concluded | recurring
order: 8                    # lower = appears earlier on the index
flagship: false
partners: ["Partner A", "Partner B"]
stats:
  - { value: "1,000+", label: "People reached" }
  - { value: "₹5 Lakh", label: "Funds raised" }
ctaPhone: "+919364024365"   # optional helpline CTA in hero
---

## Body

Full markdown body here. Use h2/h3, lists, **bold**, links — all rendered with the prose styles.
```

The page will appear at `/projects/<slug>` automatically on next build.

### Adding a relief campaign

Same as above but in `src/content/relief/<slug>.md`. Schema includes `location` and `occurredOn` instead of `startedAt`.

### Adding an Active Updates issue

`src/content/updates/<yyyy-mm-issue>.md`:

```markdown
---
title: "Active Updates — November 2026"
issue: "Issue #2"
publishedOn: 2026-11-15
summary: "What this issue covers."
coverImage: "/images/updates/issue-2-cover.jpg"
tags: ["digest"]
---

Body content here…
```

---

## Live counter strip (Active Health impact)

The dark strip on every page that reads **"1,625+ Cases Assisted · ₹3.77 Cr+ Saved"** can be wired to a Google Sheet you maintain — no developer needed for updates.

### One-time setup (5 minutes)

1. Create a Google Sheet with two cells:
   - `A1` = total cases (e.g. `1625`)
   - `A2` = total saved INR (e.g. `37752575`)
2. **File → Share → Publish to web** → choose "**Comma-separated values (.csv)**" for the **range** `A1:A2` of the sheet.
3. Click **Publish**, copy the URL.
4. In your deploy environment (Netlify/Vercel/Cloudflare Pages), add an environment variable:

   ```
   PUBLIC_IMPACT_CSV_URL=https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv
   ```

5. Redeploy.

### How updates flow

- Edit either cell in your Google Sheet.
- Google publishes the new CSV within ~5 minutes (their cache).
- The next visitor to your site sees the new numbers (counters animate from 0).

### Fallback

If `PUBLIC_IMPACT_CSV_URL` is unset, or the network/CORS fetch fails, the strip falls back to values in `public/data/impact.json`. Update those if you want a static safety-net.

---

## Brand system

All brand tokens live in [`tailwind.config.mjs`](./tailwind.config.mjs):

| Token | Value | Use |
|---|---|---|
| `brand.yellow` | `#FFD23F` | Primary background, hero |
| `brand.yellow-soft` | `#FFE680` | Section backgrounds |
| `brand.red` | `#EF4136` | Accents, CTAs, the heart-handshake |
| `brand.ink` | `#1A1A1A` | Headings, body text |
| `brand.cream` | `#FFF8E7` | Alternate section bg |

Display font: **Archivo Black** (loaded from Google Fonts).
Body font: **Plus Jakarta Sans** (loaded from Google Fonts).

Reusable component classes are in `src/styles/globals.css` under `@layer components` — `btn-primary`, `btn-call`, `btn-yellow`, `chip`, `chip-red`, `card`, `heading-display`, `heading-section`, `prose-abf`, etc.

---

## Deployment

This is a fully static site. Pick any of:

### Netlify
```bash
npm run build
# Then drag the dist/ folder into https://app.netlify.com/drop
```
Or connect this repo via Netlify's dashboard. Build command: `npm run build`. Publish directory: `dist`.

### Vercel
```bash
npx vercel --prod
```
Or connect the repo. Vercel auto-detects Astro.

### Cloudflare Pages
Connect the repo. Build command: `npm run build`. Output dir: `dist`.

For all three: add `PUBLIC_IMPACT_CSV_URL` as an environment variable if you want live counters.

---

## What's deliberately NOT in v1

These are the explicit non-goals for the first version. Roadmap, not bugs:

- **No payment gateway.** Donations are bank/UPI display only. (Easy add later: Razorpay/Instamojo.)
- **No backend forms.** Volunteer/contact CTAs are WhatsApp + email links. (Easy add later: Web3Forms or a Cloudflare Worker.)
- **No CMS UI.** Content lives in markdown files in this repo. (Easy add later: Decap CMS for non-technical editors.)
- **No multilingual support.** English only. (Astro i18n is straightforward to add.)
- **No analytics.** A placeholder is in [`src/layouts/BaseLayout.astro`](./src/layouts/BaseLayout.astro) ready for Plausible/Google Analytics.

---

## Support / questions

For website edits, hand this codebase to any developer who knows JavaScript — Astro is intentionally low-friction. For the underlying content (project copy, photos, the live counter sheet), the ABF team owns it directly.

Built as a people's movement. ✦
