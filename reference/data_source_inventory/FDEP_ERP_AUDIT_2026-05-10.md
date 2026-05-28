# Florida DEP MapDirect — Environmental Resource Permits (ERP) — Audit + Unified Cross-Source Intelligence Plan

*Auditor: Claude (read-only research). Date: 2026-05-10. Site audited: https://ca.dep.state.fl.us/mapdirect/?focus=erp + the underlying ArcGIS REST endpoints under https://ca.dep.state.fl.us/arcgis/rest/services/OpenData/ERP/. Tests ran live against the FDEP ArcGIS API and cross-referenced against `db/permits.sqlite` (read-only). Report is editorial output and does NOT trigger the 7-step doc-update rule. No live state was changed.*

*This audit closes a three-part triptych — Broward Records (liens/NOCs/recordings) + Broward BCS (permits/contractors/CUs/code-enforcement/Unsafe-Structure) + FDEP ERPs (environmental/waterfront/wetland) — and includes an explicit **Unified Cross-Source Intelligence Layer** section (§ 7) that ties all three plus the existing Accela/BCPA/Sunbiz pipeline together.*

---

## 1. Executive Summary

`mapdirect/?focus=erp` is the Florida DEP's GIS portal for **Environmental Resource Permits** — the state-issued permit required for any project that affects wetlands, surface waters, stormwater systems, docks, seawalls, marinas, or significant site grading. Behind the map is a **fully open, well-documented ArcGIS REST API at `ca.dep.state.fl.us/arcgis/rest/services/OpenData/`** that exposes **95+ environmental and regulatory layers** — including 8 ERP-specific feature layers — all queryable by date, county, applicant, permit number, lat/lon bbox, etc. Every record is geo-referenced (lat/lon) and includes structured `DOCUMENTS` URLs that deep-link to FDEP's electronic-documents portal where the PDFs of the application, environmental review, and drawings live.

For Florida Signal's pipeline this is **the cleanest, most automation-friendly external dataset we've found in this entire three-audit sweep**. Live tests verified: 2,249 historical Broward ERPs, 43 currently OPEN, **14 new in the last 30 days, 4 in the last week** — a manageable volume for a daily editorial-intelligence feed where every record is a substantive lead. We confirmed direct cross-reference: the `2401 DEL LAGO DR` ERP filed 2026-03-31 for "RIZAI DOCK EXTENSION" lines up with two building permits in our DB filed 5–6 weeks later by PRECISION TECH ($4,100 electrical) and YACHT LIFTERS ($139,000 building). That's an ERP→permit signal pattern with a clear leading indicator: **the FDEP ERP fires first, telling us a building permit is coming.**

**The unified intelligence layer** (§ 7) — combining FDEP ERPs + Broward recording (liens, NOCs, mortgages) + BCS (Unsafe-Structure cases, contractor licenses, CUs) + our existing Accela/BCPA/Sunbiz pipeline — gives Florida Signal a property/owner/contractor-resolution graph of unprecedented depth for Broward. This is exactly the foundation on which to build the editorial-intelligence and (when the freeze lifts) signal-scoring layer.

---

## 2. Site & Platform — what's actually here

### 2.1 Map viewer

URL `https://ca.dep.state.fl.us/mapdirect/?focus=erp` loads the FDEP **MapDirect v7.260309** ArcGIS-based map viewer with 4 ERP layers turned on by default. The viewer is just one rendering of the underlying data — its real value is what it reveals about the API behind it.

### 2.2 The ArcGIS REST OpenData service catalog (95+ layers)

Calling `https://ca.dep.state.fl.us/arcgis/rest/services/OpenData?f=json` returns the full FDEP open-data service catalog. Of the 95+ services, these are the most relevant to a permit-data pipeline:

| Service | What it is | Relevance to FL Signal |
|---|---|---|
| **ERP** | Environmental Resource Permits (8 layers) | 🔥 PRIMARY — every wetland/dock/seawall/stormwater project |
| **CLEANUP_SP** | Active contaminated-site cleanup tracking | Brownfield + remediation projects, often pre-redevelopment |
| **BROWNFIELD_AREAS** | Designated brownfield redevelopment areas | Grant + tax-credit eligible property zones |
| **COASTAL_ENV_PERM** | Coastal Environmental Permits | Beach + dune projects |
| **COASTAL_JCP** | Joint Coastal Permits | Major beach/coastal infrastructure |
| **MITIGATION_BANKS** | Wetland mitigation banking sites | Where developer mitigation credits come from |
| **AQUATIC_PRESERVES** | Protected waters (no/limited construction) | Hard NO-build overlay |
| **OFW** | Outstanding Florida Waters | Higher-tier protected waters |
| **IMPAIRED_WATERS** | TMDL / impaired water bodies | Stormwater compliance triggers |
| **DRAINAGE_BASINS** | Drainage basin boundaries | Stormwater jurisdictional overlay |
| **STATEWIDE_BMAP** | Basin Management Action Plans | Long-term water-quality enforcement |
| **STATEWIDE_LU** | Statewide land use (2004–2013 baseline) | Land-use change detection |
| **PWS** | Public Water System points | Wellfield protection zones |
| **SEPTIC_SYSTEMS** | Septic-system data | Failing-septic + sewer-conversion stories |
| **WRM_OCP** | Water Resource Management — Operations Compliance Permits | Industrial water permits |
| **GYPSUMSTACKS** | Gypsum stack facilities (phosphate industry) | Mosaic / FL phosphate exposure |
| **STATE_OWNED_LANDS** | State land ownership | Public land + conservation parcels |
| **NHD** / **LAKES** / **SURFACE_WATER** | National Hydrography Dataset | Geospatial joins to water features |
| **FDEP_DISTRICT** | FDEP regulatory districts | Jurisdictional overlay |

All of these are queryable via the same ArcGIS REST pattern. ERP is the highest-leverage one for now; the others are Tier-2/Tier-3 enrichment options.

### 2.3 ERP service — the 8 feature layers

`https://ca.dep.state.fl.us/arcgis/rest/services/OpenData/ERP/MapServer` — copyright "FDEP, WRM, ERP". Spatial reference WKID 6439 (Florida-specific Albers projection). Supports `Map`, `Query`, `Data` capabilities on every layer. Max 1,000 records per query — paginate via OBJECTID.

| Layer | Name | Geometry | Description | Live Broward count |
|---:|---|---|---|---:|
| 0 | ERP SPGP (2012-present) | Point | State Programmatic General Permit applications (federal-state coordination via Army Corps) | ~tens |
| **1** | **ERP (2007-present)** | Point | The main current ERP layer. All ERP/Beach permits issued by DEP except DE/EE/ME types | **2,249** |
| 2 | ERP (Historic) | Multipoint | Pre-2007 ERPs | hundreds |
| 3 | ERP from PA | Point | Pulled from FDEP Permit Application Tracking System (PA) — covers ERP + Beaches/Coastal | overlap with 1 |
| **4** | **ERPce (Compliance & Enforcement)** | Point | FDEP COMET (compliance/enforcement tracking) facilities subset for ERP | **1,944 Broward** |
| 5 | ERP Conservation Easements (points) | Point | Regulatory conservation easements created via ERP | many |
| **6** | **ERP Site Inspection Status** | Point | Active inspection tracking — DUE_DATE, END_DATE, status | **545 Broward** (511 currently open) |
| 7 | ERP Delegation Areas for BR and SFWMD | Polygon | Polygons of areas delegated to **Broward County** under FS 373 (i.e., where Broward County itself processes the ERP, not FDEP) | n/a |

**Layer 7 is critical context:** Broward County has been delegated by FDEP and SFWMD to issue many ERPs locally. So a Broward project may have its ERP processed by *Broward County* (not visible in this FDEP layer 1) **or** by *SFWMD* (also not in this FDEP layer 1) **or** by *FDEP* (visible in layer 1). The 2,249 we count in layer 1 is the FDEP-direct subset; total Broward ERP volume across all three issuing authorities is materially larger. Layer 3 ("ERP from PA") may include some of the SFWMD/Broward-delegated permits since it's pulled from FDEP's PA tracking system.

### 2.4 No robots.txt, no auth, no rate limit observed

- `dep.state.fl.us` has no published robots.txt for the API path
- Authentication: none required for OpenData services
- Rate limit: not observed in our test queries (10+ queries in succession, all succeeded)
- Terms of Use: standard FL public-records disclaimer; data is intentionally published as Open Data for public re-use

### 2.5 DOCUMENTS field — the deep-link trick

Every ERP record's `DOCUMENTS` field is a URL that follows the pattern:

```
https://prodenv.dep.state.fl.us/DepNexus/public/electronic-documents/ERP_<application#>/gis-facility!search
```

That URL deep-links into FDEP's **DepNexus electronic-documents portal**, where the actual PDFs live: application form, project narrative, drawings, environmental review, agency response, public notice, monitoring reports, etc. So **for every ERP we ingest, we get a stable URL to the source PDFs** — no scraping required to surface the documents.

---

## 3. Complete Field Schema — the high-value layers

### 3.1 Layer 1 — ERP (2007-present), 33 fields

The main current-permit layer. Every Broward project we care about with an FDEP ERP shows up here.

| Field | Type | Notes |
|---|---|---|
| `OBJECTID` | OID | Internal; unique per row |
| `DIVISION` | string | FDEP division |
| `PERMITTING_PROGRAM` | string | E.g. "Environmental Resource Permitting" |
| `DISTRICT` | string | FDEP district |
| `OFFICE_ABBREV` / `OFFICE_DESCRIPTION` | string | Issuing office |
| `PROJECT_ID` | int | Internal project id |
| `PROJECT_NAME` | string | Free-text project name (e.g. `LAS OLAS MARINA`, `RIZAI DOCK EXTENSION`) |
| `APPLICANT_NAME` | string | Person name |
| `APPLICANT_COMPANY` | string | Company / LLC |
| `PERMIT_TYPE` | string | E.g. `Water - Individual With No Conceptual Approval Permit`, `Water - ERP Noticed General Permit`, `Water - ERP Modifications`, `Water - ERP Formal Determination` |
| `PERMIT_ID` | string | E.g. `0471469-001-EG` (issued/effective form) |
| `APPLICATION_ID` | string | E.g. `0471625-001` (pending applications) |
| `PERMIT_STATUS` | string | `Pending` / `Issued` / etc. |
| `LOCATION_ID` / `LOCATION_NAME` | string | Site identifier |
| `STREET_ADDRESS` | string | E.g. `2401 DEL LAGO DRIVE` |
| `CITY` / `STATE` / `ZIP5` / `ZIP4` | string | |
| `LATITUDE_DD/MM/SS`, `LONGITUDE_DD/MM/SS`, `DCD_DATUM_ID` | numeric | Lat/lon in degrees-minutes-seconds |
| **`RECEIVED_DATE`** | date | 🔥 **the freshness key** — when FDEP got the application |
| `AGENCY_ACTION` | string | Action type (e.g. `Effective`, `Issued`) |
| **`AGENCY_ACTION_DATE`** | date | When FDEP issued/denied |
| `DEFINED_STATUS` | string | `OPEN` / `CLOSED` |
| **`DOCUMENTS`** | string | Deep-link URL into DepNexus PDFs |
| `GEOMETRY` | point | Lat/lon |

### 3.2 Layer 6 — ERP Site Inspection Status, 34 fields

This is the workflow-tracking layer for inspections.

| Field | Type | Notes |
|---|---|---|
| `APPLICATION_NUMBER` | string | Joins back to layer 1 PERMIT_ID/APPLICATION_ID |
| `PERMIT_TYPE` / `PERMIT_SUBTYPE` | string | |
| `SITE_NAME` / `PROJECT_NAME` | string | |
| `PROCESSOR_USER_ID` | string | Reviewing FDEP staffer |
| `APPLICATION_RECEIVED_DATE` | date | When app received |
| `BEGIN_DATE` | date | Processing start |
| `PROCESSING_PERIOD` | int | Days allotted (typ. 30) |
| **`DUE_DATE`** | date | When inspection is due |
| **`END_DATE`** | date | When inspection completed (NULL if still open) |
| **`SITE_INSP_STATUS`** | string | `Pending`, `Approved`, etc. |
| `SITE_INSP_STATUS_RANK` | double | Numeric rank for sorting |
| `PP_PROJECT_ID` | int | Project ID join |
| `SITE_ID` | double | |
| `LATITUDE/LONGITUDE_DD/MM/SS` | numeric | |
| `SITE_ADDRESS` | string | |
| `CC_COUNTY_ID` / `COUNTY_NAME` | small int / string | County code/name |
| `OFFICE_ABBREV` / `OFFICE_DESCRIPTION` / `DISTRICT` | string | |
| `OBJECTID` / `GEOMETRY` | OID / point | |

**`COUNTY_NAME = 'BROWARD'` query confirmed working.**

### 3.3 Layer 4 — ERPce (Compliance & Enforcement), 43 fields

Where active environmental enforcement lives — sourced from FDEP's COMET system.

| Field | Type | Notes |
|---|---|---|
| `SIT_SITE_ID` | double | |
| `OTC_OWNERSHIP_TYPE_ID` | string | Public/private ownership |
| **`NAME`** | string | Site name (e.g. `BAHIA MAR`, `CITY OF FT. LAUD. - RIVERWALK @STRANAHAN HOUSE`) |
| `USERNAME` / `TIME_STAMP` | string / date | Last-edit metadata |
| `ADDRESS_1` / `ADDRESS_2` / `CITY` | string | |
| `SC1_STATE_ID` / `ZIP5` / `ZIP4` | string / int | |
| `CC_COUNTY_ID` | small int | County code |
| **`FEATURE`** | string | Type of feature (water, wetland, etc.) |
| `LAT_DD/MM/SS`, `LONG_DD/MM/SS` | numeric | |
| `DIRECTIONS` | string | Free-text directions to site |
| **`WATER_BODY`** / **`WATER_BASIN`** / `SPECIAL_HYDROLOGIC_BASIN` | string | Affected water |
| `TOWNSHIP_DIRECTION` / `TOWNSHIP` / `RANGE_DIRECTION` / `TS_RANGE` / `SECTION_` | smallint/string | Section/Township/Range |
| `APPRAISAL` / `METHOD` / `DATUM` | string | Geo source |
| **`DETERMINATION_DATE`** | date | When enforcement determination was made |
| `GEO_FEATURES` | string | |
| `WATER_BODY_CLASS_ID` / `WATER_BODY_TYPE_ID` | string | |
| `DETAILS` | string | Free-text enforcement details |
| `SITE_APPRAISER` | string | |
| `GIS_ALBX` / `GIS_ALBY` | double | Albers x/y |
| **`DOCUMENTS`** | string | Deep-link URL |
| `OBJECTID` / `GEOMETRY` | OID / point | |

### 3.4 Layer 7 — Broward & SFWMD Delegation Areas

7 fields describing **polygons of geography where Broward County itself is the ERP issuing authority** (not FDEP). Critical for understanding the gap between FDEP's data and the full Broward ERP universe.

| Field | Type | Notes |
|---|---|---|
| `OBJECTID` | OID | |
| `SHAPE` | polygon | Boundary geometry |
| `PERMIT_AGE` | string | Probably the age tier of the delegation |
| `GLOBALID` | string | |
| `NOTE` | string | Description / commentary |
| `SHAPE.LEN` / `SHAPE.AREA` | double | Geometry metadata |

---

## 4. Live Tests — Real Broward ERP data, fresh as of audit time

All counts captured live from the FDEP ArcGIS API on 2026-05-10.

### 4.1 Volume context

| Metric | Live value |
|---|---:|
| Total ERPs (Layer 1, 2007-present) statewide | **66,989** |
| Total Broward ERPs (Layer 1) | **2,249** |
| Currently OPEN/PENDING in Broward | **43** |
| Currently OPEN INDIVIDUAL (major-project) ERPs in Broward | **32** |
| New Broward ERPs in last 30 days | **14** |
| New Broward ERPs in last 7 days | **4** |
| Broward Site Inspection records (Layer 6) | 545 |
| Broward Site Inspections currently open (DUE_DATE passed, END_DATE null) | 511 |
| Broward ERPce (Compliance/Enforcement) records (Layer 4) | **1,944** |
| ERPs received statewide last 30 days | 408 |
| ERPs received statewide last 90 days | 1,216 |

**~14 Broward ERPs/month is exactly the right cadence for a curated daily editorial feed** — every record is a substantive lead, not a spam volume.

### 4.2 Permit-type breakdown — Broward, last 90 days

| Type | Count |
|---|---:|
| Water - Individual With No Conceptual Approval Permit | 18 |
| Water - ERP Noticed General Permit | 15 |
| Water - ERP Modifications | 5 |
| Water - ERP Formal Determination | 1 |

Individual permits are the major-project ones — bigger sites, more environmental review, more public-interest stories.

### 4.3 The 10 most-recent Broward ERPs (sample, ranked by RECEIVED_DATE)

Captured live; useful as both a freshness demo and an editorial-leads list:

| Rcv'd | App / Permit ID | Status | Project | Applicant | Site |
|---|---|---|---|---|---|
| **2026-05-07** | 0471625-001 | Pending | FPL WR13406300 | FRANCK LEBLANC / **FLORIDA POWER AND LIGHT** | SW 15TH STREET, FORT LAUDERDALE 33316 |
| **2026-05-06** | 0471593-001 | Pending | 2721 SEA ISLAND DR DOCK | KEVIN CROUSILLAT / **SE CONSTRUCTION & REAL ESTATE IV LLC** | 2721 SEA ISLAND DR, FORT LAUDERDALE 33301 |
| **2026-05-05** | 0471469-001-EG | **Issued/Effective** | OCEAN HARBOR - HARBOR DRIVE | LEONARD GAMBLE / **CRAVEN THOMPSON & ASSOCIATES** | 3013-3019 HARBOR DRIVE, FORT LAUDERDALE 33316 |
| **2026-04-30** | 0471351-001-EG | Issued | MEDICAL OFFICE BUILDING | ANTONIO QUEVEDO / **HSQ GROUP** | JOHNSON ST & NW 101ST AVE, PEMBROKE PINES 33026 |
| **2026-04-29** | 0471371-001 | Pending | 1745 SE 11TH ST | / **1745 SE 11TH STREET LLC** | 1745 SE 11TH ST, FORT LAUDERDALE 33316 |
| **2026-04-28** | 0358612-011 | Pending Mod | **LAS OLAS MARINA** | DAVID FILLER / **LAS OLAS SMI, LLC** | 240 & 300 E LAS OLAS CIRCLE, FORT LAUDERDALE 33316 |
| 2026-04-21 | 0457073-001 | Pending | BRUCATO HIDEAWAY SFH | MICHAEL BRUCATO | HIDEAWAY BAY DR, MIRAMAR |
| 2026-04-14 | 0470851-001-EG | Issued | ELITE SERVICE STATION C STORE | TYLER RICCI | 4090 SW 40TH AVE, HOLLYWOOD |
| **2026-03-31** | 0169108-006 | Pending Mod | **RIZAI DOCK EXTENSION** | MATTHEW RIZAI | **2401 DEL LAGO DRIVE**, FT. LAUDERDALE |
| 2026-03-20 | 0471555-001-EG | Issued 2026-05-07 | DF26-1100 | TABATHA TOLLEY / ELITE ENVIRONMENTAL PERMITTING SERVICES | 2738 NE 16TH ST, FORT LAUDERDALE |

### 4.4 🔥 Cross-reference test — does ERP data join to our existing pipeline?

Took the 6 Broward FTL-area ERP addresses above, joined against `permits` table in `db/permits.sqlite`. Three exact matches:

**Match 1: 2401 DEL LAGO DR (RIZAI DOCK EXTENSION)** — ERP filed 2026-03-31 → ours:

| Permit | Date | Owner | Contractor | Value | Status |
|---|---|---|---|---|---|
| ELE-GEN-26050070 | 2026-05-08 | RIZAI,MATTHEW & SVETLANA; MARITAL TR | **PRECISION TECH INC** | $4,100 | Plan Set Submitted |
| BLD-GEN-26050149 | 2026-05-07 | RIZAI,MATTHEW & SVETLANA; MARITAL TR | **YACHT LIFTERS INC** | $139,000 | Plan Set Submitted |
| BLD-RNC-21120005.CO001 | 2026-01-26 | (prior) | GULF BUILDING LLC | | Complete |

**This is the killer pattern.** ERP filed first (2026-03-31), city building permits filed 5–6 weeks later. Owner name on the ERP (Matthew Rizai) matches owner on the BCPA-derived owner_name on permits. The state ERP is a **leading indicator** of upcoming city building activity. Two distinct contractors (Precision Tech for electrical, Yacht Lifters for the dock structure) each match the ERP project scope.

**Match 2: 1745 SE 11TH ST (1745 SE 11TH STREET LLC)** — ERP filed 2026-04-29 → ours:

| Permit | Date | Owner | Contractor | Status |
|---|---|---|---|---|
| BLD-RNC-24120560.I005 | 2026-03-17 | (subpermit; parent project) | **GULF BUILDING LLC** | Complete |
| BLD-RNC-24120560.D003 | 2026-02-13 | | GULF BUILDING LLC | Complete |
| BLD-RNC-24120560.I004 | 2026-02-11 | | GULF BUILDING LLC | Complete |

ERP came AFTER initial building permit cycle — the LLC clearly added a waterfront/site element to its existing renovation, requiring a fresh ERP. **Pattern: ongoing build → mid-project ERP.** Adjacent address `1745 SE 10 ST LLC` is also active under JL LAVALLEE CONSTRUCTION — same single-address-LLC pattern, same block.

**Match 3: 2738 NE 16 ST (DF26-1100)** — ERP filed 2026-03-20, issued 2026-05-07 → ours:

| Permit | Date | Owner | Contractor | Status |
|---|---|---|---|---|
| BLD-GEN-26010474 | 2026-01-26 | | **KELLY MARINE CONSTRUCTION CORP** | Awaiting Client Reply |

City building permit filed Jan 26, ERP filed Mar 20 — **building permit was filed BEFORE the ERP**, which is technically out of order (ERP should precede water-affecting work). Status `Awaiting Client Reply` suggests city was waiting for the ERP before clearing. **This is a workflow-blocker pattern** — building permit can't progress until the state ERP issues.

**No-match cases** (3013-3019 Harbor Drive, 240 E Las Olas Circle / Las Olas Marina, 2721 Sea Island Dr) — these may be projects bypassing FTL Accela because they're county-administered or city-managed special projects (Las Olas Marina is a public-private redevelopment); or they may have permits coming in the next few weeks. **Worth setting up a watch on each — they're the kind of project that becomes editorial news.**

### 4.5 Waterfront permit volume in our DB (cross-context)

| Slice | Count |
|---|---:|
| Permits with dock/marina/seawall/waterfront keywords (2025-26) | **387** |
| Permits on streets with `isle/bay/harbor` in name (2025-26) | **3,186** |

Many of these should have ERPs — and the cross-reference will surface (a) projects that have ERPs (rule-following) and (b) projects that *should* have ERPs but don't (potential code violation, editorial lead).

---

## 5. Pricing & Limits

- All ERP REST endpoints: **$0**
- No registration, no API key, no rate limit observed
- Standard ArcGIS REST query limits: max **1,000 records per call** — paginate via `where=OBJECTID > <last>` or `resultOffset` / `resultRecordCount`
- DOCUMENTS PDFs hosted on `prodenv.dep.state.fl.us/DepNexus/` are also free and unauthenticated
- Public-records request via FDEP would be the path if we ever want a CSV/SHP dump — but the live API is sufficient for everything we need

---

## 6. Automation Feasibility

### 6.1 The right architecture: poll the ArcGIS REST API daily

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 0_FDEP_ERP_NIGHTLY.command   (new launchd at ~04:00 ET)                  │
│ source .venv/bin/activate                                                │
│ python3 scripts/pull_fdep_erp.py --county Broward --since-watermark      │
│   → query ERP MapServer/1 with WHERE RECEIVED_DATE >= last_watermark      │
│   → query ERP MapServer/1 with WHERE AGENCY_ACTION_DATE >= last_watermark │
│   → query ERP MapServer/4 (Compliance & Enforcement) for new actions     │
│   → query ERP MapServer/6 (Site Inspections) for status changes          │
│   → store in enrichment_fdep_erp / _erpce / _inspection tables           │
│   → uses writer_lock                                                     │
│   → defaults --report-only; mutation needs --fix                         │
│ python3 scripts/match_permits_to_erp.py --report-only                    │
│   → produce candidate matches: permits.address ~= erp.STREET_ADDRESS      │
│ scripts/quality_checks.py --severity warn                                │
└──────────────────────────────────────────────────────────────────────────┘
```

Daily request budget for Broward: ~5–10 small queries = trivial load. Nightly script ends in seconds.

### 6.2 New-filing detection — three windows

The user explicitly asked for "new filings / new anything." The ERP service supports three different freshness queries simultaneously, all against `RECEIVED_DATE` and `AGENCY_ACTION_DATE`:

1. **Newly-filed applications** (open distress / project-start signal):
   `WHERE RECEIVED_DATE >= DATE 'YYYY-MM-DD' AND DEFINED_STATUS = 'OPEN'`
2. **Newly-issued permits** (project-now-cleared signal):
   `WHERE AGENCY_ACTION_DATE >= DATE 'YYYY-MM-DD' AND DEFINED_STATUS = 'CLOSED'`
3. **Newly-filed enforcement actions** (compliance issue signal):
   `WHERE DETERMINATION_DATE >= DATE 'YYYY-MM-DD'` against Layer 4

Plus inspections changing state (Layer 6 `END_DATE` going from null → date).

### 6.3 What works / doesn't

| Capability | Status |
|---|---|
| ArcGIS REST `/query` with WHERE clause | ✅ |
| Date filtering (`DATE 'YYYY-MM-DD'`) | ✅ verified |
| County/city filtering | ✅ via `UPPER(CITY) LIKE '%LAUDERDALE%'` etc. |
| Geometry (return as point or skip) | ✅ |
| Full field output | ✅ (`outFields=*`) |
| Statistics (counts, sums) | ✅ (`returnCountOnly=true`) |
| Order by date | ✅ |
| Pagination | ✅ via `resultOffset` |
| GeoJSON output | ✅ (`f=geojson`) |
| Document PDFs deep-link | ✅ via `DOCUMENTS` field |
| Robots.txt restriction | none |
| Rate limit | none observed |

### 6.4 Caveats

- Layer 1 only contains **FDEP-direct ERPs**. **Broward County–delegated ERPs** (Layer 7 covers the geography) need to be fetched from Broward County's own system (or from Layer 3 "ERP from PA" which mirrors PA tracking). The user's question "what about everything else" matters here — **we should also probe Broward County's ERP delegation portal** (probably under broward.org/Environment or similar) in a follow-on audit.
- **SFWMD-issued ERPs** (the bulk of South Florida ERPs by volume) live at `https://my.sfwmd.gov/permitportal` and `https://gisweb.sfwmd.gov/arcgis/rest/services/` — likely a similar ArcGIS REST surface, deserving its own audit. **This is the single biggest known gap and should be the next audit.**
- Some address formats don't match perfectly (e.g. `2401 DEL LAGO DRIVE` vs `2401 DEL LAGO DR` in our DB). Normalize street-type abbreviations (DR/DRIVE, ST/STREET, AVE/AVENUE, BLVD/BOULEVARD) on both sides before matching.

---

## 7. 🔥 Unified Cross-Source Intelligence Layer

*This section directly addresses the user's request: "tell us how we can incorporate with other findings in this entire chat for intelligence."*

The three external audits in this chat (Broward Records, Broward BCS, FDEP ERP) plus the existing Florida Signal pipeline (Accela, BCPA, Sunbiz, geocoder, Supabase mirror) together form a **multi-source property/owner/contractor graph** that is unique in Broward County journalism and unmatched by any commercial provider for this market. Below is how it composes.

### 7.1 The five join axes

Every signal we want to compute is a join across two or more of these data axes:

| Axis | Canonical key | Sources contributing |
|---|---|---|
| **Property (parcel)** | BCPA folio (12-char alphanumeric, e.g. `504211221640`) | BCPA · Permits.parcel_id · Records lgl-ver.parcel_id · BCS Folio · FDEP ERP via lat/lon→folio reverse-geocode |
| **Address (text)** | Normalized street + city + ZIP | All sources (with normalization required) |
| **Owner (person/LLC)** | `owner_resolution` table (landed 2026-05-05) — normalized owner name + Sunbiz doc | Permits.owner_name · BCPA owner_name · Records nme-ver (D party) · BCS Parcel Owner · FDEP ERP APPLICANT_NAME · Sunbiz |
| **Contractor (firm)** | Normalized contractor name + license number (BCS CC# / FL DBPR #) | Permits.contractor_name · Records nme-ver (R on NOC) · BCS Contracting Firm · BCS CC# · (FL DBPR — separate audit needed) |
| **Document / Case** | Instrument # · Case # · CU # · CC # · ERP Permit ID · POSSE Object ID · BCPA folio | Each source is the source-of-truth for its own keys; we maintain cross-reference rows |

Florida Signal already has the parcel + address + owner + contractor axes resolved at the permit level. The three external audits add **new sources for each axis**, plus they add **NEW types of records** that exist outside the permit world (liens, NOCs, CUs, code-enforcement cases, Unsafe-Structure cases, ERPs, environmental enforcement). Together they enrich every existing permit row and surface new property-events that don't appear in any single permit dataset.

### 7.2 The composite event timeline

Every property in our pipeline gets a **timeline of events** assembled from all sources, in chronological order. For a given parcel, the timeline now looks like:

```
Year 0    ──  BCPA owner change                                   [BCPA + Records D-doc]
              ↓ (often paired with new Mortgage)                  [Records M-doc]
Year 0+30 ──  Notice of Commencement filed                        [Records NOC + nme-ver]
              ↓ (within ±60d)
Year 0+45 ──  Building permit issued (city)                       [Permits.permit_number]
              ↓
Year 0+50 ──  FDEP ERP filed (if waterfront/wetland/stormwater)   [FDEP ERP layer 1]
              ↓
Year 0+90 ──  ERP issued                                          [FDEP ERP AGENCY_ACTION_DATE]
              ↓
Year 0+120 ── Sub-permits / inspections                           [Permits.* + FDEP ERP layer 6]
              ↓
Year 0+360 ── Certificate of Use (commercial)                     [BCS CU]
              ↓
              [optional] Mechanic's lien filed                    [Records LIE]
              [optional] Unsafe Structure case opened              [BCS Layer]
              [optional] Code enforcement case opened              [BCS Layer]
              [optional] Environmental enforcement (ERPce)         [FDEP Layer 4]
              [optional] Lis Pendens / foreclosure judgment        [Records LP / FJ / CFJ]
              [optional] Lien satisfied / released                 [Records RST]
              [optional] Re-sale (next deed)                       [Records D-doc + Permits owner change]
```

Every node in that timeline is **dateable** and has a structured source URL. That's the core data product.

### 7.3 Composite signals — what becomes computable

These are *source-locked enrichment facts*; they go into new `enrichment_*` tables. Per the project's "scoring is paused" rule, none of these become signal scores until Andy un-pauses scoring. But the underlying facts can land now.

| Signal | Sources required | Value |
|---|---|---|
| **NOC↔permit confirmation** | Records NOC + Permits | Did construction actually start? |
| **ERP→permit predictive lead** | FDEP ERP + Permits | Building permit incoming on this parcel within ~60 days |
| **Owner-distress stack** | Records (Lien/LP/FJ) + BCS (Unsafe Structure) + Permits (Expired) + FDEP ERPce | All-source distress; the gold-standard signal |
| **Contractor reputation index** | Permits + BCS CC license-status + Records lien-velocity (R-party on liens) + FDEP ERP applicant role | Is this contractor rule-following, license-current, dispute-prone? |
| **Tenant turnover (commercial)** | BCS CU `Change of Use or Occupant` events + Records D-docs | Is this commercial property cycling tenants? |
| **Permit without NOC** | Permits + Records NOC | Permit issued but no NOC filed → potentially unpermitted construction |
| **Permit without ERP for waterfront** | Permits (waterfront keywords) + FDEP ERP | Dock/seawall permit filed but no ERP → potential FDEP violation |
| **NOC without permit** | Records NOC + Permits | NOC filed but no city building permit followup → stalled project |
| **Open lien + new permit** | Records LIE/RST + Permits | Property owner pulling permits while lien is unresolved |
| **Open Unsafe Structure + new permit** | BCS Unsafe Structure + Permits | Property under structural defect notice yet new permits being pulled (rare; potential repair-permit pattern, also potential safety story) |
| **Brownfield + new permit** | FDEP BROWNFIELD_AREAS + Permits | Permits being pulled on brownfield-designated land |
| **Cleanup site + new permit** | FDEP CLEANUP_SP + Permits | Active environmental cleanup at parcel where construction is starting |
| **Outstanding-Florida-Waters proximity + permit** | FDEP OFW + Permits (geo) | Permit within X meters of OFW boundary — heightened scrutiny |
| **Aquatic Preserve proximity + permit** | FDEP AQUATIC_PRESERVES + Permits (geo) | Construction near protected waters |
| **Repeat-offender contractor** | BCS Unsafe Structure + Permits.contractor_name | Contractors associated with multiple unsafe-structure outcomes |
| **Tax-warrant lien + commercial CU active** | Records LIE (Broward TDT warrants) + BCS CU + Tourist Tax registry | Vacation-rental operators who are TDT-delinquent and still operating |

### 7.4 Daily intelligence brief — the editorial product

Wiring this together, the Florida Signal **morning brief** becomes:

```
═══════════════════════════════════════════════════════════════════
  FLORIDA SIGNAL · DAILY BROWARD BRIEF · MM/DD/YYYY
═══════════════════════════════════════════════════════════════════

WHAT'S NEW (24h):
  PERMITS:        +X new permits applied · +Y issued · +Z expired
  RECORDS:        +A liens filed · +B NOCs · +C Lis Pendens · +D releases
  ERP (state):    +E ERPs filed in Broward · +F issued
  BCS:            +G new code-enforcement cases · +H Unsafe Structure
  CONTRACTORS:    +I new licenses · +J voided

LEADING INDICATORS (FUTURE PERMITS):
  ─ NOC filed without matching permit         (N rows, sample 5)
  ─ ERP filed without matching permit         (N rows, sample 5)
  ─ Lis Pendens filed → likely foreclosure    (N rows, sample 5)

DISTRESS SIGNALS (PRIORITY):
  ─ Property with open lien + active permits   (top 5 by stack height)
  ─ Property with open Unsafe Structure case   (top 5 by recency)
  ─ Permit-issued contractor with void license (top 5 by permit count)
  ─ Multi-source distress stack ≥3 sources    (top 10)

RIGHT-NOW WATERFRONT:
  ─ Big Broward dock/marina ERPs issued today (sample 5)
  ─ ERP→permit pairs converging (e.g. RIZAI DOCK)

COMMERCIAL TURNOVER:
  ─ Today's new CUs (BMSD)
  ─ Today's CU "Change of Use or Occupant" events

HISTORICAL CONTEXT:
  ─ 25-year-old "Open" Unsafe Structure cases revisited

FLAGGED FOR EDITORIAL:
  ─ <human-curated leads from above>
═══════════════════════════════════════════════════════════════════
```

This is the product. The three external audits + the existing pipeline make every line of this brief computable from automated, source-locked daily ingests.

### 7.5 Implementation map — order of operations

The propose→QA→approval→apply cycle for this is layered:

| Phase | Deliverable | Doc reference |
|---:|---|---|
| **P0** | Andy approves moving forward with multi-source intelligence vision (this report counts as propose) | This doc |
| **P1** | Implement Broward Recording SFTP daily feed | `docs/BROWARD_LIENS_AUDIT_2026-05-10.md` § 8.3 |
| **P1** | Implement BCS HTML-scrape daily feed (contractor + Unsafe Structure first) | `docs/BROWARD_BCS_AUDIT_2026-05-10.md` § 8.3 |
| **P1** | Implement FDEP ERP REST API daily feed (this audit) | This doc § 6 |
| **P1** | Each source lands as `enrichment_*` source-locked tables (no scoring) | All 3 plans |
| **P2** | Extend `owner_resolution` to also resolve contractor names, business owners, ERP applicants | All 3 plans |
| **P2** | Address normalization service (FDEP ↔ Records ↔ BCS ↔ permits.address) | this doc § 6.4 |
| **P2** | Cross-source join scripts producing `enrichment_property_event_timeline` | this doc § 7.2 |
| **P2** | Daily intelligence brief generator → markdown email + dashboard widget | this doc § 7.4 |
| **P3** | Audit SFWMD ArcGIS REST + Broward County's own ERP delegation portal — close the ERP coverage gap | (next audit, not yet run) |
| **P3** | Audit FL DBPR (state contractor licenses) — close the contractor-license gap | (separate audit) |
| **P3** | Add Brownfield, Cleanup Sites, OFW, Aquatic Preserves overlays to enrichment | this doc § 2.2 |
| **P3** | When/if scoring is un-paused: build the cross-source distress score | All 3 plans |

---

## 8. Recommendations

### 8.1 Best way to get FDEP ERP data daily

**Use the ArcGIS REST API.** Specifically: nightly poll of layers 1, 4, 6, plus Layer 0 (SPGP) for full coverage. Watermark by `RECEIVED_DATE` for new applications and `AGENCY_ACTION_DATE` for status changes; for Layer 6 watermark by `END_DATE`. **Trivial daily request budget. No auth, no rate limit, no scrape brittleness.**

### 8.2 Red flags

- **Layer 1 ≠ all Broward ERPs.** Broward County–delegated permits and SFWMD-issued permits aren't here. **Audit SFWMD next** — that's the most important gap.
- **Address normalization is non-trivial.** `2401 DEL LAGO DRIVE` (FDEP) vs `2401 DEL LAGO DR` (our DB) — must normalize street type abbreviations. Build the canonical mapping once, share across all 4 ingests.
- **DOCUMENTS URLs depend on FDEP's DepNexus uptime.** Don't assume the URL is permanent in the long term — store the URL plus the document IDs separately.
- **Coordinate datum.** FDEP uses WKID 6439 (FL Albers); BCPA + permits use WGS84 lat/lon. ArcGIS REST handles re-projection on output (`outSR=4326`), but be explicit.
- **The "Pending" Broward Site Inspections (511 of 545)** are not "overdue" in the operational sense — they're "scheduled but not yet completed", which is the normal state for a permit in active processing. Don't false-alarm on this.

### 8.3 Prioritized next steps (Florida Signal–specific)

| Priority | Action | Effort | Gating |
|---:|---|---|---|
| **P0** | Andy approval to spec out FDEP ERP Phase-1 ingest (this report = propose step) | — | — |
| **P0** | Andy approval of the unified cross-source intelligence layer roadmap (§ 7.5) | — | — |
| **P0** | Decision on whether to do **SFWMD audit** before or after FDEP ERP ingest. (Recommend: do SFWMD audit first; SFWMD likely has 5-10× the Broward ERP volume) | discussion | — |
| **P1** | New canonical doc `docs/FDEP_ERP_IMPLEMENTATION_PLAN_2026-05-10.md` mirroring the cache-separation/enrichment-backfill plan format | 30 min | Plan approved |
| **P1** | Build `scripts/pull_fdep_erp.py` (`requests`-based, REST queries, watermarked) + `0_FDEP_ERP_NIGHTLY.command` wrapper. Source venv. PIPESTATUS guard. writer_lock. Defaults dry-run. | ~3-4 hrs incl. testing | Plan approved |
| **P1** | DDL for `enrichment_fdep_erp` (Layer 1), `enrichment_fdep_erpce` (Layer 4), `enrichment_fdep_erp_inspection` (Layer 6) | 30 min + ChatGPT QA | Plan approved |
| **P1** | New launchd agent `com.floridasignal.fdep-erp-nightly.plist` ~04:00 ET. Plist follows python3-trampoline doctrine. | 30 min | Wrapper landed |
| **P2** | Build address normalization helper (canonical for all 4 sources: FDEP/Records/BCS/permits) | ~4 hrs | P1 ingest stable |
| **P2** | Build `scripts/match_permits_to_erp.py` cross-reference resolver. Read-only by default; mutation requires `--fix` | ~1 day | Address normalizer + P1 stable |
| **P2** | Mirror new FDEP tables into Supabase (`MIRROR_TABLES` 22 → 25-ish across all 3 audits) | 1 hr | Tables stable locally |
| **P2** | Daily intelligence-brief generator (markdown export + dashboard widget) | 1-2 days | All 3 P1 ingests stable |
| **P3** | **SFWMD audit** — same Map Direct / ArcGIS REST pattern likely; close the SFWMD ERP gap | 1 day audit + 1 day implementation | P1 stable |
| **P3** | Adjacent FDEP overlays: BROWNFIELD_AREAS, CLEANUP_SP, OFW, AQUATIC_PRESERVES, IMPAIRED_WATERS as additional enrichment overlays | 1 day each, picked off in priority order | P1 stable |
| **P3** | **FL DBPR (state contractor licenses) audit** — close the contractor-license gap | separate audit | P1 stable |
| **P3** | When/if scoring un-paused: combined distress score across all sources | unknown | Andy un-pauses scoring |

### 8.4 What this audit explicitly did NOT do

- Did not audit **SFWMD's permit portal** (the single biggest gap; should be the next audit)
- Did not audit **Broward County's own ERP delegation portal** (per Layer 7 it exists; should be a follow-on)
- Did not exhaustively probe all 95+ FDEP open-data services — only ERP. Adjacent layers (Brownfield, Cleanup, OFW etc.) are scoped out for Tier-2/3.
- Did not attempt a full historical backfill (2007-present = 66,989 records, doable but takes maybe 2-3 hrs of paginated REST calls — defer to implementation phase)
- Did not write any data into Florida Signal tables
- Did not start any launchd agents or scrapers
- Did not run any wet writes

---

## Appendix A — Quick-test commands you can run yourself

```bash
# Service discovery — all FDEP open data
curl -s 'https://ca.dep.state.fl.us/arcgis/rest/services/OpenData?f=json' | python3 -m json.tool | head -60

# ERP service root (lists all 8 layers)
curl -s 'https://ca.dep.state.fl.us/arcgis/rest/services/OpenData/ERP/MapServer?f=json' | python3 -m json.tool | head -60

# Layer 1 schema
curl -s 'https://ca.dep.state.fl.us/arcgis/rest/services/OpenData/ERP/MapServer/1?f=json' | python3 -m json.tool

# Most-recent Broward ERPs (last 30 days)
curl -s --get 'https://ca.dep.state.fl.us/arcgis/rest/services/OpenData/ERP/MapServer/1/query' \
  --data-urlencode "where=UPPER(CITY) LIKE '%LAUDERDALE%' AND RECEIVED_DATE >= DATE '$(date -v-30d '+%Y-%m-%d')'" \
  --data-urlencode 'outFields=PROJECT_NAME,APPLICANT_NAME,STREET_ADDRESS,CITY,RECEIVED_DATE,AGENCY_ACTION,DEFINED_STATUS,PERMIT_ID,APPLICATION_ID,DOCUMENTS' \
  --data-urlencode 'orderByFields=RECEIVED_DATE DESC' \
  --data-urlencode 'returnGeometry=false' \
  --data-urlencode 'f=json' | python3 -m json.tool | head -80

# Count Broward ERPs filed in last 7 days
curl -s --get 'https://ca.dep.state.fl.us/arcgis/rest/services/OpenData/ERP/MapServer/1/query' \
  --data-urlencode "where=(UPPER(CITY) LIKE '%LAUDERDALE%' OR UPPER(CITY) LIKE '%HOLLYWOOD%') AND RECEIVED_DATE >= DATE '$(date -v-7d '+%Y-%m-%d')'" \
  --data-urlencode 'returnCountOnly=true' --data-urlencode 'f=json'

# View documents for a specific ERP
open 'https://prodenv.dep.state.fl.us/DepNexus/public/electronic-documents/ERP_471469/gis-facility!search'
```

## Appendix B — Quick reference card

```
ROOT API:          https://ca.dep.state.fl.us/arcgis/rest/services/OpenData/
PRIMARY SERVICE:   /OpenData/ERP/MapServer
COPYRIGHT:         FDEP, WRM, ERP

LAYERS:
  0 ERP SPGP (2012-present)                    Point  – State Programmatic General Permit
  1 ERP (2007-present)                         Point  – PRIMARY — current direct-DEP permits
  2 ERP (Historic)                             Mpoint – pre-2007
  3 ERP from PA                                Point  – PA tracking-system mirror (incl. delegated)
  4 ERPce Compliance & Enforcement             Point  – COMET enforcement subset
  5 ERP Conservation Easements                 Point  – regulatory CEs
  6 ERP Site Inspection Status                 Point  – inspection workflow tracking
  7 ERP Delegation Areas BR + SFWMD            Polygon – polygons of delegated authority

KEY FIELDS (Layer 1):
  PERMIT_ID                  e.g. 0471469-001-EG
  APPLICATION_ID             e.g. 0471625-001
  PROJECT_NAME, APPLICANT_NAME, APPLICANT_COMPANY
  STREET_ADDRESS, CITY, ZIP5
  LATITUDE_DD/MM/SS, LONGITUDE_DD/MM/SS
  RECEIVED_DATE              ← 🔥 freshness
  AGENCY_ACTION_DATE         ← 🔥 status change
  PERMIT_STATUS              Pending / Issued
  DEFINED_STATUS             OPEN / CLOSED
  PERMIT_TYPE                Individual With No Conceptual Approval / Noticed General / Modifications / Formal Determination
  DOCUMENTS                  URL → DepNexus PDF deep-link

QUERY URL TEMPLATE:
  https://ca.dep.state.fl.us/arcgis/rest/services/OpenData/ERP/MapServer/<layer>/query
    ?where=<SQL where clause>
    &outFields=*
    &orderByFields=RECEIVED_DATE+DESC
    &returnGeometry=false
    &f=json

LIVE BROWARD VOLUMES (2026-05-10):
  Total ERPs (Layer 1):           2,249
  Currently OPEN:                    43
  OPEN Individual permits:           32
  New last 30 days:                  14
  New last 7 days:                    4
  ERPce enforcement records:      1,944
  Site inspections:                 545 (511 currently open)

CROSS-REFERENCE WIN:
  ERP "RIZAI DOCK EXTENSION" 2026-03-31 at 2401 DEL LAGO DR ↔
  Permits BLD-GEN-26050149 ($139K, YACHT LIFTERS INC) + ELE-GEN-26050070 (PRECISION TECH INC),
  filed 2026-05-07/08 ── ERP-→-permit lead time ~5–6 weeks.

ADJACENT FDEP OPEN-DATA SERVICES OF INTEREST:
  /OpenData/CLEANUP_SP            – contaminated-site cleanup tracking
  /OpenData/BROWNFIELD_AREAS      – brownfield redevelopment zones
  /OpenData/COASTAL_ENV_PERM      – Coastal Environmental Permits
  /OpenData/COASTAL_JCP           – Joint Coastal Permits
  /OpenData/MITIGATION_BANKS      – wetland mitigation banks
  /OpenData/AQUATIC_PRESERVES     – protected waters
  /OpenData/OFW                   – Outstanding Florida Waters
  /OpenData/IMPAIRED_WATERS       – TMDL/impaired water bodies
  /OpenData/SEPTIC_SYSTEMS        – septic data
  (95+ services total)
```

---

*End of audit. Together with the prior two audits in this chat, this completes the multi-source external-data picture for Broward. Recommended next session prompt: "approved — produce the FDEP ERP implementation plan doc per § 8.3 P1, AND scope an SFWMD audit per § 8.3 P3."*
