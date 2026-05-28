# Cloud Ingestion Architecture (Sandbox Planning Document)

**Status:** Sandbox-only planning artifact. No live services, no production connections, no Supabase writes, no scraping.

**Date:** 2026-05-28  
**Purpose:** Prepare the Florida Signal cockpit and data model for future autonomous cloud ingestion from Accela, BCPA, Sunbiz, Broward Clerk/BCRM, geocode services, and owner resolution pipelines.

---

## 1. High-Level Architecture Goals

- **Autonomous & Resilient**: Ingestion should run on a schedule or be triggered, with built-in rate limiting, backoff, kill switches, and auditability.
- **Source-of-Truth Separation**: Raw snapshots are stored first. Parsed/normalized data is derived. Provenance is never lost.
- **Progressive Rollout**: Start with `mock` and `local` modes. Move to `live_future` only after safety gates.
- **ADHD-Friendly Observability**: The dashboard must surface health, gaps, freshness, and next actions without overwhelming the operator.
- **Strict Sandbox Discipline**: All current work uses only local JSON files and mock outputs. No external calls are executed in this sandbox.

---

## 2. Source Adapter Contract (v0.1)

Every data source must implement (or simulate) the following contract:

```json
{
  "source_name": "string",                    // e.g. "Accela", "BCPA", "Sunbiz"
  "source_type": "string",                    // "permit_core" | "property" | "business" | "clerk" | "geocode" | "resolution" | "mirror" | "audit"
  "fetch_mode": "mock" | "local" | "live_future",
  "input_identifiers": ["string"],            // e.g. ["permit_number"], ["folio"], ["business_name"]
  "raw_snapshot_path": "string",              // Path to stored raw payload (local or future cloud bucket)
  "parsed_fields": ["string"],                // List of normalized fields this source can populate
  "source_timestamp": "ISO8601",              // When the data was originally produced by the source system
  "freshness_status": "PROVEN" | "STALE" | "STUB" | "UNKNOWN",
  "provenance": {
    "source_system": "string",
    "source_fetched_at": "ISO8601",
    "import_run_id": "string",
    "fetcher_version": "string"
  },
  "error": {
    "code": "string|null",
    "message": "string|null",
    "retryable": "boolean"
  },
  "rate_limit_policy": {
    "requests_per_minute": "number",
    "burst": "number",
    "backoff_strategy": "string"
  },
  "kill_switch": "boolean"                    // Emergency off switch for this source
}
```

**Implementation Notes (Sandbox):**
- All current adapters are `mock` or `local`.
- `live_future` is a placeholder mode only.
- `raw_snapshot_path` currently points to files under `data/mock_adapters/`.

---

## 3. Planned Sources (Initial Scope)

1. **Accela** – Core permit data, status, descriptions, contractor info, application details, inspections.
2. **BCPA** – Property cards, ownership, valuations, sales history, use codes.
3. **Sunbiz** – Business entity data for contractors and owners.
4. **Broward Clerk / BCRM** – Official recordings, liens, NOC, clerk documents.
5. **Google Geocode** – Address → lat/lon + confidence.
6. **Owner Resolution** – Deterministic + probabilistic owner matching (BCPA + other sources).
7. **Supabase Mirror / Product DB** – Future normalized canonical layer.
8. **Truth Audit / Backup** – Row-level checksums, import audit, parity checks.

---

## 4. Ingestion Pipeline Stages (Future)

1. **Trigger / Scheduler** (Edge Function or Cloud Run job)
2. **Adapter Layer** (one adapter per source, implements the contract)
3. **Raw Snapshot Storage** (local for now → future object storage)
4. **Parser / Normalizer** (maps raw → typed fields, applies cleaning rules)
5. **Resolution & Enrichment** (owner resolution, geocode, cross-source joins)
6. **Audit & Truth Layer** (import_runs, source_fetches, parity_checks)
7. **Write to Target** (only after kill switches, rate limits, and freshness checks pass)
8. **Observability** (dashboard Ingestion page + alerts)

---

## 5. Safety & Governance Controls

- Every source has an explicit `kill_switch`.
- All live fetches must respect documented rate limits.
- Raw snapshots are immutable once written.
- No direct writes to the product mirror until Truth Audit passes.
- All ingestion runs produce an `import_run_id` for full lineage.
- Dashboard must always show `fetch_mode` so operators know what is real vs simulated.

---

*This document is a planning artifact only. No execution of live ingestion is authorized in this sandbox.*

---

## 6. Mock Adapter Test Harness (v0.1 — Added 2026-05-28)

A mandatory preflight gate has been added before any source may move from "planned" to "live_future" execution.

### Required Artifacts
- `data/mock_runs/` — directory containing one JSON file per mock execution (named `{source}_mock_run_YYYY-MM-DD-NNN.json`)
- `data/adapter_test_contract.schema.json` — JSON Schema (draft-07) that every mock run file must validate against
- `data/adapter_test_results.json` — aggregated summary (pass/fail counts, contract violations, recommended next safe source)

### Mandatory Fields in Every Mock Run
`run_id`, `source_name`, `adapter_type`, `mode: "mock"`, timestamps, `status`, record counts, `errors[]`, `warnings[]`, `raw_snapshot_file`, `parsed_output_file`, full `provenance` block with `sandbox_only: true`, **`no_write_guarantee: true`**, **`live_calls_performed: false`**.

### Preflight Checklist (10 gates)
Before any live adapter code may be written or executed for a source, the following must all be true (visible on the Ingestion page):

1. Source contract exists in adapter_test_contract.schema.json
2. Mock run for this source exists in data/mock_runs/ and passes schema validation
3. raw_snapshot_file path defined and present
4. parsed_output_file path defined
5. Provenance block complete (source_system, fetched_at, import_run_id, sandbox_only=true)
6. Rate limit policy documented
7. Kill switch field present and default true for new sources
8. Dry-run / mock mode is the only execution path available
9. Explicit human approval recorded in a future sprint
10. No promotion path to canonical tables until Truth Audit layer exists

**Current harness status (as of 2026-05-28):** 6 sources have passing mock runs. FDEP ERP is the only recommended first candidate for a future dry-run live test — and remains explicitly **NOT APPROVED**.

All harness data is 100% synthetic or derived from prior local snapshots. Zero network calls of any kind were made during creation.

---

## 8. Autonomy Ladder (12 Stages)

This is the official staged path from pure sandbox mock to limited automated promotion. Every stage has explicit gates.

1. **Mock adapter** — Local JSON only, no network. (Current stage)
2. **Contract validation** — Every run passes `adapter_test_contract.schema.json`
3. **Parser mock** — Synthetic parser that turns raw mock snapshots into normalized structures
4. **Cleaner mock** — Synthetic cleaner that applies the old Claude permit-cleaning rules
5. **Staging candidate** — Output of parser+cleaner is written to a local staging area only
6. **Validation report** — Automated checks (schema, duplicates, provenance, freshness) + human spot check
7. **Human approval** — Explicit recorded approval for the specific source + version
8. **Dry-run live fetch** — First actual network call for that source, raw snapshot only, kill switch on
9. **Raw snapshot only** — Live data lands as immutable raw snapshot. No parsing yet.
10. **Staged parse** — Parser runs against the new raw snapshot in a staging environment
11. **Promotion gate** — Validation + human sign-off before anything touches canonical tables
12. **Limited automated promotion** — Only after many successful dry-runs + full Truth Audit layer

**Current stage (2026-05-28):** Stage 1 — Mock adapter harness only.

No source has advanced past Stage 1. FDEP ERP is the only source currently discussed as a plausible candidate for Stage 8 (first dry-run live fetch) in a future explicitly approved sprint — and it remains **NOT APPROVED**.

---

## 9. Mock Parser-Cleaner Pipeline (Documentation Only)

Future flow (all stages after 1 are aspirational and currently unimplemented):

```
Adapter (mock or future live)
    ↓
Raw Snapshot (immutable, timestamped, provenance block)
    ↓
Parser (maps raw → typed normalized fields per field_registry)
    ↓
Permit Cleaner (applies the rules from the original Claude permit cleaner — name normalization, valuation cleanup, work_type derivation, etc.)
    ↓
Staging Candidate (local only, never written to production)
    ↓
Validation (schema, duplicates, provenance completeness, freshness, cross-source parity)
    ↓
Promotion Gate (human approval + kill switch + rollback plan)
    ↓
Limited write to canonical tables (future, after full Truth Audit layer)
```

**Current reality:** We have excellent documentation of the intended flow and a complete mock harness at the Adapter → Raw Snapshot boundary. No real parser or cleaner code has been executed in this sandbox against any external source.

All future work on parser or cleaner logic must:
- Start as pure synthetic/mock examples
- Be clearly labeled as non-executing
- Pass the full preflight checklist before any dry-run integration

This section exists so future developers/AIs understand exactly where the existing Claude permit cleaner logic is intended to plug in.

---

**End of new sections. The cockpit is now at Stage 1 of the Autonomy Ladder with complete handoff documentation.**

## 7. Adapter Contract (Refined v0.2)

```json
{
  "source_name": "string",
  "source_type": "string",
  "fetch_mode": "mock" | "local" | "live_future",
  "adapter_type": "API" | "SFTP" | "scrape" | "local_snapshot" | "manual",
  "input_identifiers": ["string"],
  "raw_snapshot_path": "string|null",
  "parsed_fields": ["string"],
  "source_timestamp_field": "string|null",
  "freshness_status": "PROVEN" | "STALE" | "STUB" | "UNKNOWN" | "FROZEN",
  "risk_level": "low" | "medium" | "high",
  "rate_limit_policy": { "requests_per_minute": number, "burst": number, "backoff_strategy": "string" },
  "kill_switch": boolean,
  "requires_approval": boolean,
  "production_frozen": boolean,
  "first_safe_test": "string",
  "hard_boundary": "string"
}
```

## 8. Mock Output Schema (for sandbox testing)

All mock adapters must produce files matching this minimal structure:

```json
{
  "source": "string",
  "fetch_mode": "mock" | "local",
  "generated_at": "ISO8601",
  "raw_payload": { ... },           // The actual raw response shape (even if simulated)
  "source_timestamp": "ISO8601|null",
  "provenance": {
    "source_system": "string",
    "source_fetched_at": "ISO8601|null",
    "import_run_id": "string"
  }
}
```

## 9. Approval Gate Before Live Execution

Before any source is allowed to move from `mock`/`local` to `live_future`:
1. Kill switch must be implemented and tested (default OFF for new sources).
2. Dry-run mode must be executed successfully (no writes).
3. Full logging + provenance (import_run_id, fetcher_version, raw_snapshot stored).
4. Rate limiting + backoff proven in sandbox.
5. Explicit operator approval recorded (future: approval ticket or config flag).
6. Rollback plan documented (no-write guarantee on failure).

## 10. Logging & Provenance Requirements

Every adapter run (even mock) must emit:
- import_run_id
- source_name + fetch_mode
- start_time / end_time
- raw_snapshot_path (or reference)
- number of records fetched / parsed / written
- errors (with retryable flag)
- kill_switch state at start and end

## 11. Dry-Run Requirement

All adapters must support a `dry_run=true` flag that:
- Performs the full fetch + parse
- Validates schema and rate limits
- Writes nothing
- Produces a report of what *would* have been written

Dry-run must be the default for the first N successful executions of any new live adapter.

## 12. Rollback / No-Write Guarantee

- Every write path must be transactional or have a compensating reversal.
- On any error after the raw snapshot is taken, the system must guarantee zero writes to the product mirror.
- The Truth Audit layer (import_runs + parity_checks) is the final gate before any data is considered trustworthy.

## 13. Recommended First Live Candidate (FDEP ERP — still NOT APPROVED)

**FDEP ERP** (Florida Department of Environmental Protection Environmental Resource Permits)

Rationale:
- Public data
- Structured API or bulk export available
- Lower sensitivity than property/owner data
- Good test for the full ingestion pipeline (permit + location + attachments)

**Status:** Marked as the recommended first candidate for future live work.

**IMPORTANT:** FDEP ERP is **NOT APPROVED FOR LIVE CALLS YET**. It remains in `mock` / planning state until explicit operator approval is given in a future sprint, after all safety controls (kill switch, dry-run, logging, rate limiting, rollback testing) have been validated in the sandbox.

---

This document now defines the full governance model for moving from the current all-mock/local state toward controlled live ingestion.