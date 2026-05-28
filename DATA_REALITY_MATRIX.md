# Florida Signal — DATA REALITY MATRIX

**Purpose:** Make it instantly obvious what can be trusted vs what is mock, stub, planned, or intentionally excluded.

**Date:** 2026-05-28  
**Context:** Sandbox only. All numbers and structures come from local JSON files.

---

## Legend

- **REAL (PROVEN)**: Directly observed in `dashboard_summary.json`, `permits_sample.json`, `enrichment_stats.json`, or `time_windows.json` from the READONLY snapshot.
- **MOCK**: Synthetically generated for the adapter test harness. Follows the contract but contains no live data.
- **STUB / PLACEHOLDER**: UI scaffolding or honest admission that the layer does not exist in this sandbox.
- **PLANNED / ROADMAP**: Documented in `source_roadmap.json` and the 9 Claude audits, but zero implementation in current data.
- **OLD CLAUDE REFERENCE**: Rich field knowledge from `reference/old_claude_cockpit/` and the 9 copied audits — used for design but not present in current sample.

---

## Core Data Files — Reality Level

| File                        | Reality Level | Notes |
|-----------------------------|---------------|-------|
| `dashboard_summary.json`    | REAL (PROVEN) | 115862 total permits, source mtime, stale geocode warning, classifications. Single source of truth for KPIs. |
| `permits_sample.json`       | REAL (subset) | 1000-row sample from the snapshot. Limited columns. |
| `enrichment_stats.json`     | REAL          | Source matching coverage numbers. |
| `time_windows.json`         | REAL          | Cohort performance by time window. |
| `source_roadmap.json`       | REAL (metadata) + PLANNED | 29 sources with full 14-attribute inventory. Statuses reflect audits + current snapshot. |
| `field_registry.json`       | REAL + STUB   | Core fields + ingestion_adapters section (some entries are future). |
| `adapter_test_results.json` | MOCK          | 6 passing mock runs. All `live_calls_performed: false`. |
| `mock_runs/*.json`          | MOCK          | 6 files. Follow contract. Some reference non-existent sample files in mock_adapters/. |
| `mock_adapters/*.json`      | MIXED         | 3 real example files (accela, bcpa, broward_clerk). Others referenced by harness do not yet exist. |

---

## Fields Present in Current Sample (REAL)

**Core (high confidence):**
- permit_number, status, applied_date, issued_date, description, permit_type, address (partial), contractor_name (56%), owner_name (very sparse on recent rows)
- source_accela, last_enriched_at, source_bcpa (partial), source_sunbiz (partial)

**Enrichment (measured):**
- BCPA match rate ~17% overall (much lower on newest rows)
- Sunbiz contractor match ~47%
- Geocoding: present but stale (last pull 2026-05-05 — 23+ days per dashboard_summary)

**Full Case File tabs that have real backing:**
- Snapshot, Permit, Owner & Parcel (basic), Contractor & Sunbiz (basic), Provenance

---

## Fields Known from Old Claude / Audits but MISSING from Current Sample

From `OLD_COCKPIT_FIELD_IMPORT_REPORT.md` + the 9 Claude audits:

- BCPA: just_value, sales history (5-row inline + dedicated table — only 26% coverage even on matched), tax history, flood zone, mailing address (critical for absentee owner analysis), legal description, neighborhood, voting precinct
- Accela Detail: rich workflow_json, conditions, documents, full inspections (current sample has junk rows), applicant details, valuation richer than CSV
- Broward Clerk: liens, NOC recordings, Lis Pendens, judgments — zero data in sandbox
- Accela Related Records / Subpermits: almost entirely in raw JSON, unparsed
- Owner resolution confidence + human verification workflow
- FAA OE/AAA crane/tall structure filings
- FDEP ERP environmental permits (dock, seawall, wetland)
- BCS: Unsafe Structure cases (with expired permit join), contractor CC licenses + status/void date, Certificates of Use (tenant turnover)

These exist in the reference audits and old cockpit but are **not present** in the current `permits_sample.json` or mock files.

---

## Fields Intentionally Excluded from Overview / Main Table

By design (to keep executive view calm and scannable <10s):

- All rich source-specific fields (BCPA just_value, Accela ASI/application_info key-values, detailed inspections)
- Owner resolution confidence scores and human-verify flags
- Raw JSON blobs
- Most provenance timestamps beyond the high-level badges
- Sales history, tax history, flood data

These are deliberately surfaced **only** inside the Full Case File 9-tab view.

---

## Planned-Only Sources (High Signal, Zero Current Data)

From `source_roadmap.json` + Claude audits (highest business value first):

1. **Broward Official Records / NOC** (bcftp SFTP) — Highest leverage per audits. ~260 NOCs/day + liens. Zero ingestion.
2. **FDEP ERP** — Clean public ArcGIS REST, strong leading indicator (5-6 weeks), small volume. Has mock run + recommended as first future dry-run candidate. Still NOT APPROVED.
3. **Broward BCS** (Unsafe Structure + contractor licenses + CUs) — High value, scrape-only (POSSE). Has mock run. High risk.
4. **FAA OE/AAA** — Crane/tall structure filings. Public REST + weekly CSV.
5. **RealAuction Foreclosure** — Distress signal.
6. **Broward AGOL / utility layers**, City meeting minutes, Conduits municipal liens, NAVD seawall compliance, Proximity/GIS scoring, Kepler.gl, Parallel AI Review, Weekly Signal Packet Generator — all roadmap only.

---

## What Can Be Trusted Right Now

- Total permit counts and basic freshness from `dashboard_summary.json`
- Relative coverage gaps (BCPA low, Sunbiz medium, Geocode stale)
- The existence and structure of the safety gates (harness, preflight checklist, hard boundaries)
- The 5-section source roadmap classification
- UI patterns and information architecture discipline

## What Must NOT Be Trusted

- Any absolute "production" numbers beyond the snapshot date
- Signals or scoring outputs (FROZEN)
- Supabase / backup lane health (STUB)
- Rich property or legal detail on individual permits (mostly missing or stubbed)
- Any assumption that mock harness data reflects live source behavior

---

**Bottom line:** The cockpit is an excellent **governance and planning artifact**. It is not yet a rich analytical dataset for most high-value secondary sources. The gap between "what the audits say exists in the real world" and "what is actually in the current sample" is large and intentionally documented.

**Containment note:** As of the emergency recovery sprint, Tailwind CDN has been temporarily restored because the prior local-CSS attempt made the dashboard unusable (layout collapse made data appear missing). Honest temporary relaxation of containment for usability. Will be re-addressed later.

See `source_roadmap.json` + the 9 files in `reference/data_source_inventory/` for the full external truth. Use the Full Case File tabs to see exactly what is currently wired.