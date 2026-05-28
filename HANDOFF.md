# Florida Signal Grok Sandbox Cockpit — HANDOFF GUIDE

**Status:** Sandbox-only. All data is local JSON or synthetic mock. No production systems are connected.

**Date:** 2026-05-28  
**Location:** `florida-signal-cloud/dashboard/`

---

## What This Cockpit Is

A self-contained, operator-grade, truth-driven static web application (single `index.html` + local JSON files) that serves as:

- A **command center** for understanding the current state of Florida permit data in the sandbox.
- A **source roadmap and safety gate** for future cloud ingestion work.
- A **handoff artifact** designed so a new reviewer (human or AI) can understand the project, its maturity, real vs mock data, and the exact next safe steps in under 10 minutes.
- A **living demonstration** of strict boundary discipline, progressive disclosure, and honest labeling of stubs/frozen components.

It was built through a series of explicitly approved sandbox sprints with zero production impact.

---

## What This Cockpit Is NOT

- Not a production system
- Not connected to any live data sources
- Not running any scrapers, enrichment, scoring, or FAST pipelines
- Not a replacement for the main Florida Signal product
- Not authorized for live adapter execution (see "NOT APPROVED" markers everywhere)

---

## How to Run Locally

1. `cd florida-signal-cloud/dashboard`
2. `python3 -m http.server 8000` (or any static server)
3. Open `http://localhost:8000`

All data is served from sibling `data/*.json` files. No build step. No dependencies.

---

## File Map (High Level)

- `index.html` — The entire application (one large but well-organized file)
- `data/` — All runtime data (see DATA_REALITY_MATRIX.md and FILE_MAP.md)
- `reference/` — Read-only Claude audit documents (9 files copied from permit-scraper/docs)
- `*.md` — Documentation (this file + others created in the handoff sprint)

See `FILE_MAP.md` for the detailed artifact inventory.

---

## Pages / Tabs Overview

- **Overview** — Executive summary. 6 compact key metrics + Operator Brief + Today's Watchlist + Recommended Action CTAs. Answers: "What matters today?"
- **Pipeline** — Health of all data lanes with honest STUB/PLACEHOLDER labels.
- **Permits Explorer** — Filterable table with quick drawer + prominent "Open Full Case File" CTA.
- **Enrichment** — Time windows, source matching performance, coverage bars, actionable cleanup queues that filter the Permits table.
- **Sources** — 5-section inventory (Live/Implemented, Partial, Planned High-Value, Future/Research, Frozen) driven by `source_roadmap.json`.
- **Ingestion** — Governance hub: Recommended Build Order, Adapter Test Harness, Preflight Checklist (10 gates), and the new Next Phase Decision Board.
- **Exports** (Reports tab) — Live CSV/JSON exports + preview + manifest from current filtered state. XLSX/AI/PDF intentionally stubbed.
- **System** — Boundary status, known stubs, now includes the new Handoff Package section.

All tabs follow the "one page = one question" discipline.

---

## Source Roadmap Summary

`data/source_roadmap.json` is the single source of truth for 29 documented sources (including logical splits).

Each source records:
- status, adapter_type, risk_level, signal_value, build_cost
- fields_available vs fields_captured
- known_gaps, dependencies, first_safe_test, hard_boundaries
- reference_docs (pointing into the 9 Claude audits)

See the 5-section Sources page for the visual breakdown.

---

## Ingestion Architecture Summary

`CLOUD_INGESTION_ARCHITECTURE.md` + the Ingestion tab define the safety model:

- Adapter contract v0.2
- Mandatory mock harness before any live work
- 10-gate Preflight Checklist (visible on page)
- Autonomy Ladder (12 stages — see the architecture doc)
- Current reality: We are at Stage 1 (Mock adapter harness only)

---

## Mock Adapter Harness Summary

6 sources have complete passing mock runs in `data/mock_runs/`:

- FDEP ERP (recommended first future candidate)
- Broward Official Records / NOC
- Broward BCS
- Accela Detail
- BCPA Property Card
- Sunbiz

Every run guarantees:
- `mode: "mock"`
- `no_write_guarantee: true`
- `live_calls_performed: false`

Validated against `adapter_test_contract.schema.json`. Results aggregated in `adapter_test_results.json`.

The harness is the mandatory gate. Nothing bypasses it.

---

## Full Case File Summary

9-tab dedicated full-screen view (opened from the quick drawer):

1. Snapshot
2. Permit
3. Owner & Parcel
4. Contractor & Sunbiz
5. BCPA Property Card
6. Broward Clerk / BCRM
7. Accela Detail
8. Provenance
9. Raw Row (collapsed accordion)

Uses status pills (PRESENT / MISSING / STUB / STALE / UNKNOWN) and source badges. Rich fields are intentionally excluded from Overview and main table to keep the executive view calm and scannable.

See `OLD_COCKPIT_FIELD_IMPORT_REPORT.md` for exactly what was ported vs deferred.

---

## Export / AI Packet Summary

- CSV and JSON: Fully live from the current filtered Permits Explorer state + manifest.
- XLSX, AI Packet, PDF: Explicitly stubbed (intentional).
- All exports include provenance, stale warnings, and source fingerprints.

The "packet-first" future workflow (export → Grok trigger → offline scoring → re-import) is documented but not executed.

---

## Known Stubs & Limitations

- Signals tab: FROZEN / prototype data only (red banners everywhere)
- Supabase / Truth Audit / Backup lanes: Honest STUB / PLACEHOLDER
- Rich BCPA sales/tax/flood history, detailed Clerk liens/NOC, full Accela workflow/inspections: Limited or absent in current `permits_sample.json`
- Many high-value sources (FDEP, Clerk, BCS, FAA, RealAuction, etc.): Planned only — have mock runs or roadmap entries but no live execution path
- Exports beyond CSV/JSON: Stubbed
- Grok Trigger: Simulated only

All of the above are loudly labeled in the UI.

---

## Known Risks

- `index.html` is still a large single file (maintainability debt)
- Sample data (`permits_sample.json`) is limited — Full Case File tabs look structurally complete but are data-thin on several sources
- Three mock runs reference files in `mock_adapters/` that are not yet present (harness completeness gap)
- Minor doc inconsistencies (source_roadmap meta count vs actual entries)
- The Autonomy Ladder and parser-cleaner flow are documented but not yet exercised beyond mock stage

---

## Hard Boundaries (Non-Negotiable)

- No live calls of any kind
- No scraping
- No writes to any production system or Supabase
- No credentials or secrets
- No FAST, enrichment, scoring, or signal generation
- No promotion of mock data into canonical tables
- Every future live adapter must pass the full mock harness + explicit human approval

These boundaries are repeated in banners, cards, and docs throughout the cockpit.

---

## Recommended Next Steps (Ranked)

See the "Next Phase Decision Board" on the Ingestion tab for the current official options.

High-level order of operations (all still sandbox-only):

1. Complete handoff documentation package (this sprint).
2. Code review / Codex-style audit of the current state.
3. Small refactor of `index.html` for maintainability (after review).
4. Expand mock parser-cleaner scaffolding (docs + synthetic examples only).
5. First explicit approval request for FDEP ERP dry-run (future sprint — currently NOT APPROVED).

---

## What Must NOT Be Done Yet

- Do not write any live adapter code (even "just a fetch wrapper").
- Do not attempt autonomous Accela scraping (explicitly NOT RECOMMENDED YET — high risk, high boundary).
- Do not run real parsers or cleaners against live sources.
- Do not remove any "NOT APPROVED", "FROZEN", or "STUB" labels.
- Do not add real credentials or point at production endpoints.
- Do not deploy anything outside this sandbox folder.
- Do not treat mock harness data as production truth.

**Current maturity level:** Excellent sandbox governance and handoff readiness. Still at Stage 1 of the Autonomy Ladder (Mock adapter harness only).

**Containment status (as of this recovery):** 
TEMPORARY SANDBOX UI RECOVERY — Tailwind CDN has been restored to make the dashboard usable again after the local-CSS containment attempt caused severe visual + perceived data regression. 
The app is NOT claiming full self-containment while in recovery mode. A future sprint will re-address proper local styling once the cockpit is verifiably working.

---

**End of HANDOFF.md** — A new reviewer should now be able to understand the project, its boundaries, and the exact safe next step in under 10 minutes.