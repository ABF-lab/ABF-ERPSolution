# ABF ERP — Full Implementation Plan

## Project Goal
Deploy a fully customized, cloud-hosted ERP system for Active Bengaluru Foundation built on **ERPNext**, covering all 10 modules from the requirements document, with a live web URL and integration with the existing Astro.js website.

---

## 🖥️ Hosting Recommendation: DigitalOcean VPS (Self-Hosted)

### Comparison

| Factor | Frappe Cloud (Managed) | DigitalOcean VPS ✅ Recommended |
|--------|----------------------|-------------------------------|
| Monthly Cost | ₹6,000–₹15,000/month | ₹1,500–₹4,000/month |
| Setup Effort | Very easy (click deploy) | Moderate (1-time setup) |
| Control | Limited | Full root access |
| Custom Apps | Restricted on lower plans | Unlimited |
| Data Residency | Frappe's servers | Your own server |
| Backups | Managed | Configurable (S3/Spaces) |
| SSL | Auto-managed | Let's Encrypt (auto) |
| **Best for ABF** | If no IT resource | ✅ Since we're handling it |

> **Recommendation:** DigitalOcean VPS gives ABF full control, costs 3–4× less per month, and since we're handling the setup and maintenance, the "hidden cost" of self-hosting is eliminated. We'll configure automated backups, SSL, and monitoring.

### Recommended Server Spec (DigitalOcean Droplet)
- **Plan:** Basic — 4 vCPU / 8 GB RAM / 160 GB SSD
- **Cost:** ~$48/month (~₹4,000/month)
- **OS:** Ubuntu 22.04 LTS
- **Region:** Bangalore (BLR1) — for lowest latency

---

## 📋 Scope of Work

### Modules to Build

| Module | Source | Phase |
|--------|--------|-------|
| Finance & Accounts (GST, TDS, 80G) | ERPNext Native | Phase 1 |
| Case Management | Custom Frappe App | Phase 1 |
| Beneficiary Management | Custom Frappe App | Phase 1 |
| Inventory Management | ERPNext Native | Phase 2 |
| Donor Management | ERPNext Native + Config | Phase 2 |
| Membership Management | ERPNext Native + Config | Phase 2 |
| Partnerships Management | ERPNext CRM Config | Phase 3 |
| Events Management | ERPNext Native + Config | Phase 3 |
| Reports & Analytics | Custom Dashboards | Phase 3 |
| Website Integration (API) | REST API Bridge | Phase 4 |

---

## 🗺️ Implementation Roadmap

### Phase 1 — Foundation & Priority Modules (Weeks 1–4)
**Goal:** Live ERPNext instance with Finance, Case Management & Beneficiary Management

#### Week 1: Infrastructure Setup
- [ ] Provision DigitalOcean Droplet (Ubuntu 22.04, 4vCPU/8GB)
- [ ] Configure domain (e.g., `erp.activebengaluru.org`)
- [ ] Install ERPNext using `frappe-bench` (latest stable)
- [ ] Configure Nginx + SSL (Let's Encrypt)
- [ ] Set up automated daily backups to DigitalOcean Spaces
- [ ] Configure firewall (UFW) and fail2ban security
- [ ] Create ABF site on ERPNext bench

#### Week 2: ERPNext Core Configuration
- [ ] ABF company setup (name, logo, address, fiscal year)
- [ ] Chart of accounts (India-specific NGO structure)
- [ ] GST configuration (GSTIN, HSN/SAC codes)
- [ ] TDS setup (Section 194, 194J, etc.)
- [ ] 80G receipt template configuration
- [ ] Currency, tax templates, payment modes
- [ ] Role-based access control (Admin, Finance, Caseworker, Viewer)
- [ ] Email server integration (SMTP for notifications)

#### Week 3: Custom Frappe App — Case Management
Build a dedicated `abf_case_management` Frappe app with:
- [ ] **Case** doctype (ID, title, type, priority, status, assignee, description)
- [ ] **Case Category** doctype (e.g., grievance, request, feedback)
- [ ] **Case Comment/Update** child doctype (timeline of updates)
- [ ] Workflow: Open → In Progress → Resolved → Closed
- [ ] Automated email notifications on status change
- [ ] Case assignment to team members
- [ ] Public case submission form (web form)
- [ ] Case dashboard (open/closed/overdue counts)

#### Week 4: Custom Frappe App — Beneficiary Management
Build a dedicated `abf_beneficiary` Frappe app with:
- [ ] **Beneficiary** doctype (personal info, contact, category, status)
- [ ] **Support Record** doctype (type of support, date, amount, duration)
- [ ] **Impact Assessment** doctype (metrics, outcomes, survey responses)
- [ ] Beneficiary dashboard (demographics, support summary)
- [ ] 80G-linked donation tracking per beneficiary (if applicable)
- [ ] Beneficiary communication log
- [ ] Reports: support by category, by geography, by outcome

---

### Phase 2 — NGO Operations Modules (Weeks 5–8)

#### Week 5–6: Inventory Management
- [ ] Configure ERPNext Stock module for ABF
- [ ] Item categories (supplies, equipment, donated goods)
- [ ] Warehouses (main office, field locations)
- [ ] Stock reconciliation workflow
- [ ] Donation inventory tracking (received as donation → utilized)
- [ ] Low-stock alerts and reorder levels
- [ ] Purchase order and procurement workflow
- [ ] Inventory reports

#### Week 7–8: Donor & Membership Management
- [ ] Configure ERPNext CRM for donor database
- [ ] Donor profile (contact, donation history, PAN, 80G eligibility)
- [ ] Donation entry forms (online, bank, UPI, cash)
- [ ] Automated 80G receipt PDF generation
- [ ] Donor segmentation (amount tiers, frequency, category)
- [ ] Campaign tracking (fundraising campaigns, success metrics)
- [ ] Membership plans (annual, lifetime, corporate)
- [ ] Membership renewal workflow + automated reminders
- [ ] Member portal setup (self-service dashboard)

---

### Phase 3 — Advanced Modules & Reporting (Weeks 9–12)

#### Week 9–10: Partnerships & Events
- [ ] Partner database (corporates, NGOs, government agencies)
- [ ] Partnership agreement tracking (terms, deliverables, timelines)
- [ ] Collaboration log (joint events, projects)
- [ ] Event creation and management
- [ ] Online event registration form
- [ ] Event budgeting and expense tracking
- [ ] Attendance tracking and post-event reports

#### Week 11–12: Reports, Analytics & Dashboards
- [ ] **Finance Dashboard:** Total donations, expenses, balance, cash flow
- [ ] **Donor Dashboard:** New donors, recurring donors, donation trends
- [ ] **Case Dashboard:** Open/closed/overdue, resolution time, category breakdown
- [ ] **Beneficiary Dashboard:** Demographics, support impact, outcomes
- [ ] **Membership Dashboard:** Active members, renewals, growth
- [ ] **Inventory Dashboard:** Stock levels, utilization, procurement status
- [ ] Custom report builder for ad-hoc queries
- [ ] Data export: PDF, Excel, CSV for all reports
- [ ] Scheduled automated report emails to management

---

### Phase 4 — Website Integration (Weeks 13–16)

#### Integration Points (Astro.js ↔ ERPNext REST API)

| Website Feature | ERPNext API Action |
|----------------|-------------------|
| Donation form submission | Create Donor + Donation record |
| Case submission form | Create Case record |
| Donor portal login | Sync donor profile + history |
| Member portal | Sync membership status |
| Event registration | Create event attendee record |
| Razorpay webhook | Auto-confirm donation in ERPNext |

- [ ] ERPNext API token setup (secure key-based auth)
- [ ] Donation webhook bridge (Razorpay → ERPNext)
- [ ] Case submission API endpoint
- [ ] Donor/Member portal API endpoints
- [ ] Event registration sync
- [ ] Real-time donation counter (ERPNext → website)
- [ ] SSL & CORS configuration for cross-origin API calls

---

## 🔒 Security & Compliance

- [ ] Role-based access control (staff only see what they need)
- [ ] Two-factor authentication (2FA) for admin accounts
- [ ] HTTPS everywhere (Let's Encrypt SSL)
- [ ] Daily automated backups (DigitalOcean Spaces / S3)
- [ ] Fail2ban brute-force protection
- [ ] UFW firewall (only ports 22, 80, 443 open)
- [ ] GDPR/data protection — PII fields encrypted at rest
- [ ] Audit trail for all financial transactions

---

## 💰 Cost Estimate

### One-Time Setup Costs
| Item | Cost |
|------|------|
| DigitalOcean Droplet setup & configuration | Included |
| ERPNext installation & core config | Included |
| Custom Frappe App: Case Management | Included |
| Custom Frappe App: Beneficiary Management | Included |
| ERPNext module configuration (all 10 modules) | Included |
| Website API integration | Included |
| Testing & QA | Included |
| Staff training documentation | Included |

### Monthly Running Costs
| Item | Cost |
|------|------|
| DigitalOcean Droplet (4vCPU/8GB) | ~₹4,000/month |
| DigitalOcean Spaces (backups) | ~₹200/month |
| Domain renewal (annual / 12) | ~₹100/month |
| **Total Monthly** | **~₹4,300/month** |

---

## 📋 What We Need From You

Before we can start, please provide:

1. **Domain name** — Which domain/subdomain for the ERP? (e.g., `erp.activebengaluru.org`)
2. **DigitalOcean account** — Create a free account at digitalocean.com and share API token OR add a payment method so we can provision the server
3. **Organization details** for ERPNext setup:
   - GSTIN
   - PAN number
   - 80G / 12A registration numbers
   - Official address
   - Authorized signatory name
4. **Admin email** — Email address for the ERPNext super-admin
5. **DNS access** — Access to your domain's DNS settings to point the subdomain to the new server

---

## ✅ Deliverables

At the end of this project, ABF will have:

1. 🌐 **Live ERPNext** accessible at your domain (e.g., `erp.activebengaluru.org`)
2. 📦 **All 10 modules** configured and ready to use
3. 🔧 **2 custom Frappe apps** — Case Management & Beneficiary Management
4. 🔗 **Website integration** — Astro.js website connected to ERPNext via API
5. 🔒 **SSL-secured** with daily automated backups
6. 📖 **Admin user manual** for staff
7. 🎓 **Training session** for your team
8. 🛠️ **Post-launch support** for 30 days

---

> **Please provide the domain name and DigitalOcean account details to proceed.**
> Approve this plan to begin Phase 1 immediately.
