# Florida Signal Grok Cockpit — REVIEW CHECKLIST

**Purpose:** A living checklist for any future reviewer (human, Codex, Claude, or Andy) to validate the state before the next phase.

**Use:** Go through each section. Mark what is solid vs what needs attention.

---

## 1. UI Review Checklist

- [ ] All major sections answer exactly one clear question (Overview, Pipeline, Permits, Enrichment, Sources, Ingestion, Exports, System)
- [ ] Overview is scannable in <10 seconds (6 compact metrics + Operator Brief + Watchlist + 3 CTAs)
- [ ] Progressive disclosure is respected (rich fields hidden from Overview/main table, only in Full Case File)
- [ ] Every STUB, FROZEN, PLACEHOLDER, and NOT APPROVED is visually loud (red/amber pills, banners)
- [ ] No walls of text or giant low-content cards
- [ ] Cleanup queues in Enrichment actually filter the Permits table
- [ ] Full Case File 9-tab is accessible and well-structured (Snapshot short cards + status pills + source badges)
- [ ] Ingestion tab surfaces the governance layer first (Recommended Build Order, Harness, Preflight Checklist, Decision Board)
- [ ] No horizontal overflow or cramped grids on normal viewport
- [ ] Focus Mode (if present) still works cleanly

**Current status:** Strong. Minor debt remains in monolithic index.html.

---

## 2. Data / Provenance Checklist

- [ ] Every KPI and health state is driven from `dashboard_summary.json` (or clearly labeled otherwise)
- [ ] Stale warnings are visible and attached to the affected numbers (geocode)
- [ ] Source filenames and generated_at timestamps appear on metric cards and lanes
- [ ] Classification legend (PROVEN / PROBABLE / STALE / UNKNOWN / BLOCKED) is present and used
- [ ] No production numbers are presented as live or current

**Current status:** Excellent discipline.

---

## 3. Full Case File Checklist

- [ ] 9 tabs exist and match the spec (Snapshot, Permit, Owner & Parcel, Contractor & Sunbiz, BCPA, Clerk, Accela Detail, Provenance, Raw)
- [ ] Status pills (PRESENT/MISSING/STUB/STALE/UNKNOWN) are used consistently
- [ ] Source badges are present
- [ ] "What this means" notes exist where useful
- [ ] Rich fields are excluded from Overview (intentional)
- [ ] Raw Row is collapsed by default
- [ ] "Open Full Case File" CTA is prominent in the quick drawer

**Current status:** Structurally complete. Data depth limited by sample.

See `OLD_COCKPIT_FIELD_IMPORT_REPORT.md` for exact port status.

---

## 4. Source Roadmap Checklist

- [ ] `source_roadmap.json` exists and is the single source of truth
- [ ] Every listed source from the Claude audits is present (Accela family, BCPA family, Sunbiz, Clerk, FDEP, BCS, FAA, etc.)
- [ ] Each source has the 14 required attributes (including status, risk_level, first_safe_test, hard_boundaries, reference_docs)
- [ ] Sources page shows the 5 correct sections
- [ ] Hard boundaries and "NOT APPROVED" language are visible

**Current status:** Complete (29 entries after normalization).

---

## 5. Adapter Safety / Mock Harness Checklist

- [ ] `data/mock_runs/` exists with files for at least the 6 priority sources
- [ ] Every mock run contains all 17 required fields
- [ ] Every run has `mode: "mock"`, `no_write_guarantee: true`, `live_calls_performed: false`
- [ ] `adapter_test_contract.schema.json` exists and is referenced
- [ ] `adapter_test_results.json` exists and correctly summarizes pass/fail + recommended next
- [ ] Adapter Test Harness panel on Ingestion tab is live and accurate
- [ ] 10-gate Preflight Checklist is visible and emphasizes the two red items (human approval + no promotion)
- [ ] FDEP ERP is marked as recommended first future candidate but clearly NOT APPROVED

**Current status:** Solid for 6 sources. 3 referenced sample files in mock_adapters/ are still missing.

---

## 6. Export Safety Checklist

- [ ] CSV and JSON exports are live from filtered state + include manifest
- [ ] XLSX, AI Packet, PDF are explicitly labeled STUB
- [ ] Manifest includes source_files, row_count, stale_warnings, fingerprint
- [ ] No claim is made that AI packets or scoring are currently functional

**Current status:** Correct and intentional.

---

## 7. Production-Boundary Checklist

- [ ] Every page and doc repeats the hard prohibitions (no live calls, no scraping, no Supabase writes, no production DB)
- [ ] System tab clearly lists "Hard prohibitions"
- [ ] No credentials, .env files, or production endpoints referenced
- [ ] No code paths that could accidentally make network calls to real sources
- [ ] All "live" language in UI refers only to client-side filtering/exports from local JSON

**Current status:** Very strong.

---

## 8. Code-Quality Checklist (for future reviewers)

- [ ] `index.html` is the only runtime file (acceptable for now, but noted as debt)
- [ ] Major sections have clear HTML comments
- [ ] Render functions are reasonably named and grouped
- [ ] No obvious duplication that would confuse a new developer
- [ ] Global state surface (window.*) is documented or minimal
- [ ] No hidden dependencies or build steps required to run

**Current status:** Acceptable for a sandbox. Refactoring recommended after code review.

---

## 9. Questions for Codex / Claude / Human Review

1. Is the monolithic `index.html` becoming a maintenance risk? What is the lowest-friction way to improve it while staying zero-dependency?
2. Are the 9 Full Case File tabs the right final shape, or should any be merged/split?
3. Does the Autonomy Ladder (12 stages) in the architecture doc feel complete and correctly staged?
4. Is the distinction between "mock harness data" and "real snapshot data" clear enough for a new engineer?
5. Are there any "quiet" assumptions in the current sample that could mislead future work (e.g., owner_name sparsity, finalized_date 0%)?
6. What is the smallest set of synthetic data we should add to make the Full Case File tabs feel convincingly rich without violating sandbox rules?
7. Is Accela autonomous scraping still correctly marked as high-risk / NOT RECOMMENDED, or has the risk profile changed?
8. Does the handoff package (HANDOFF + DATA_REALITY_MATRIX + REVIEW_CHECKLIST + FILE_MAP) allow a competent reviewer to be dangerous in <15 minutes?

---

**How to use this checklist going forward:**
- Print or copy into a new review issue before any major sprint.
- Mark items green/yellow/red.
- Any red item in the safety or boundary sections must be resolved before moving to the next Autonomy Ladder stage.

**Containment (current state after emergency recovery):** Tailwind CDN temporarily restored to recover usability after local-CSS sprint caused regression. Clearly marked as TEMPORARY SANDBOX UI RECOVERY in the UI and docs. Containment work paused until the cockpit is verifiably working again.

**End of REVIEW_CHECKLIST.md**