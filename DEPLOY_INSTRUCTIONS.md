# Florida Signal Cloud — Safe Demo Deployment (Vercel Free Tier)

**CRITICAL: This is a PUBLIC DEMO with 100% SYNTHETIC DATA ONLY.**

No real permits, owners, contractors, parcels, addresses, or production data from Florida Signal are present or exposed.

---

## Pre-Deployment Checklist (COMPLETED)

- [x] All displayed data replaced with clearly fake "DEMO-*" records (30 synthetic permits + 8 signals)
- [x] dashboard_summary.json sanitized (Mac path removed, numbers scaled, explicit `demo_mode: true`)
- [x] time_windows / enrichment / coverage numbers scaled to demo size
- [x] Persistent top banner injected: "⚠ DEMO MODE — SAMPLE DATA ONLY — SAFE PUBLIC PREVIEW"
- [x] No Supabase keys, no service_role, no anon keys, no production URLs
- [x] All data loads via relative static fetch('data/*.json') — zero live API calls
- [x] No localhost / 127.0.0.1 dependencies in runtime code
- [x] No /Users/gillfillan paths or real DB references in runtime JSONs
- [x] Reference docs, broken HTML snapshots, and mock_runs excluded from intended deploy surface

---

## How to Deploy Today (Vercel Free / Hobby — Unpaid)

### Recommended: Import via Vercel Dashboard (fastest, no CLI)

1. Go to https://vercel.com/new
2. Click "Import Third-Party Git Repository" **or** connect your Git provider.
3. **IMPORTANT — Set Root Directory:**
   - If importing the full monorepo: set **Root Directory** = `florida-signal-cloud/dashboard`
   - Or: create a new repo containing ONLY the contents of `florida-signal-cloud/dashboard/` and import that.
4. Framework Preset: **Other** (or leave blank)
5. Build Command: **leave empty** (or type `echo "static demo"`)
6. Output Directory: **leave as `.`** (or `.`)
7. Deploy.

Vercel will instantly serve the static files. The site is pure HTML + Tailwind CDN + Chart.js (via CDN) + static JSON.

### Alternative: Vercel CLI (one-time)

```bash
cd florida-signal-cloud/dashboard

# Install Vercel CLI once
npm i -g vercel

# Login (free account)
vercel login

# Deploy (first time — follow prompts, set root to current dir)
vercel --prod
```

Subsequent deploys from the dashboard folder: just `vercel --prod`.

---

## Post-Deploy Verification (do this immediately after first deploy)

1. Open the live URL.
2. Confirm the **orange DEMO MODE banner** is visible at the very top (fixed).
3. Click around all tabs (Overview, Permits, Enrichment, etc.).
4. Open a permit from the Permits table — drawer should populate with DEMO- prefixed data and "MISSING IN CURRENT ROW" pills where expected.
5. Check the hero "17 new permits" (demo number) + the 5 metric % rows.
6. In browser DevTools Console: confirm **zero** 404s on data/*.json and **no** CORS or network errors to external APIs (except Google Fonts / Tailwind CDN on first load).
7. View Page Source — search for "1724 NE" or real permit patterns — should return zero matches.

---

## Tomorrow's Lock-Down Checklist (when real data path is approved)

- [ ] Move this demo to a password-protected or Vercel preview-only deployment (or delete public instance).
- [ ] Introduce real data via a **separate private** deployment (or feature-flagged behind auth).
- [ ] Add proper Supabase (or other) connection **only** after:
  - Auth + RLS hardened
  - Row-level redaction for PII
  - Rate limiting + logging
  - Legal / compliance sign-off
- [ ] Replace synthetic JSONs with server-generated static export (see earlier Static Export + Strong Metadata proposal).
- [ ] Add build step (optional) for fingerprinting + SRI if scaling.
- [ ] Set up custom domain + HTTPS enforcement + security headers beyond the basic ones in vercel.json.
- [ ] Remove or heavily gate the "Ingestion Plan", "System", and full-case-file tabs for public visitors.

---

## Files That Are Safe to Deploy

**Core (must include):**
- index.html
- css/styles.css
- js/ (all 11 files + components/)
- data/ (the 12 sanitized JSONs + txt we use at runtime)
- assets/florida-signal-logo.png
- vercel.json

**Safe to omit (recommended for smaller + cleaner deploy):**
- All *.md except this DEPLOY_INSTRUCTIONS.md
- reference/
- test/
- mock_adapters/ + mock_runs/
- *.broken_after_*.html
- BUILD_REPORT*.md, DATA_REALITY_MATRIX.md, etc.

Vercel will still work if you include everything — the extra files are just not requested by the browser.

---

## Known Limitations of This Demo

- All "signals", "enrichment %", "coverage" are invented for visual fidelity.
- Full Case File tabs beyond basic Overview will show many "MISSING IN CURRENT ROW" / STUB labels (by design — this snapshot has limited synthetic depth).
- No live data refresh. Timestamp in header is client-side only.
- Export buttons are stubs (client-side only, no real files generated beyond browser download).

This is intentionally a **boringly honest** public preview shell.

---

**Status:** Ready for safe unpaid Vercel deploy today.  
**Data classification:** SYNTHETIC DEMO ONLY.  
**Next gate:** Tomorrow — lock-down before any real data connection.

Generated: 2026-05-28 (per task).
