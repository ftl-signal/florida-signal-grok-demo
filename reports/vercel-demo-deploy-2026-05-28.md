# Vercel Demo Deployment Handoff
## Florida Signal Grok Cloud Dashboard — Safe Public Demo Shell

**STARTED:** Thursday, May 28, 2026, 6:07 PM EDT  
**ENDED:** Thursday, May 28, 2026, 6:18 PM EDT

---

## Deployment Details

| Field | Value |
|---|---|
| GitHub repo |  |
| Vercel project |  |
| Vercel team |  (Hobby / Free) |
| Live URL | https://florida-signal-grok-demo-in40l0qc2-ftl-signals-projects.vercel.app |
| Branch |  |
| Framework | Other (static site — no build step) |
| Build command | *(empty)* |
| Output directory |  |

---

## Data Classification

**DEMO / SYNTHETIC DATA ONLY.**

- All 30 permits use  prefix (e.g. )
- All addresses are clearly fake (e.g. , )
- No real Florida Signal permits, owners, companies, parcels, or parcel IDs
- No real Broward County production data of any kind
- All metrics are synthetic numbers generated for visual fidelity
- No Supabase connection — all data loads from static relative  files
- No environment variables required or set
- No live API calls at runtime (CDN-only: Google Fonts, Tailwind, Chart.js)

---

## Safety Scan Results — ALL PASS

| Check | Result |
|---|---|
| Supabase URL / keys | CLEAN |
| service_role / JWT tokens | CLEAN |
| /Users/gillfillan/permit-scraper path | CLEAN |
| /ops route | CLEAN |
| Non-DEMO permit numbers in deployed files | CLEAN (mock_runs/ excluded via .vercelignore) |
| Real addresses / owners / parcel IDs | CLEAN |
| In-browser page source check (post-deploy) | ALL CLEAR |

---

## What Was NOT Touched

-  — untouched
- Production Vercel project  /  — untouched
- Supabase, DB, launchd, plists, wrappers, FAST, enrichment, sync, parity, signal, scoring — none touched
- No production Mac repo modified

---

## Final Verdict: PASS

The deployment surface is clean. Public visitors see only synthetic demo data behind a persistent orange banner:

> DEMO MODE — SAMPLE DATA ONLY — No real permits, owners, companies, parcels, or Florida Signal production data. Static synthetic preview for evaluation. SAFE PUBLIC PREVIEW

---

## Tomorrow's Required Next Step

**Before connecting any real data:** enable Vercel password protection or preview-only access on this project.

Do not hook up real Supabase, real permit data, or any production source to this deployment until:
1. Vercel protection (password or Vercel Auth) is active on 
2. Auth + RLS is hardened on the Supabase side
3. Explicit approval recorded for that sprint

Real data waits until the lock-down gate is confirmed.
