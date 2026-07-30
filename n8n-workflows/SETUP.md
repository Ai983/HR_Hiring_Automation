# HireFlow Automation Setup Guide — n8n Workflows

## Overview

Eight automation workflows are ready to import into your n8n instance at:
**https://primary-production-72e3f.up.railway.app**

| # | Workflow file | What it does | Status |
|---|---|---|---|
| 1 | `gmail-resume-collector.json` | Watches careers@hagerstone.com, auto-adds applicants | Ready — needs Gmail OAuth2 credential |
| 2 | `whatsapp-resume-collector.json` | Receives Maytapi webhooks, auto-adds WhatsApp CVs | Ready — activate webhook in Maytapi |
| 3 | `03-acknowledgement.json` | Sends WhatsApp ack to every new applicant automatically | Ready — needs Supabase DB webhook |
| 4 | `04-meta-ads.json` | Posts new jobs to Facebook Page + Instagram | Waiting for your Meta credentials |
| 5 | `05-callback-reminder.json` | Reminds HR every 30 min about due callback calls | Ready — set HR_WHATSAPP_NUMBER variable |
| 6 | `06-call-retry.json` | WhatsApps candidates who didn't pick up, every 4 hours | Ready — activate when calling pipeline starts |
| 7 | `07-doc-reminder.json` | Sends doc submission reminders to joiners every 2 days | Ready — activate when first joiner added |
| 8 | `08-probation-reminder.json` | Daily HR alert for probations ending within 30 days | Ready — set HR_WHATSAPP_NUMBER variable |

---

## ONE-TIME SETUP: Run the Supabase Migration First

Before activating ANY workflow, run this in Supabase SQL editor:

1. Go to: **https://supabase.com/dashboard/project/sgerslbmnwrltqrhsdir/sql**
2. Paste and run the contents of `../supabase/schema-phase2.sql`

This creates the `call_logs`, `interviews`, `references`, `offers`, `joinings`, and `documents` tables that all the new workflows depend on.

---

## STEP 1 — Import All 8 Workflows

1. Open your n8n: **https://primary-production-72e3f.up.railway.app**
2. Click **Workflows** → **Import from file**
3. Import each `.json` file one by one
4. Do NOT activate yet — configure credentials first

---

## STEP 2 — Set n8n Environment Variables

Go to **Settings → Variables** in n8n and add:

| Variable | Value | Used by |
|---|---|---|
| `HR_WHATSAPP_NUMBER` | `91XXXXXXXXXX` (HR's number with country code) | Workflows 5, 8 |
| `FACEBOOK_PAGE_ID` | Your Facebook Page ID | Workflow 4 |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Long-lived page access token | Workflow 4 |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Instagram Business Account ID | Workflow 4 |
| `HAGERSTONE_LOGO_URL` | Public URL to company logo image (800×800px) | Workflow 4 |

---

## STEP 3 — Gmail Resume Collector (Workflow 1)

### 3A. Configure Gmail OAuth2 Credential in n8n

1. In n8n: **Credentials** → **New Credential** → search **Gmail OAuth2**
2. Set:
   - **Client ID:** `YOUR_GMAIL_OAUTH_CLIENT_ID`
   - **Client Secret:** `YOUR_GMAIL_OAUTH_CLIENT_SECRET`
3. Click **Sign in with Google** → authenticate with **careers@hagerstone.com**

### 3B. Add Authorized Redirect URI in Google Cloud Console

1. Go to: **https://console.cloud.google.com/apis/credentials**
2. Open your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, add:
   ```
   https://primary-production-72e3f.up.railway.app/rest/oauth2-credential/callback
   ```
4. Save

### 3C. Connect credential + Activate

1. Open **Hagerstone — Gmail Resume Collector** workflow
2. Click the **Gmail — New Email (careers inbox)** node
3. Select the Gmail OAuth2 credential
4. Toggle workflow to **Active**

---

## STEP 4 — WhatsApp Resume Collector (Workflow 2)

### 4A. Configure Webhook in Maytapi Dashboard

1. Log in to **https://app.maytapi.com**
2. Go to **Products** → product `b8cce1b9-0f9f-4aef-994c-d232716471f0`
3. Go to **Settings** → **Webhook**
4. Set webhook URL to:
   ```
   https://primary-production-72e3f.up.railway.app/webhook/maytapi-resume
   ```
5. Enable events: **message**
6. Save
7. Activate the workflow in n8n

---

## STEP 5 — New Applicant Acknowledgement (Workflow 3)

### 5A. Create Supabase Database Webhook

1. Go to: **https://supabase.com/dashboard/project/sgerslbmnwrltqrhsdir/database/hooks**
2. Click **Create a new hook**
3. Configure:
   - **Name:** `new_applicant_ack`
   - **Table:** `applicants`
   - **Events:** `INSERT`
   - **Type:** `HTTP Request`
   - **URL:** `https://primary-production-72e3f.up.railway.app/webhook/new-applicant`
   - **Method:** POST
4. Save

### 5B. Activate Workflow 3 in n8n

Toggle **Hagerstone — New Applicant Acknowledgement** to **Active**.

**What happens:** Every time a new applicant is added (manually, via email, or via WhatsApp), they get an instant WhatsApp acknowledgment from Hagerstone's number.

---

## STEP 6 — Callback & Retry Reminders (Workflows 5 & 6)

1. Make sure `HR_WHATSAPP_NUMBER` variable is set (Step 2)
2. Activate **Hagerstone — Callback Reminder** → reminds HR every 30 min
3. Activate **Hagerstone — Call Retry** → auto-WhatsApps candidates every 4 hours

---

## STEP 7 — Document & Probation Reminders (Workflows 7 & 8)

1. Make sure `HR_WHATSAPP_NUMBER` variable is set (Step 2)
2. Activate **Hagerstone — Document Submission Reminder** → pings joiners every 2 days
3. Activate **Hagerstone — Probation End Reminder** → daily HR alert at 9 AM IST

---

## STEP 8 — Facebook & Instagram Job Poster (Workflow 4)

Wait until you have Meta credentials, then:

1. Set all 4 Meta variables in n8n (Step 2)
2. Open the **Hagerstone — Job Posting Meta Ads** workflow
3. Toggle to **Active**

**Then:** When you post a job in HireFlow and tick Facebook/Instagram as portals, Supabase fires a webhook → n8n posts automatically.

### Meta credentials to gather:

| Variable | Where to get |
|---|---|
| `FACEBOOK_PAGE_ID` | Facebook Page → About → Page ID |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Graph API Explorer → select your page → generate long-lived token with `pages_manage_posts` permission |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Meta Business Manager → Instagram Account → Account ID |
| `HAGERSTONE_LOGO_URL` | Upload company logo (800×800px) to Supabase Storage or any CDN → copy public URL |

---

## Architecture Summary

```
Candidate emails CV to careers@hagerstone.com
  → Workflow 1 (Gmail, every 1 min)
  → Extract name/email/phone → Insert applicant (portal=email)
  → AI Screening → Appears in HireFlow dashboard

Candidate sends PDF on WhatsApp
  → Workflow 2 (Maytapi webhook → n8n immediately)
  → Download media → Upload to Supabase Storage
  → Insert applicant (portal=whatsapp)
  → Appears in HireFlow dashboard

New applicant saved (any source)
  → Workflow 3 (Supabase DB webhook → n8n)
  → Instant WhatsApp ack to candidate

HR posts job with Facebook/Instagram ticked
  → Workflow 4 (Supabase DB webhook → n8n)
  → Auto-post to Facebook Page + Instagram

HR logs call with "Callback Requested"
  → Workflow 5 (every 30 min schedule)
  → WhatsApp summary to HR for all due callbacks

Candidate doesn't pick up call
  → Workflow 6 (every 4 hours schedule)
  → WhatsApp to candidate: "We tried calling..."

Joiner has pending documents
  → Workflow 7 (every 2 days, 9 AM IST)
  → WhatsApp reminder directly to joiner

Employee probation ending in ≤30 days
  → Workflow 8 (daily, 9 AM IST)
  → WhatsApp summary to HR for all due reviews
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Gmail workflow not triggering | Check OAuth credential is connected; verify redirect URI added in Google Cloud |
| WhatsApp messages not appearing | Check Maytapi webhook URL; check n8n Executions for error |
| Ack not sending | Verify Supabase DB webhook URL is correct; check applicants have phone numbers |
| "job_id violates not-null constraint" | No jobs exist yet — create at least one job in HireFlow first |
| Meta 190 error (invalid token) | Page Access Token expired — regenerate in Graph API Explorer |
| Callback reminder not sending | Check `HR_WHATSAPP_NUMBER` variable is set; check `call_logs` table exists (run schema-phase2.sql) |
| Probation reminder not sending | Check `joinings` table exists; verify probation_end_date is populated when onboarding starts |

---

## n8n & Supabase Reference

- **n8n URL:** https://primary-production-72e3f.up.railway.app
- **Webhook base:** https://primary-production-72e3f.up.railway.app/webhook/
- **Supabase project:** sgerslbmnwrltqrhsdir
- **Supabase URL:** https://sgerslbmnwrltqrhsdir.supabase.co
- **Maytapi Phone ID:** 46821
- **Maytapi Product ID:** b8cce1b9-0f9f-4aef-994c-d232716471f0

---

## 2026-07-30 — Hub re-point

All workflows previously pointed at the **retired** project `sgerslbmnwrltqrhsdir`.
They now target the hub `tpfvnerrjhqwipyonngf`, where the HireFlow tables live in
the **`hr` schema** — not `public`.

Three things changed, and all three are required:

| Change | Why |
|---|---|
| URL → `https://tpfvnerrjhqwipyonngf.supabase.co` | old project is retired |
| `Accept-Profile: hr` on reads, `Content-Profile: hr` on writes | tables are in `hr`; without this PostgREST returns **404 `Could not find the table 'public.<x>'`** |
| **service-role** key, not anon | `hr` tables are RLS-protected — the anon key now returns 0 rows |

Swapping only the URL is not enough. Verified against the live hub: the same
query without `Accept-Profile: hr` 404s, and with the anon key returns 0 rows.

### Keys are no longer stored in this repo
The committed Supabase keys were replaced with `__HUB_SERVICE_ROLE_KEY__`.
Before importing any of these JSON files, replace that placeholder with the hub
service-role key — or better, attach the existing **"Supabase Hub"** n8n
credential (`httpHeaderAuth`) and drop the inline `apikey`/`Authorization`
headers, keeping only `Accept-Profile` / `Content-Profile`.

> The retired project's service-role key was previously committed here in
> plaintext. It has been removed, but treat it as leaked and **rotate/delete the
> old `sgerslbmnwrltqrhsdir` project** if it still holds candidate data.

### Status after the re-point

| Workflow | Live in n8n | Re-pointed | Still needs |
|---|---|---|---|
| 05 Callback Reminder | `CvdyAoacibs5gSnU` | ✅ | `HR_WHATSAPP_NUMBER` variable, then activate |
| 06 Call Retry | `KxB5dx74mGMZHl6P` | ✅ | activate |
| 07 Document Reminder | `67x8217oRM9Reme8` | ✅ | activate |
| 08 Probation Reminder | `5VZO3fRcbTL81cOd` | ✅ | `HR_WHATSAPP_NUMBER` variable, then activate |
| 03 Acknowledgement | `69yWeTv0vxkxqby3` | n/a — no DB node | a Supabase DB webhook on `hr.applicants` INSERT |
| Gmail Resume Collector | `1Renlvv0XqU68XN7` | repo JSON only | Gmail OAuth2 credential attached to the live workflow |
| WhatsApp Resume Collector | `Yq2faGHEcgLMz3gI` | repo JSON only | Maytapi inbound webhook |
| Facebook Job Poster / 04 Meta Ads | `Zn8pl2qdNa1kYac2` | repo JSON only | Meta app credentials |

All eight remain **inactive**. Activating them sends real WhatsApp messages to
real candidates, so that is a deliberate go-live step, not a config detail.
