# Florida Signal — Data & Enrichment Inventory

*Generated 2026-04-27. Read-only audit. No code changes, no scoring changes.*

This file is your reference map for what lives in `db/permits.sqlite`,
where each field comes from, and how complete each one is.

---

## 1. The system in one paragraph

Permits start as JSON pulled from the City of Fort Lauderdale's **Accela**
permit portal (`scrape_accela.py` → permits table). They are then enriched
in three independent passes that each populate different columns:

1. **AI cleaning** (`ai_clean_permits.py`) normalizes names, addresses,
   and valuation; derives `work_type`, `permit_category`, etc.
2. **BCPA enrichment** (`backfill_parcels_and_geo.py`, `enrich_bcpa.py`,
   `enrich_bcpa_property_card.py`, `enrich_bcpa_tier1.py`) attempts to
   match every permit to a Broward Property Appraiser parcel ("folio")
   and pulls owner, use code, value, and lat/lon.
3. **Sunbiz match** (`backfill_sunbiz_matches.py`) attempts to link the
   permit's `owner_name` and `contractor_name` to a Florida corporate
   entity by name. Sunbiz itself is bulk-loaded via SFTP delta files
   (`ingest_sunbiz_sftp.py`).

A separate Accela detail scraper (`scrape_accela_detail.py`) populates
`accela_details` per-permit. Optional layers: `signals`, `signals_v2`,
`signals_v2_context` (older v2 detector + context booster — separate
from the new `signals_v2_score` you started building).

---

## 2. Data flow

```
City of Fort Lauderdale
  Accela Crystal Reports CSV  ─► scrape_accela.py
                                    │
                                    ▼
                         permits  (raw fields, ~30 cols populated)
                                    │
                  ┌─────────────────┼─────────────────┐
                  ▼                 ▼                 ▼
         ai_clean_permits.py    backfill_parcels   scrape_accela_detail.py
         (Claude normalises     _and_geo.py        (Playwright per-permit)
          owner/addr/valn)      → BCPA folio              │
                  │             → lat/lon                 ▼
                  ▼             → parcel_id_verified  accela_details
       address_normalized            │                (workflow, valuation,
       owner_normalized               │                inspections, related)
       valuation_usd_clean            ▼
       work_type             enrich_bcpa_property_card.py
       permit_category       (full property card JSON → bcpa_property_card,
       is_commercial          bcpa_tax_history, bcpa_sales_history,
                              bcpa_flood_zone)
                                      │
                  ┌───────────────────┘
                  ▼
        backfill_sunbiz_matches.py
        (fuzzy match owner_name + contractor_name → Sunbiz docs)
                  │
                  ▼
       owner_sunbiz_doc, contractor_sunbiz_doc
                                              ┌──────────────────────────┐
                              Sunbiz SFTP ──► │ ingest_sunbiz_sftp.py    │
                              quarterly +     │ → sunbiz_entities (12.6M) │
                              daily deltas    │ → sunbiz_officers (20.6M) │
                                              └──────────────────────────┘

Optional / downstream:
  detect_signals_v2.py     → signals_v2          (older rule-based scoring)
  context_boosts.py         → signals_v2_context  (location/operator boost)
  compute_signal_score.py   → signals_v2_score    (NEW v1 scoring — WIP)
  build_tier3_briefs.py     → tier3_briefs        (deep-dive briefings)
  generate_digest.py        → tech_updates        (daily summary)
```

---

## 3. Tables — overview

| Table | Rows | Role |
|---|---|---|
| `permits` | **109,409** | Master record. One row per permit_number. The hub. |
| `enrichment` | 8,728 | Audit trail of enrichment attempts (separate from permit columns). |
| `bcpa_info` | 3,956 | One row per matched parcel — coarse "info" view from BCPA's lookup API. |
| `bcpa_property_card` | 3,956 | One row per matched parcel — full property card JSON. The primary BCPA reference. |
| `bcpa_sales_history` | 1,024 | Per-parcel historical sale records. |
| `bcpa_tax_history` | 22,989 | Per-parcel tax-year records (multiple years per parcel). |
| `bcpa_flood_zone` | 3,444 | FEMA flood zone designation per parcel. |
| `bcpa_info_snapshots` | 27,685 | Versioned snapshots of `bcpa_info` over time. |
| `accela_details` | 2,461 | Per-permit DOM scrape result — workflow, valuation, contractor, related permits. |
| `accela_inspections` | 19,973 | Inspection events (pass/fail, date, type). |
| `accela_documents` | 0 | Reserved for document captures — **currently empty**. |
| `sunbiz_entities` | 12,629,345 | Statewide FL Division of Corporations master file. |
| `sunbiz_officers` | 20,622,297 | Officers/directors of every active entity. |
| `sunbiz_ingest_runs` | 20 | Ingest log (which delta files have been applied). |
| `seed_developers` | 20 | Hand-curated watchlist of major Broward developers. |
| `lp_licenses` | 233 | Florida LP/LLC licenses (separate scrape; not currently used in scoring). |
| `signals` | 4,300 | Original rule-based detector output (legacy v1). |
| `signals_v2` | 200 | Newer 3-gate detector output (older `detect_signals_v2.py`). |
| `signals_v2_context` | 200 | Context layer over signals_v2 (location/operator/media boosts). |
| `signals_v2_score` | 0 | New scoring layer (the one we're building). |
| `permit_maps` | 56 | Generated map images. |
| `satellite_maps` | 4 | Generated satellite views. |
| `flood_zones`, `storm_events` | 0, 0 | Empty — placeholder tables. |
| `leads`, `tier3_briefs`, `land_sales`, `land_sale_signals` | 18, 1, 10, 43 | Downstream artifacts (post-scoring). |
| `scrape_runs` | 26 | Daily scrape audit log. |

---

## 4. `permits` — column-by-column reference

The hub table. **109,409 rows** spanning **applied dates 2020-02-07 → 2026-04-26**.
`first_seen_at` only goes back to 2026-04-20, meaning this table was
re-ingested on Apr 20 (so `first_seen_at` is *not* a true age proxy —
use `applied_date` for permit age).

### 4a. Identity & timing

| Column | Type | Coverage | Source | Notes |
|---|---|---|---|---|
| `permit_number` | TEXT | **100%** | scrape_accela | Unique key. |
| `applied_date` | TEXT | **100%** | scrape_accela | YYYY-MM-DD. |
| `opened_date` | TEXT | **100%** | scrape_accela | Identical to applied_date in practice. |
| `issued_date` | TEXT | 47.9% | scrape_accela | Populated only for permits that have been issued. |
| `finalized_date` | TEXT | **0%** | (never populated) | Field exists but unused. |
| `first_seen_at` | TEXT | 100% | scrape_accela | When *we* first saw it; doesn't pre-date 2026-04-20. |
| `last_seen_at` | TEXT | 100% | scrape_accela | Updated on every scrape. |
| `cleaned_at`, `cleaned_by` | TEXT | 100% | ai_clean_permits | All rows have been touched by the cleaner at least once. |
| `last_enriched_at` | TEXT | 100% | enrich_bcpa | Updated on enrichment touch. |
| `enrichment_version` | INT | 2.5% | enrich_bcpa | Bumped when category/commercial recomputed. |
| `parcel_checked_at` | TEXT | 9.6% | backfill_parcels_and_geo | When BCPA was last consulted. |
| `geocoded_at` | TEXT | 8.1% | backfill_parcels_and_geo | When lat/lon was last set. |

### 4b. Classification (mostly cleaner-derived)

| Column | Type | Coverage | Source | Notes |
|---|---|---|---|---|
| `permit_type` | TEXT | 99.9% | scrape_accela | Free text from Accela (e.g. "Structural Permit", "Permit Void Request"). |
| `status` | TEXT | 100% | scrape_accela | Workflow status ("Issued", "Complete", "Open", "Purged", etc.). |
| `description` | TEXT | 77.5% | scrape_accela | Permit narrative — sometimes blank or one word. |
| `work_type` | TEXT | 100% | ai_clean_permits | Cleaner-derived bucket: addition, alteration_residential, demolition, electrical, etc. |
| `permit_category` | TEXT | 2.5% | backfill_permit_category | Aggregated category — **mostly null**, only ~2.5K populated. |
| `is_commercial` | INT | 0.9% | backfill_permit_category | **Mostly null** — same problem. |
| `category_source` | TEXT | 2.5% | backfill_permit_category | Tracks where category came from. |
| `category_confidence` | REAL | 2.5% | backfill_permit_category | Cleaner's confidence in category. |
| `region` | TEXT | 97.9% | scrape_accela | Geographic region label from Accela report. |

### 4c. Address & geo

| Column | Type | Coverage | Source | Notes |
|---|---|---|---|---|
| `address` | TEXT | 81.5% | scrape_accela | Raw address from Accela (e.g. "2600 NE 24 ST"). |
| `address_normalized` | TEXT | 81.5% | ai_clean_permits | Cleaner-normalized form. |
| `street_normalized` | TEXT | 5.2% | ai_clean_permits | Just the street part — only sparsely populated. |
| `parcel_id` | TEXT | 31.2% | scrape_accela | Raw parcel id from Accela (often blank or wrong). |
| `parcel_id_verified` | TEXT | **8.0%** | backfill_parcels_and_geo + enrich_bcpa | The trustworthy parcel — only set after BCPA confirms a match. |
| `parcel_source` | TEXT | 8.0% | backfill_parcels_and_geo | How we found the parcel: `bcpa_folio` (direct lookup) or `bcpa_address` (address→folio match). |
| `lat`, `lon` | REAL | 7.2% | backfill_parcels_and_geo | Set from BCPA parcel centroid; sometimes Google geocode. |
| `geo_source` | TEXT | 8.1% | backfill_parcels_and_geo | `bcpa_parcel`, `google_geocode`, `gemini`, `gemini+bcpa_parcel`, `google_geocode+bcpa_parcel`. |

### 4d. Owner & contractor

| Column | Type | Coverage | Source | Notes |
|---|---|---|---|---|
| `owner_name` | TEXT | **2.1%** | backfill_accela_owner ← accela_details | **Critical gap** — only 2,337 of 109,409. Owner data is almost entirely missing. |
| `owner_normalized` | TEXT | 1.4% | ai_clean_permits | Cleaner-normalized form (only when owner_name was populated). |
| `owner_source` | TEXT | (unknown — needs check) | ai_clean_permits | Tracks origin of the owner string. |
| `contractor_name` | TEXT | 56.4% | scrape_accela | Better than owner; comes from the Accela report directly. |
| `contractor_normalized` | TEXT | 53.1% | ai_clean_permits | Cleaner-normalized form. |
| `contractor_needs_review` | INT | (unknown — sparse) | ai_clean_permits | Cleaner flag for ambiguous contractor names. |
| `applicant_name` | TEXT | (unknown — recently added) | scrape_accela_detail | Per-permit DOM scrape only. |

### 4e. Money

| Column | Type | Coverage | Source | Notes |
|---|---|---|---|---|
| `valuation` | REAL | 7.9% | scrape_accela | Raw declared value from Accela CSV. |
| `valuation_usd_clean` | REAL | 6.8% | ai_clean_permits | Normalized currency. **Tiny coverage** — biggest data quality issue. |
| `fees_total` | REAL | 18.8% | scrape_accela | City fee paid (NOT project value — don't use as proxy). |

### 4f. Cross-source links

| Column | Type | Coverage | Source | Notes |
|---|---|---|---|---|
| `owner_sunbiz_doc` | TEXT | **0.8%** | backfill_sunbiz_matches | Owner LLC matched to a Sunbiz document number. **Very sparse** — and 0% on newest 1,000. |
| `contractor_sunbiz_doc` | TEXT | 47.0% | backfill_sunbiz_matches | Contractor matched to Sunbiz. Far more complete. |
| `owner_sunbiz_match_score` | REAL | (unknown — sparse) | backfill_sunbiz_matches | Match confidence (0-1). |
| `contractor_sunbiz_match_score` | REAL | (unknown — sparse) | backfill_sunbiz_matches | Match confidence (0-1). |
| `source_accela`, `source_bcpa`, `source_sunbiz` | TEXT | 100% / 7.2% / 47.5% | various | Per-source enrichment timestamps (audit). |
| `source_bcpa_method` | TEXT | (unknown — sparse) | enrich_bcpa | Which match strategy succeeded (S1, S2, S3, S4, exact, etc.). |
| `is_commercial_source` | TEXT | (unknown — sparse) | backfill_permit_category | How we decided commercial vs. residential. |

### 4g. Other / housekeeping

| Column | Type | Coverage | Notes |
|---|---|---|---|
| `unit_count` | INT | **0.003%** | Field exists, almost never populated. |
| `raw_json` | TEXT | (heavy — every row) | Full original Accela CSV row in JSON. The fallback for any field we don't expose as a column. |
| `ai_clean_json` | TEXT | (heavy — every row) | Full Claude-normalisation output. |
| `status_history` | TEXT | (sparse) | JSON array of status transitions. |
| `invalid`, `invalid_reason` | INT, TEXT | 0% | Fields exist but never set. |

---

## 5. BCPA tables — column-by-column reference

BCPA = Broward County Property Appraiser. Two parallel tables, one row
per matched folio. The folio (parcel ID) is the join key.

### `bcpa_info` — 3,956 rows (lightweight info-API record)

Source: `enrich_bcpa_tier1.py` via BCPA ArcGIS REST API (free).

| Column | Coverage | Notes |
|---|---|---|
| `folio` | 100% | The parcel ID. Primary key in this table. |
| `use_code` | 98.7% | Property type code (e.g. `01` Single Family, `04` Condo, `03-01` Multi-Family 10-49 units). Both raw and human-readable forms exist in different rows. |
| `name_line_1` | 98.7% | Owner name on file (primary owner). |
| `situs_street_number`, `_name`, `_zip_code` | 98% | Property address parts. |
| `bldg_units` | 7.4% | Number of units — useful for multifamily detection but **mostly null**. |
| `bldg_year_built` | 84.1% | Year of construction. |
| `bldg_use_code`, `pairing_code`, `land_tag` | high | Parcel classification details. |
| `total_prc_per_sqft`, `total_prc_per_unit` | (sparse) | Valuation rates. |
| `storm_district`, `storm_assessment` | high | Storm/flood proximity (separate from FEMA flood zone). |
| `inspect_date`, `cycle` | high | When BCPA last appraised. |
| `raw_json` | 100% | Full ArcGIS response. |
| `fetched_at` | 100% | Audit timestamp. |

### `bcpa_property_card` — 3,956 rows (full property card JSON)

Source: `enrich_bcpa_property_card.py` via BCPA's full property-card JSON
endpoint. Recently rebuilt 2026-04-27 after corruption.

| Column | Coverage | Notes |
|---|---|---|
| `folio` | 100% | Join key. |
| `use_code` | 98.6% | Same as bcpa_info but sometimes more specific. |
| `owner_name_1` | 98.6% | Primary owner — **the gold-standard owner field**. |
| `owner_name_2` | 35.6% | Secondary owner (joint ownership). |
| `just_value` | 98.6% | Assessed value as text (e.g. "$1,234,567"). |
| `just_value_num` | 98.6% | Same as numeric — usable directly. |
| `bldg_value`, `bldg_value_num` | high | Building component of value. |
| `homestead_flag` | 98.6% | Y/N — homestead exemption present. |
| `beds`, `baths` | 57.5% | Residential bedroom/bath count. |
| `bldg_sq_ft`, `bldg_under_air_footage` | 98.6% | Floor area. |
| `actual_age`, `effective_age` | 98.6% | Building age. |
| `millage_rate`, `millage_year` | high | Tax rate. |
| `picture_path` | high | URL to BCPA property photo. |
| `site_address_1` | **0%** | Field exists but never populated. Use `bcpa_info.situs_*` instead. |
| `raw_json` | 100% | Full property card. |
| `fetched_at` | 100% | Audit timestamp. |

### `bcpa_sales_history` — 1,024 rows
Per-parcel historical sales (date, price, deed type, parties).
**Coverage low** — only ~26% of matched parcels have any sales history loaded.

### `bcpa_tax_history` — 22,989 rows
Multiple years per parcel (year, taxable value, assessed value, exemption).
~6 years × 3,956 parcels.

### `bcpa_flood_zone` — 3,444 rows
FEMA zone (e.g. AE, X, VE), elevation, base flood elevation per folio.

### `bcpa_info_snapshots` — 27,685 rows
Time-series snapshots of `bcpa_info`. Lets us see when ownership changed.

---

## 6. Sunbiz tables — column-by-column reference

Source: Florida Division of Corporations daily/quarterly SFTP delta
files, ingested by `ingest_sunbiz_sftp.py`.

### `sunbiz_entities` — 12.6M rows (every FL corp/LLC)

| Column | Notes |
|---|---|
| `document_number` | Primary key (e.g. `L20000345672`). |
| `entity_name`, `entity_name_normalized` | Display name + searchable form. |
| `status` | `A` = Active, `I` = Inactive. |
| `filing_type` | `FLAL` = FL LLC, `DOMP` = FL Profit Corp, etc. |
| `filing_date` | When the entity was registered with FL. **Critical** — fresh filings = new operator. |
| `principal_addr1`, `_city`, `_state`, `_zip` | Listed business address. |
| `mailing_addr1`, `_city`, `_state`, `_zip` | Mailing address (often same). |
| `ra_name`, `ra_addr1`, `ra_city`, `ra_state`, `ra_zip` | Registered agent. |
| `report_year_1/2/3`, `report_date_1/2/3` | Annual report compliance. |
| `last_transaction_date` | Last filing event. |
| `fei_number` | Federal employer ID (when present). |
| `source_file`, `ingested_at` | Audit. |

### `sunbiz_officers` — 20.6M rows (officers/directors)

| Column | Notes |
|---|---|
| `document_number` | FK → entities. |
| `seq` | Multiple officers per entity, sequence number. |
| `title`, `title_full` | "P" / "Pres", "VP", "MGR" / "Manager", etc. |
| `type` | Letter type code. |
| `officer_name`, `officer_name_normalized` | Person or LLC name + searchable. |
| `addr1`, `city`, `state`, `zip` | Officer address (when listed). |
| `ingested_at` | Audit. |

Indexes: `idx_sunbiz_off_doc` (on document_number), `idx_sunbiz_off_name`
(on officer_name_normalized). The doc index is what makes per-doc
officer lookups fast.

### `sunbiz_ingest_runs` — 20 rows
Audit log of which SFTP delta files have been applied. Used for catch-up
detection (missed days).

---

## 7. Accela tables — column-by-column reference

### `accela_details` — 2,461 rows

Source: `scrape_accela_detail.py` — Playwright per-permit scrape against
the authenticated Accela DOM. Slow + rate-limited, so coverage is
intentionally partial (top-priority permits only).

| Column | Coverage | Notes |
|---|---|---|
| `permit_number` | 100% | FK → permits. |
| `status` | 97.5% | Status from the detail page (sometimes more current than the CSV). |
| `applied_date`, `issued_date`, `finalized_date` | **0%** | Detail-page dates **not currently scraped** into these columns. |
| `applicant_name` | **0%** | Available in DOM but not currently extracted. |
| `applicant_phone`, `_email` | unknown | Reserved fields. |
| `owner_name`, `owner_address` | high | Per-permit owner — the source for `permits.owner_name` backfill. |
| `contractor_name`, `contractor_company`, `contractor_phone`, `contractor_license` | 77% | More complete than the CSV. |
| `description` | 83.3% | Detail-page narrative (often longer than CSV). |
| `valuation` | **31.7%** | Often present when `permits.valuation_usd_clean` is null — the fallback we wired in v1 scoring. |
| `fees_total` | high | Fee detail. |
| `outstanding_balance` | high | Unpaid fees (signal of administrative status). |
| `workflow_json` | 97.6% | Plan-review workflow steps as JSON — drives "plan_review_active" momentum signal. |
| `related_permits_json` | 97.6% | Sibling/parent permits at the same site. |
| `application_info_json`, `conditions_json` | high | Application metadata + conditions of approval. |
| `documents_count`, `inspections_count`, `comments_count` | 100% | Counts only (the actual records live in their own tables). |
| `parcel_number`, `parcel_block`, `parcel_lot`, `subdivision`, `site_address` | high | Parcel info from the detail page. |
| `source_url` | 97.6% | Link back to the Accela detail page. |
| `fetched_at`, `scrape_status`, `error` | 100% | Audit + error tracking. |
| `raw_json` | 100% | Full DOM dump. |

### `accela_inspections` — 19,973 rows
One row per inspection event (date, type, result, inspector). Heavily
populated.

### `accela_documents` — 0 rows
Reserved — `0_capture_accela_documents.command` exists but hasn't been
run.

---

## 8. Coverage scorecard — what's strong, what's weak

### Strong (>75%)

- `permit_number`, `applied_date`, `opened_date`, `permit_type`, `status`
  — 99-100%. The skeleton is complete.
- `description` — 77.5%. Decent but not universal.
- `address` / `address_normalized` — 81.5%. Good, but ~18% of permits
  have no address at all (often ROW-* / utility permits).
- `work_type` — 100% (cleaner always assigns one).
- `region` — 97.9%.
- BCPA `owner_name_1`, `use_code`, `just_value_num` — 98.6% **of matched
  parcels** (but only 7-8% of permits have a matched parcel).
- Accela `workflow_json`, `related_permits_json` — 97.6% **of scraped
  detail records** (but only 2.2% of permits).

### Mid (30-75%)

- `issued_date` — 47.9%. Half of permits haven't been issued.
- `contractor_name` — 56.4%. Decent.
- `contractor_sunbiz_doc` — 47.0%. Sunbiz-matched contractors.
- `parcel_id` (raw) — 31.2%. Useful as a hint but unverified.
- `accela_details.valuation` — 31.7% (of the 2,461 scraped — i.e. ~0.7%
  of all permits).

### Weak (<30%) — the gap zone

- `valuation_usd_clean` — **6.8% overall, 26.5% on newest 1,000, 2.0% on
  newest 100**. The biggest data-quality issue.
- `parcel_id_verified` / `lat` / `lon` — **7-8% overall, 60-75% on
  newest 1,000**. The map-ready batches are fixing this for recent
  permits but the historical archive is mostly unmapped.
- `owner_name` — **2.1% overall, 0% on newest 1,000**. Critical gap.
  `backfill_accela_owner.py` exists but only works on permits that have
  been through `scrape_accela_detail.py` (2,461 of 109,409).
- `owner_sunbiz_doc` — **0.8% overall, 0% on newest 1,000**. Even worse
  than owner_name because it depends on owner_name being populated
  first.
- `permit_category` / `is_commercial` — 2.5% / 0.9%. Only ~2.8K permits
  have been categorised; the rest fall back to `work_type`.
- `unit_count` — 0.003%. Effectively unused.
- `finalized_date`, `accela_details.applied_date` / `issued_date` /
  `applicant_name`, `bcpa_property_card.site_address_1` — **0%**.
  Schema columns that nothing populates.

---

## 9. Required vs. optional for downstream use

### Required for any meaningful scoring or mapping

These must be populated before a permit is useful:

- `permit_number` (always — primary key)
- `applied_date` OR `opened_date` (always populated)
- `permit_type` AND/OR `description` (need at least one to classify intent)
- `status`
- **At least one of**: `address`, `parcel_id_verified`, or `lat`/`lon`
  — otherwise the permit can't be located.

### High-value (transforms a permit from "noise" to "signal")

- `valuation_usd_clean` (or accela fallback) — sparse but informative
- `parcel_id_verified` — unlocks BCPA join (owner, use_code, value)
- `lat`/`lon` — unlocks corridor / waterfront classification
- `owner_name` AND `owner_sunbiz_doc` — unlocks operator clustering
- `bcpa_property_card.owner_name_1` — gold standard for ownership
- `accela_details.workflow_json` + `inspections_count` — momentum signal

### Optional / nice-to-have

- `finalized_date`, `unit_count`, `bldg_units`, `applicant_name` — useful
  but not blocking.
- `bcpa_sales_history` — interesting for "owner just bought" stories,
  but only 26% of matched parcels have it loaded.
- `bcpa_flood_zone` — relevant for flood-redevelopment angle but not
  currently used in scoring.

---

## 10. Gaps & weaknesses

### Critical gaps

1. **Owner data is missing on ~98% of permits.** `permits.owner_name`
   covers 2.1% archive-wide and **0%** on the newest 1,000 — meaning
   recent permits have no owner data at all. `backfill_accela_owner.py`
   pulls from `accela_details.owner_name`, which only exists for the
   2,461 permits that have been through the detail-page scraper.
   *Implication for v1 scoring*: ownership scoring relies entirely on
   `bcpa_property_card.owner_name_1` (via parcel join), which is itself
   limited to the 7-8% of permits with a verified parcel.

2. **Valuation coverage is 6.8% overall, 2% on newest 100.** Already
   audited; flagged as weak signal. `accela_details.valuation` (31.7% of
   scraped detail records) is the only fallback.

3. **Parcel + geo coverage is 7-8% overall.** The map-ready batches
   (`0_RUN_MAP_READY_BATCH_*.command`) are bringing newest-permit
   coverage up — currently 60-75% on the newest 1,000. The historical
   archive (109K rows from 2020-2026) is mostly unmapped.

4. **`first_seen_at` is not a true age proxy.** It only goes back to
   2026-04-20 because the table was re-ingested. For permit age, use
   `applied_date` or `opened_date`.

### Schema columns that exist but are never populated

- `permits.finalized_date`
- `permits.unit_count` (3 of 109,409)
- `permits.invalid`, `permits.invalid_reason`
- `bcpa_property_card.site_address_1`
- `accela_details.applied_date`, `accela_details.issued_date`,
  `accela_details.applicant_name`, `accela_details.applicant_phone`,
  `accela_details.applicant_email`
- `accela_documents` table (entire table is 0 rows)
- `flood_zones`, `storm_events` tables (0 rows each)

### Conflicting / overlapping data sources

- **Use code** lives in *both* `bcpa_info.use_code` and
  `bcpa_property_card.use_code` — sometimes they disagree (one has the
  text form like "01-01 SINGLE FAMILY", the other has the raw code
  "01"). Scoring code currently prefers `bcpa_property_card.use_code`
  with a fallback to `bcpa_info.use_code`.
- **Owner name** lives in *three* places: `permits.owner_name` (Accela
  raw), `accela_details.owner_name` (per-permit DOM), and
  `bcpa_property_card.owner_name_1` (BCPA). They can disagree, especially
  when ownership has changed since the permit was filed. BCPA is most
  current; Accela permit owner is who actually filed.
- **Valuation** lives in `permits.valuation`, `permits.valuation_usd_clean`,
  and `accela_details.valuation`. The cleaner version is preferred.
- **Address** lives in `permits.address` (raw), `permits.address_normalized`
  (cleaner), `accela_details.site_address` (per-permit), and
  `bcpa_info.situs_*` (BCPA reconstructed). Used as join keys at
  different stages.

### Enrichment steps that exist but lag

- **`scrape_accela_detail.py`** has only run on 2,461 permits — the
  bottleneck is Playwright + rate limits. Every additional permit it
  scrapes unlocks owner_name, longer description, valuation fallback,
  workflow, and inspections.
- **`backfill_sunbiz_matches.py`** exists but `owner_sunbiz_doc` is
  effectively dead on the newest 1,000 permits (0% coverage). Its input
  depends on `owner_name`, which is itself missing on recent permits —
  so this is a downstream gap of the owner-name gap.
- **`enrich_court.py`, `enrich_news.py`, `enrich_research.py`,
  `enrich_listings.py`** — these scripts exist but nothing in the
  current scoring path uses their output. They appear to be legacy
  experiments.

### Enrichment steps that don't exist

- **No precomputed water-distance per parcel.** v1 scoring uses crude
  bounding boxes. Broward GIS shapefiles for canals/intracoastal/ocean
  exist publicly but haven't been ingested.
- **No CRA / TIF zone shapefile join.** v1 uses a hand-drawn bbox.
- **No school-zone / opportunity-zone overlay.**
- **No deduplication of owner LLC chains.** When BROWARD MARINA HOLDINGS
  LLC owns 5 parcels and BROWARD MARINA HOLDINGS II LLC owns 3 more
  with the same officers, scoring treats them as different owners.
- **No flagging of land-bank or speculative holds** beyond the
  `seed_developers` watchlist (20 entries, hand-curated).

---

## 11. Glossary — script roles at a glance

| Script | What it populates | When it runs |
|---|---|---|
| `scrape_accela.py` | New rows in `permits` (raw fields) | Daily 22:00 (`permits-daily`) |
| `ai_clean_permits.py` | Normalized fields (address, owner, valuation, work_type) | Daily after scrape |
| `backfill_parcels_and_geo.py` | `parcel_id_verified`, `lat`, `lon`, `parcel_source`, `geo_source` | Daily after cleaning + map-ready batches on demand |
| `enrich_bcpa.py` (helper module) | Powers parcel matching | Library, called by backfill scripts |
| `enrich_bcpa_property_card.py` | `bcpa_property_card`, `bcpa_tax_history` | Daily after parcel match |
| `enrich_bcpa_tier1.py` | `bcpa_info` | Daily after parcel match |
| `scrape_accela_detail.py` | `accela_details`, `accela_inspections` | On demand (slow, rate-limited) |
| `backfill_accela_owner.py` | `permits.owner_name` from `accela_details.owner_name` | Daily after detail scrape |
| `backfill_sunbiz_matches.py` | `permits.owner_sunbiz_doc`, `permits.contractor_sunbiz_doc` | Weekly (Sat 02:30) |
| `ingest_sunbiz_sftp.py` | `sunbiz_entities`, `sunbiz_officers` | Daily delta + quarterly full |
| `backfill_permit_category.py` | `permits.permit_category`, `is_commercial` | On demand |
| `detect_signals_v2.py` | `signals_v2` (legacy) | Daily |
| `context_boosts.py` | `signals_v2_context` (legacy boosts) | Daily |
| `compute_signal_score.py` | `signals_v2_score` (NEW v1 scoring — WIP) | Not yet scheduled |
| `build_tier3_briefs.py` | `tier3_briefs` | Weekly |
| `generate_digest.py` | `tech_updates` | Daily |

---

## 12. Bottom line

You have a **rich permit + BCPA + Sunbiz + Accela archive** but the
"join glue" between them is sparse. Specifically:

- The permits skeleton (number, dates, type, status) is **complete**.
- BCPA enrichment is **complete *for the 7-8% of permits we've matched*** —
  and that match rate is climbing (60-75% on the newest 1,000 thanks to
  the map-ready batches).
- Owner data is the single biggest gap: **2% archive-wide, 0% on the
  newest 1,000**. Until `scrape_accela_detail.py` runs at scale (or
  the report scrape exposes owner directly), ownership scoring will rely
  on the BCPA owner field only — which means scoring can't see who
  actually *filed* the permit.
- Sunbiz coverage on contractors (47%) is real and useful. Sunbiz on
  owners is essentially unavailable until owner_name is populated.
- Valuation is sparse (7%), bimodal (Walk-Thru permits 60-100%, major
  construction 1-22%), and has a viable fallback path through
  `accela_details.valuation`.

Strategically the next data investments — in rough impact order — would be:

1. Scale `scrape_accela_detail.py` so owner_name approaches the ~50%
   coverage that contractor_name already has.
2. Continue the map-ready batches on older permits to bring archive
   parcel/geo coverage above 50%.
3. Ingest Broward GIS shapefiles for water-distance, CRA, opportunity
   zones (replaces the v1 bbox approximations).
4. Build an LLC-chain deduplication pass (officer overlap → owner
   cluster ID).
5. Re-run `backfill_sunbiz_matches.py` *after* owner coverage improves —
   it's a downstream beneficiary of #1.

That's the system. Read it like a map, not a contract — coverage
percentages drift as enrichment runs, and the schema columns that say
"unused" today may light up after a future scrape pass.
