# Florida Signal Grok Sandbox — FILE MAP

**Purpose:** A single source of truth for every important artifact in the cockpit, what it does, and how the pieces relate.

---

## Core Runtime

| File | Type | Purpose | Reality |
|------|------|---------|---------|
| `index.html` | HTML/JS/CSS (single file) | The entire cockpit application. All rendering, state, and interaction logic. | Real (the app) |
| `data/dashboard_summary.json` | JSON | Canonical source of truth for total permits (115862), snapshot metadata, metrics, stale warnings, and classification legend. | REAL (PROVEN) |
| `data/permits_sample.json` | JSON | 1000-row working sample used for tables, filtering, exports, and Full Case File examples. | REAL (sample) |
| `data/source_roadmap.json` | JSON | 29 sources with 14 attributes each. Single source of truth for Sources page and roadmap decisions. | REAL metadata + PLANNED status |
| `data/field_registry.json` | JSON | Field definitions + ingestion_adapters contract section. Used by Full Case File and Ingestion rendering. | REAL + future stubs |
| `data/enrichment_stats.json` | JSON | Source matching coverage numbers. | REAL |
| `data/time_windows.json` | JSON | Cohort performance by applied/issued date windows. | REAL |
| `data/adapter_test_results.json` | JSON | Summary of the 6 mock harness runs + recommended next safe source. | MOCK (but contract-compliant) |
| `data/adapter_test_contract.schema.json` | JSON Schema | Strict validation rules that every mock run must satisfy. | Contract definition |

---

## Mock Harness Data

| Location | Contents | Notes |
|----------|----------|-------|
| `data/mock_runs/` | 6 JSON files (one per source) | Complete mock execution records with all 17 required fields, `no_write_guarantee: true`, `live_calls_performed: false` |
| `data/mock_adapters/` | 3 real example files + references | `accela_raw_example.json`, `bcpa_raw_example.json`, `broward_clerk_mock.json`. Some harness runs reference additional files that do not yet exist here. |

---

## Documentation (Handoff Package)

| File | Purpose | Audience |
|------|---------|----------|
| `HANDOFF.md` | Primary onboarding document. What the cockpit is, is not, how to run, summaries of every major system, known stubs, hard boundaries, and what must NOT be done. | Any new reviewer (human or AI) |
| `DATA_REALITY_MATRIX.md` | Clear matrix of REAL vs MOCK vs STUB vs PLANNED data, fields present vs missing vs intentionally excluded, and what can actually be trusted. | Reviewers who need to understand data quality |
| `REVIEW_CHECKLIST.md` | 9-section living checklist (UI, data, Full Case File, roadmap, harness, exports, boundaries, code quality, review questions). | Future sprint reviews and external audits |
| `FILE_MAP.md` | This file. Artifact inventory and relationships. | Maintainers and handoff readers |
| `BUILD_REPORT.md` | Historical record of every approved sprint with exact files changed and verification statements. | Audit trail |
| `CLOUD_INGESTION_ARCHITECTURE.md` | Adapter contract, safety model, Autonomy Ladder (12 stages), parser-cleaner flow, and governance rules. | Anyone planning future ingestion work |
| `OLD_COCKPIT_FIELD_IMPORT_REPORT.md` | Exact record of what rich fields were ported into the Full Case File vs what was deferred or unavailable in the current sample. | Full Case File maintainers |

---

## Reference (Read-Only Claude Audits)

Location: `reference/data_source_inventory/`

The 9 copied documents (do **not** copy the 3 forbidden ones):

- `DATA_INVENTORY.md`
- `SOURCE_FIELD_AUDIT.md`
- `STRATEGIC_DEEP_RESEARCH_2026-05-10.md`
- `FDEP_ERP_AUDIT_2026-05-10.md`
- `BROWARD_BCS_AUDIT_2026-05-10.md`
- `BROWARD_LIENS_AUDIT_2026-05-10.md`
- `THREE_SOURCE_AUDIT_2026-05-10.md`
- `MISSING_FEEDS_BACKLOG.md`
- `WEEKLY_SIGNAL_PACKET_SCHEMA.md`

These are the authoritative external truth about what the real sources expose. The cockpit roadmap and harness are derived from them.

Also present at root level of the lab (outside the active cockpit):
- `reference/old_claude_cockpit/` — 5 original files used for the field-depth port (PERMIT_DETAIL_VIEW_FIELD_SPEC, render script, etc.)

---

## Other Notable Files

| File | Purpose |
|------|---------|
| `data/coverage_summary.json` | Supplementary coverage numbers |
| `data/freshness_snapshot.txt` | Quick human-readable freshness notes |
| `data/signals_sample.json` | Prototype/frozen signals data (explicitly not to be trusted) |

---

## Relationships & Data Flow (Simplified)

```
dashboard_summary.json
    ├── drives Overview KPIs, health banner, provenance strip
    └── feeds Pipeline and Enrichment calculations

permits_sample.json + enrichment_stats + time_windows
    ├── drives Permits Explorer table + filtering
    ├── drives Full Case File examples
    ├── drives live CSV/JSON exports + manifest
    └── feeds Watchlist and Recent Activity

source_roadmap.json
    └── drives the 5-section Sources page

field_registry.json
    └── drives Ingestion adapter cards + Full Case File field status

adapter_test_results.json + mock_runs/*.json
    └── drives the Adapter Test Harness panel

All of the above
    └── are referenced by the handoff documentation package (HANDOFF.md, DATA_REALITY_MATRIX.md, etc.)
```

---

## Quick Navigation for Common Questions

- "What can I actually trust?" → `DATA_REALITY_MATRIX.md`
- "Is it safe to add a new source?" → `REVIEW_CHECKLIST.md` (Adapter Safety section) + harness contract
- "What does the Full Case File actually contain today?" → `OLD_COCKPIT_FIELD_IMPORT_REPORT.md` + the 9 tabs in the UI
- "Where are we on the path to live adapters?" → Ingestion tab (Autonomy Ladder in architecture doc + Decision Board)
- "What must never be done?" → `HANDOFF.md` "What Must NOT Be Done Yet" + every red banner in the UI
- "What changed in the last sprint?" → Bottom of `BUILD_REPORT.md`

---

**This FILE_MAP.md + the four handoff documents (HANDOFF, DATA_REALITY_MATRIX, REVIEW_CHECKLIST, FILE_MAP) together should allow a competent reviewer to navigate the entire project in <10 minutes.**

**End of FILE_MAP.md**