# Three-Source Audit — FAA OE/AAA · Broward Clerk + Foreclosure · Utility Connection / Water-Sewer

*Auditor: Claude (read-only research). Date: 2026-05-10. Sources audited: (1) FAA Obstruction Evaluation / Airport Airspace Analysis at `oeaaa.faa.gov`; (2) Broward Clerk of the Courts case search at `browardclerk.org` plus the foreclosure-sales portal at `broward.realforeclose.com`; (3) Broward County Water & Wastewater Services + the Broward GIS REST infrastructure that backs it. Tests ran live; cross-references verified against `db/permits.sqlite` (read-only). Editorial output — does NOT trigger the 7-step doc-update rule. No live state was changed.*

*This is the fourth audit in this chat. The previous three (Broward Recording / liens-NOCs, Broward BCS / contractors-CUs-Unsafe Structure, FDEP ERP / environmental) build a multi-source intelligence picture; this one closes three more important gaps and consolidates the unified-intelligence plan.*

---

## TL;DR — APIs available?

This is the user's direct question. Short answer per source:

| Source | API? | Notes |
|---|:--|---|
| **FAA OE/AAA** | ✅ **Official RESTful API + WADL spec + weekly bulk CSVs** | 11 GET endpoints at `oeaaa.faa.gov/oeaaa/services/`, no auth, XML response. Plus weekly Saturday-night CSV exports. Tested live: 4,623 ASNs returned for FL/2026 in a single call. |
| **Broward Clerk Case Search** | ❌ No API | reCAPTCHA-gated HTML form at `browardclerk.org/Web2`. Scrape-only; limited to 200 results per query. |
| **Broward Foreclosure Auction** | ⚠️ No documented API but **fully iterable URLs** | RealAuction-powered at `broward.realforeclose.com`. URL `index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AUCTIONDATE=MM/DD/YYYY` is publicly iterable by date, no login required for the auction calendar + property list. Daily polite scrape works. |
| **Broward Water & Wastewater** | ✅ **ArcGIS REST FeatureServer** (Esri AGOL tenant `JMAJrTsHNLrSsWf5`) | 674 total Broward AGOL services discovered, including `WaterandSewer`, `WaterSewerDrainage_WFL1`, `PumpStations`, `QAlert_WaterServiceAreas`, `BCPA_Parcels`. Same query pattern as FDEP ERP. |
| **FTL Engineering / Utility permits** | ✅ Via existing LauderBuild Accela (we already pull) | Engineering / utility permits (ROW-SEW-, ROW-, etc.) flow through the same Accela instance we already ingest for building permits. |

---

## 1. FAA OE/AAA — Tall structures, cranes, towers

### 1.1 What it is

The FAA Obstruction Evaluation / Airport Airspace Analysis program is the **federal review of any structure that could affect navigable airspace** — typically anything **over 200 ft** above ground level, OR shorter structures within proximity to airports. Filed via **Form 7460-1** (proposed) or **7460-2** (notice of completion). Cases are reviewed by the FAA region — Florida is region **ASO** (Atlanta Southern Office).

For a Florida Signal pipeline, this is **the earliest leading indicator for any vertical project**: developers must file with the FAA before the city even sees a permit application for a tall structure. The OE/AAA database also includes **construction cranes** (the temporary cranes used during build-out), which means we get a signal on the *active build phase* of every high-rise and major commercial.

### 1.2 The three access methods (all free)

#### a. Web search portal — `oeaaa.faa.gov`

5 search modes: FAA Region, State, Circle (around a point), Map Bounds (bbox), ID (Aeronautical Study Number / ASN). Ad-hoc human use only.

#### b. Bulk weekly CSV exports

Path: portal Download → "Download Case Info" tab. Three CSV download types per Region + Year:

- **Part77 Cases** — OE + NRA cases plus frequencies in JSON format
- **On Airport Non Part77 Cases**
- **On Airport Non Part77 Cases' Frequencies**

**Generated weekly on Saturday evenings.** Each CSV has a timestamp. Free, no auth, downloadable from the public Download page.

#### c. RESTful Web Services (the API) — official + WADL-described

Discovery URL: `https://oeaaa.faa.gov/oeaaa/external/content/Public%20WADL.xml`
User Guide: `https://oeaaa.faa.gov/oeaaa/downloads/usermanuals/moe/External%20Web%20Services%20Guide_V_2025-DEC.pdf` (1 MB)

Base URL: `https://oeaaa.faa.gov/oeaaa/services/`

**11 GET endpoints, no auth, XML response (`Accept: application/xml`):**

| Resource | What it returns |
|---|---|
| `case/NRA/{asn}` | Notice of Required Action by ASN |
| `case/OE/{asn}` | Obstruction Evaluation case by ASN |
| `case/{asn}` | Generic case by ASN |
| `caseList/circ/{state}` | Circle search by state (full case detail list) |
| `asnList/circ/{state}` | Same, ASN-only (just IDs, much smaller payload) |
| `caseList/date/{type}` | By date range (`?start=MM/DD/YYYY&end=MM/DD/YYYY`) |
| `asnList/date/{type}` | Same, ASN-only |
| `caseList/{type}/{year}` | By year (`?region=&state=&dateEnteredStart=&dateEnteredEnd=`) |
| `asnList/{type}/{year}` | Same, ASN-only |

`{type}` = `OE` or `NRA`.

### 1.3 Live-tested volume + field schema

**Live test — Florida / 2026 ASNs:**

```
GET https://oeaaa.faa.gov/oeaaa/services/asnList/OE/2026?state=FL
→ HTTP 200, 124,723 bytes, 4,623 ASNs returned
First 5: 2026-ASO-1-OE, 2026-ASO-9-OE, 2026-ASO-11-OE, 2026-ASO-12-NRA, 2026-ASO-13-NRA
```

ASNs follow the format `YYYY-{Region}-{Sequence}-{Type}` where Region for FL = `ASO`, Type = `OE` (Obstruction Eval) or `NRA` (Notice of Required Action).

**Live case detail captured (`2026-ASO-100-OE`)** — full XML field schema:

```xml
<OECase>
  <caseId>688707367</caseId>
  <asn>2026-ASO-100-OE</asn>
  <asnSequence>100</asnSequence>
  <dateEntered>2026-01-05</dateEntered>
  <expirationDate>2027-07-12</expirationDate>
  <dateCompleted>2026-01-12</dateCompleted>
  <caseType>OE</caseType>
  <nearestAirportName>PETER PRINCE FLD</nearestAirportName>
  <nearestState>FL</nearestState>
  <nearestCity>MILTON</nearestCity>
  <siteElevationProposed>27</siteElevationProposed>
  <aglStructureHeight>65</aglStructureHeight>
  <aglStructureHeightDet>65</aglStructureHeightDet>
  <statusCode>DET-DNE-TMP</statusCode>
  <recommendedMarkLightType>Flag Marker</recommendedMarkLightType>
  <year>2026</year>
  <sponsor>Florida Power &amp; Light - Gulf</sponsor>
  <faaGeographyId>ASO</faaGeographyId>
  <distanceFromNearestAirport>10078.0</distanceFromNearestAirport>
  <directionFromNearestAirport>247.0</directionFromNearestAirport>
  <structureDescription>WR13669191 LOC 92</structureDescription>
  <structureType>CONSTRUCTION$OTHER</structureType>
  <locatorId>2R4</locatorId>
  <latitude>30.626925</latitude>
  <longitude>-87.02325</longitude>
  <receivedDate>2026-01-05T12:39:11.495-05:00</receivedDate>
  <amslOverallHeightProposed>92</amslOverallHeightProposed>
  <amslOverallHeightDet>92</amslOverallHeightDet>
  <latLongAccuracy>4D</latLongAccuracy>
</OECase>
```

**Field catalog** (28 fields per case):

| Field | Notes |
|---|---|
| `caseId`, `asn`, `asnSequence` | Identity / permalink keys |
| `dateEntered` | 🔥 Filing date — the **freshness signal** |
| `expirationDate` | When the determination expires |
| `dateCompleted` | When FAA completed review |
| `caseType` | OE / NRA |
| `nearestAirportName`, `nearestCity`, `nearestState`, `distanceFromNearestAirport`, `directionFromNearestAirport` | Aviation context |
| `siteElevationProposed` | Site elevation (ground) |
| `aglStructureHeight`, `aglStructureHeightDet` | Above Ground Level proposed / determined — **the actual height** |
| `amslOverallHeightProposed`, `amslOverallHeightDet` | Above Mean Sea Level (ground + structure) |
| `statusCode` | E.g. `DET-DNE-TMP` (Does Not Exceed obstruction standards, Temporary) |
| `recommendedMarkLightType` | E.g. Flag Marker, Red Steady Lights, Strobes |
| `sponsor` | **Owner / developer of the project** — e.g. "Florida Power & Light - Gulf" |
| `structureDescription` | Free-text description |
| `structureType` | Controlled vocabulary (CONSTRUCTION$OTHER, BLDG$RESIDENTIAL, ANTENNA$TOWER, CRANE, etc.) |
| `latitude`, `longitude`, `latLongAccuracy` | 🔥 Geographic coordinates — **how to filter to Broward** |
| `receivedDate` | Timestamped to milliseconds |
| `locatorId` | FAA airport code/identifier |
| `faaGeographyId` | Region (ASO for FL) |

### 1.4 Joining FAA OE/AAA back to Florida Signal

**Primary join axis: lat/lon → BCPA folio reverse-geocode.** FAA cases don't carry parcel IDs or street addresses — they carry latitude/longitude + nearest airport. Ingest pipeline:

1. Pull all FL ASNs for the year via `asnList/OE/{year}?state=FL`
2. For each ASN matching Broward bbox (`25.95–26.40 lat, -80.50 to -80.05 lon`), fetch full case
3. Reverse-geocode lat/lon to BCPA folio (we have `bcpa_property_card` + the parcel polygon layer in our pipeline already)
4. Join folio → permits.parcel_id

**Filter rules for Broward signal value:**

- **`structureType = CRANE`** → there's an active crane on this site **right now** (or about to be)
- **`structureType` LIKE `BLDG$%` AND `aglStructureHeight > 200`** → high-rise project
- **`statusCode` = `DET-DNE`** (not Temporary) → permanent determination — large project getting cleared
- **`sponsor` LIKE `%LLC%`** → developer LLC; cross-reference to Sunbiz
- **`dateEntered` last 30 days** → fresh leads

### 1.5 Free email alerts

Per the user's source description: "Register for free email alerts on specific airports." This is via the FAA portal user account — register an account, choose airports of interest, get alerts when new ASNs are filed near those airports. Useful for journalism: subscribe to FXE, FLL, HWO airports = covers all of Broward.

---

## 2. Broward Clerk + Foreclosure Auction — Court / Lis Pendens / Foreclosure

### 2.1 Site map

`browardclerk.org` (Brenda D. Forman, Clerk of the Courts) is the front-door for **all court records** in Broward. Two distinct surfaces:

- **Case Search Public** at `/Web2` — search any court case
- **Circuit Civil Foreclosure Sales** that delegate to **`broward.realforeclose.com`** for the auction-bidding portal (RealAuction platform)

### 2.2 Case Search Public

URL: `https://www.browardclerk.org/Web2`

4 search tabs:

- **Party Name** — Last + First + Middle + Date Range + Court Type dropdown
- **Business Name** — same shape
- **Case Number** — direct lookup
- **Citation Number** — direct lookup

**Court Type dropdown values** (controlled vocabulary):

- All
- Appeals - Criminal
- **Civil** ← where lis pendens, foreclosures, mechanic's lien suits, contractor disputes, condo actions all live
- Family
- Felony
- Parking and Permitting
- **Probate** ← death-driven property transfers
- Traffic and Misdemeanor

**Limits:**

- reCAPTCHA-gated (no automation without solving captcha)
- 200 results max per query
- Last name minimum 3 chars · First name minimum 2 chars
- Date range optional but recommended

**No API.** This is HTML scraping territory only, and the captcha + the per-query result cap effectively force you to query narrowly (specific party names, specific dates) rather than mass-pull. **Use case: ad-hoc lookup for a specific party + date** — not for daily-mass-ingest.

### 2.3 Circuit Civil division

URL: `https://www.browardclerk.org/Divisions/CircuitCivil`

Processes non-criminal cases >$50,000. Case-type taxonomy visible on the page:

- Professional Malpractice
- Bond Estreature
- Fraud
- Products Liability
- Auto Negligence
- Negligence Action
- **Condominium Action** (HOA / condo disputes)
- **Contract Indebtedness** (contractor/supplier disputes)
- **Real Property Mortgage Foreclosure**
- **Real Property Commercial Foreclosure**
- **Eminent Domain** (govt taking property — major story material)

For our pipeline: Real Property Mortgage Foreclosure, Real Property Commercial Foreclosure, Condominium Action, Contract Indebtedness, Eminent Domain are the high-signal types. Each is searchable via Case Search Public, but volume is high and the captcha gates automation.

### 2.4 RealAuction Foreclosure Sales — `broward.realforeclose.com`

This is where **the actual data is publicly visible without login** — even though bidding requires registration.

**Auction Calendar URL pattern:**

```
https://www.broward.realforeclose.com/index.cfm?zaction=USER&zmethod=CALENDAR
```

Calendar shows monthly grid, each weekday cell:

```
Foreclosure
<active> / <scheduled> FC
10:00 AM ET
```

E.g. May 12, 2026 = `20 / 25 FC` = 20 active, 25 scheduled. **Iterate by `&AUCTIONDATE=MM/DD/YYYY`** to navigate to any day.

**Auction Day URL pattern:**

```
https://www.broward.realforeclose.com/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AUCTIONDATE=05/12/2026
```

Returns a paginated list of auction items. Live-captured fields per item:

| Field | Live example |
|---|---|
| Auction Type | `FORECLOSURE` (or `TAXDEED`) |
| **Case #** | `CACE-20-003482` (clickable, links to Clerk case detail) |
| **Final Judgment Amount** | `$411,241.84` |
| **Parcel ID** | `514120030040` (clickable, **12-char alphanumeric — exact BCPA folio format**) |
| **Property Address** | `1821 SW 98 TER, MIRAMAR, 33025` |
| **Plaintiff Max Bid** | `$411,241.84` |
| **Auction Starts** | `05/12/2026 10:00 AM ET` |

**Volume**: visible May 2026 calendar shows ~100–150 foreclosure sales scheduled per month in Broward. Specific busy days observed: May 12 (25 scheduled), May 13 (12), May 14 (14), May 19 (17), May 21 (24).

**RealAuction multi-county note**: RealAuction operates dozens of FL counties on the same platform — Miami-Dade, Palm Beach, Hillsborough, Pinellas, Orange, etc. Same URL pattern with the county sub-domain swapped (`miamidade.realforeclose.com`, `palmbeach.realforeclose.com`). **An eventual multi-county Florida Signal can iterate across them with the same scraper.**

### 2.5 Joining Clerk + Foreclosure back to Florida Signal

**Direct join keys** (field → table.column):

| Foreclosure field | Pipeline target | Reliability |
|---|---|:--:|
| `Parcel ID` (12-char) | `bcpa_property_card.folio` / `permits.parcel_id` | ✅ exact |
| `Property Address` | `permits.address` (after normalization) | ✅ medium |
| `Case #` | New `enrichment_clerk_case.case_number` table | ✅ exact within Clerk namespace |
| `Final Judgment Amount` | New numeric field on enrichment | n/a |
| `Plaintiff` (party name) | Sunbiz / `owner_resolution` | ⚠️ fuzzy |

**Cross-reference chain:** The same `Case #` (e.g. `CACE-20-003482`) that appears on the foreclosure auction also appears in the **Broward Recording feed's `Case Number` field** on Final Judgment / Lis Pendens / Certified Final Judgment instruments. That means:

```
Recording NOC / LIE / FJ / LP  ──[Case Number]──► Clerk Case Detail ──[Parcel ID]──► BCPA folio ──► Permits
```

A property's full distress timeline becomes computable from the Case # alone.

---

## 3. Utility Connection / Water-Sewer Service Applications

### 3.1 The two-system reality

Broward has **two separate utility-permit universes**:

**A. Fort Lauderdale Utility Service Application** — for properties inside FTL city limits. Application form is at `fortlauderdale.gov` → Development Services → Engineering Permits. The actual application records flow into FTL's existing Accela system (LauderBuild) — same instance we already pull permit data from. Engineering / right-of-way / sewer / water permits show up as separate permit types alongside the building permits we already track. **Permit prefixes to watch in our DB:** `ROW-SEW-`, `ROW-WTR-`, `ROW-`, `ENG-`, `PLB-` (for inside-building plumbing).

**B. Broward County Water & Wastewater Services (WWS)** — for properties in unincorporated Broward + cities that contract with the County for water/sewer (Pembroke Park, certain LSAs). Application is at `broward.org/WaterServices`. Backend: ArcGIS REST FeatureServer (see § 3.3).

### 3.2 FTL Engineering / Utility — already in our Accela pipeline

Live audit of `db/permits.sqlite` confirms we already have engineering / utility permit prefixes flowing through — e.g. `ROW-SEW-25050015.D001` at 912 SE 13 ST (right-of-way sewer permit, sub-permit). We just don't currently distinguish them in scoring/dashboards.

**Low-effort win:** add `permit_category = 'utility_connection'` to records where `permit_number LIKE 'ROW-SEW-%'` OR `LIKE 'ROW-WTR-%'` OR `LIKE 'ENG-%'`. They're already ingested; we just need to surface them. **The user's hypothesis from the screenshot — that utility apps are an early on-the-ground site-work indicator — is verifiable with our existing data + a few SQL queries.**

### 3.3 Broward County Water & Wastewater — ArcGIS REST API confirmed

Captured live by inspecting the network traffic at `experience.arcgis.com/experience/9482b6dfab74466d9f09232f6cf0e4b4/` (the public Broward County Water and Sewer Services locator).

**Backend API base:** `https://services.arcgis.com/JMAJrTsHNLrSsWf5/arcgis/rest/services/`

This is Broward County's **ArcGIS Online tenant**, public, anonymous. The tenant exposes **674 published services**. Of those, the utility-relevant services include:

| Service | What it likely contains |
|---|---|
| `WaterandSewer` | Combined water + sewer service-area + connections |
| `WaterSewerDrainage_WFL1` | Water + Sewer + Drainage combined |
| `PumpStations` | All county pump stations |
| `QAlert_WaterServiceAreas` | Service-area polygons (which utility serves which area) |
| `BCPA_Parcels` | Parcel polygons with FOLIO + USE_CODE + FULL_SITE_ADDRESS + CITY_NAME |
| `DrainageBasins` | Stormwater drainage basin polygons |
| `DrainageDistricts` | Drainage district boundaries |
| `WaterControlDistStructures` | Drainage / control structures |
| `100_Year_Flood_Elevation__Current_vs_2060_WFL1` | **Flood elevation 2026 vs 2060 projection — MAJOR climate/risk signal** |
| `2022_HUD_Low_Mod_Income_Feature_Layer` | HUD income tract data (for redevelopment analysis) |
| `Community___Wastewater_Treatment_*` | Septic-vs-sewer status per neighborhood |

Plus another ~660 services covering everything from manatees to hurricane-response imagery. Most of these are **gold for editorial intelligence**.

**Same query pattern as FDEP ERP:**

```bash
curl 'https://services.arcgis.com/JMAJrTsHNLrSsWf5/arcgis/rest/services/<ServiceName>/FeatureServer/<layer>/query?where=...&outFields=*&f=json'
```

Capabilities verified for `BCPA_Parcels`: `Query`, `MaxRecordCount: 2000`. Schema:

| Field | Type |
|---|---|
| `OBJECTID_1`, `OBJECTID` | Identity |
| `FOLIO` | 🔥 12-char alphanumeric — direct join to BCPA |
| `USE_CODE` | Property use code |
| `FULL_SITE_ADDRESS` | Address |
| `CITY_NAME` | City |
| `Shape__Area`, `Shape__Length` | Geometry meta |

So we can query "all parcels in city X with USE_CODE Y" via this endpoint and get back parcel polygons + addresses.

### 3.4 The "early utility application" signal — what to capture

The user's table flagged Utility Connection as the **earliest on-the-ground site-work indicator** — before vertical construction starts. To realize this signal:

1. From our existing FTL Accela data, **flag every `ROW-SEW-` / `ROW-WTR-` / `ENG-` / `ROW-` permit** as a utility-application event.
2. For BMSD / county-water-service properties, query the Broward AGOL tenant's `WaterandSewer` and `QAlert_WaterServiceAreas` services to identify which parcels are in BCWWS service areas.
3. Cross-reference: when an ENG/ROW-SEW permit is filed at a parcel, watch for a corresponding BLD permit within ~60 days. Permit-pair = construction is actually starting; permit-without-pair = stalled.

### 3.5 Limitation — actual application records require Accela join

Per the user's table: "Actual submitted applications are usually visible only via associated building permit record in BCS/Accela." Confirmed. The Broward.org/WaterServices public page exposes **service-area maps** and **utility-provider lookup** but NOT a real-time list of "who applied for new water service today." That data lives in Accela for FTL parcels and in the county's internal customer-service system for BMSD parcels — neither of which has a public daily feed.

**Best signal route:** ingest engineering/utility permits from our existing Accela pull (already in `db/permits.sqlite`, just not categorized).

---

## 4. 🔥 Updated Unified Cross-Source Intelligence Layer

The previous audit (FDEP ERP) introduced this section. Now extended with these three sources. The picture is now seven external/own data sources, joinable on a small set of canonical keys.

### 4.1 The full source inventory (after this audit)

| # | Source | Audit doc | Daily-feed? | Fresh-filing detection | API |
|---:|---|---|:--:|:--:|:--:|
| 1 | **FTL Accela / LauderBuild permits** | already live | ✅ daily | ✅ on `applied_date` | partial |
| 2 | **BCPA property data** | already live | weekly | n/a | partial |
| 3 | **Sunbiz corporate filings** | already live | weekly | ✅ on Document Date | screen-scrape |
| 4 | **Broward Recording (liens, NOCs, mortgages, deeds, releases)** | `BROWARD_LIENS_AUDIT_2026-05-10.md` | ✅ daily SFTP | ✅ on Recording Date | ✅ SFTP free |
| 5 | **Broward BCS (CCs, CUs, Code Enf, Unsafe Structure)** | `BROWARD_BCS_AUDIT_2026-05-10.md` | nightly scrape | ✅ on Established Date | ❌ scrape-only |
| 6 | **FDEP ERP (state environmental permits)** | `FDEP_ERP_AUDIT_2026-05-10.md` | ✅ daily | ✅ on `RECEIVED_DATE` / `AGENCY_ACTION_DATE` | ✅ ArcGIS REST |
| 7 | **FAA OE/AAA (tall structures, cranes)** | THIS DOC § 1 | ✅ daily | ✅ on `dateEntered` / weekly CSVs | ✅ official REST + WADL |
| 8 | **Broward Clerk court cases** | THIS DOC § 2.2-2.3 | ad-hoc | reCAPTCHA-blocked | ❌ scrape-only, narrow |
| 9 | **Broward Foreclosure Auction (RealAuction)** | THIS DOC § 2.4 | ✅ daily | ✅ on `AUCTIONDATE` URL | ⚠️ URL-iterable, no API |
| 10 | **Broward Water & Wastewater (ArcGIS GIS)** | THIS DOC § 3.3 | weekly | ✅ via Edit Date | ✅ ArcGIS REST |
| 11 | **FTL Engineering / utility permits** (subset of #1) | THIS DOC § 3.2 | already in DB | ✅ already | partial |

### 4.2 Refreshed canonical join keys

| Axis | Sources contributing | Notes |
|---|---|---|
| **Parcel** (12-char alphanumeric folio) | BCPA · Permits.parcel_id · Records lgl-ver.parcel_id · BCS Folio · FDEP ERP (geo→folio) · **RealAuction Parcel ID** · Broward AGOL `BCPA_Parcels.FOLIO` · FAA (geo→folio) | The strongest universal key. Now confirmed in 8 of the 11 sources. |
| **Address** | All sources (with normalization required) | Universal but messy |
| **Owner** | `owner_resolution` table + Permits + BCPA + Records nme-ver D + BCS Parcel Owner + FDEP ERP APPLICANT_NAME + **FAA `sponsor`** + **RealAuction property owner** | The contractor/owner graph |
| **Contractor / firm** | Permits + Records nme-ver R + BCS Contracting Firm + (FL DBPR pending audit) | |
| **Court Case #** | Records `Case Number` field (col 19) on FJ/CFJ/LP + **Clerk Case Search results + RealAuction Case #** | Now has its own column to track |
| **FAA ASN** | FAA — primary key | |
| **FDEP Permit ID / App ID** | FDEP — primary key | |
| **Document URL** | Records images, FDEP DOCUMENTS, BCS POSSE Object ID | Permalink to source PDF |

### 4.3 New composite signals enabled by the four-audit picture

Adding to the 16 signals from the FDEP audit, these three new sources add at minimum:

| New signal | Sources required | Why valuable |
|---|---|---|
| **Crane on site** | FAA `structureType=CRANE` + Permits | Live confirmation that vertical construction is happening — the moment a crane goes up |
| **Tall building filed before city sees it** | FAA `aglStructureHeight > 200` + (no matching Permits yet) | Earliest possible lead — federal filing weeks/months before local building permit |
| **Foreclosure auction at active-permit address** | RealAuction + Permits (active status) | Owner is losing the property despite construction in progress — high editorial value |
| **Foreclosure plaintiff = bank, on a permitted property** | RealAuction Plaintiff Max Bid + Permits | Standard mortgage foreclosure with construction cross-context |
| **Lis Pendens followed by foreclosure auction within N months** | Records LP + RealAuction | Closes the loop on a foreclosure timeline that started 6-12 months earlier |
| **Court contract-indebtedness case + recent permit + same contractor** | Clerk Civil + Permits + (Sunbiz) | Contractor-vs-owner payment dispute — direct lead |
| **Eminent domain case + active permit cluster nearby** | Clerk Civil + Permits | Govt taking property → infrastructure project context |
| **Utility ROW permit issued before any building permit** | Permits (ROW-SEW/WTR/ENG) + Permits (BLD-) | Site work has started; vertical construction coming |
| **Parcel inside 100yr flood zone 2060 projection + new permit** | Broward AGOL `100_Year_Flood_Elevation__Current_vs_2060_WFL1` + Permits | Climate-risk context for new construction stories |
| **Septic parcel + new permit** | Broward AGOL `Community___Wastewater_Treatment_*` + Permits | Septic-to-sewer conversion stories |
| **HUD low-mod-income tract + redevelopment permit** | Broward AGOL `2022_HUD_Low_Mod_Income_Feature_Layer` + Permits | Equity / displacement coverage |
| **Pump station upstream of new construction** | Broward AGOL `PumpStations` + Permits geometry | Capacity / infrastructure-strain reporting |

### 4.4 The expanded daily Broward Brief

Refreshed template incorporating the four-audit picture:

```
═══════════════════════════════════════════════════════════════════
  FLORIDA SIGNAL · DAILY BROWARD BRIEF · MM/DD/YYYY
═══════════════════════════════════════════════════════════════════

WHAT'S NEW (24h):
  PERMITS (FTL Accela):  +X new applied · +Y issued · +Z expired
  RECORDS (Broward):     +A liens · +B NOCs · +C Lis Pendens · +D RST
  BCS:                   +E new code-enforcement · +F Unsafe Structure
  FDEP ERP (state):      +G new ERPs · +H issued
  FAA OE/AAA (federal):  +I new tall-structure filings · +J cranes
  CONTRACTORS (BCS):     +K new licenses · +L voided

LEADING INDICATORS (NEW PERMITS COMING):
  ─ FAA tall-structure file  → no matching permit yet  (N rows)
  ─ FDEP ERP filed           → no matching permit yet  (N rows)
  ─ NOC filed                → no matching permit yet  (N rows)
  ─ ROW-SEW / ROW-WTR filed  → no BLD permit yet at parcel (N rows)
  ─ Lis Pendens filed        → potential foreclosure pipeline (N rows)

DISTRESS SIGNALS (PRIORITY):
  ─ Foreclosure auction next 30d at parcel with active permits (top 5)
  ─ Lien stack ≥3 + active construction (top 5)
  ─ Open Unsafe Structure case + new permit  (top 5)
  ─ Court contract case + recent permit + same contractor (top 5)
  ─ Multi-source distress stack ≥4 sources  (top 10)

WATERFRONT / VERTICAL:
  ─ Cranes on site today (FAA + Permits)  (top 10)
  ─ ERP→permit pairs converging  (top 10)
  ─ Tall-structure filings (>200ft) last 7 days  (top 10)

COMMERCIAL:
  ─ Today's new CUs  (BMSD)
  ─ CU "Change of Use or Occupant" events  (turnover)

CLIMATE / EQUITY CONTEXT:
  ─ New permits inside 2060 flood-projection zone
  ─ New permits in HUD low-mod tracts
  ─ Septic-area parcels with new permits

FOR THE EDITORIAL DESK:
  ─ <human-curated leads from above>

═══════════════════════════════════════════════════════════════════
```

### 4.5 Updated implementation roadmap

| Phase | Deliverable | Doc reference |
|---:|---|---|
| **P0** | Andy approves multi-source intelligence vision (this report = propose) | THIS DOC + the prior 3 audits |
| **P1** | Broward Recording SFTP daily feed | `BROWARD_LIENS_AUDIT_2026-05-10.md` § 8.3 |
| **P1** | BCS HTML-scrape daily feed (CC license + Unsafe Structure first) | `BROWARD_BCS_AUDIT_2026-05-10.md` § 8.3 |
| **P1** | FDEP ERP REST API daily feed | `FDEP_ERP_AUDIT_2026-05-10.md` § 6 |
| **P1** | **FAA OE/AAA REST API daily feed** | THIS DOC § 1.2c |
| **P1** | **RealAuction foreclosure-calendar daily scrape** | THIS DOC § 2.4 |
| **P1** | **Categorize FTL utility/engineering permits** in our existing pipeline (no new ingest required — just permit_category tagging) | THIS DOC § 3.2 |
| **P1** | Each source lands as `enrichment_*` source-locked tables | All audits |
| **P2** | Address-normalization service (8-source canonical) | All audits |
| **P2** | Owner-resolution extension to contractor + business-owner + FAA sponsor + Plaintiff names | All audits |
| **P2** | Cross-source `enrichment_property_event_timeline` builder | All audits |
| **P2** | Daily intelligence-brief generator (markdown + dashboard widget) | All audits |
| **P3** | **SFWMD ERP audit** — close the SFWMD water-permit gap | FDEP audit § 8.3 |
| **P3** | **FL DBPR contractor-license audit** | BCS audit § 8.3 |
| **P3** | **Broward AGOL tenant deeper audit** — flood, HUD income, drainage, septic, pump-station overlays | THIS DOC § 3.3 |
| **P3** | **Multi-county RealAuction expansion** (Miami-Dade, Palm Beach, Hillsborough — same vendor) | THIS DOC § 2.4 |
| **P3** | **Broward Clerk Case Search captcha workflow** — for ad-hoc lookups via human-in-the-loop | THIS DOC § 2.2 |
| **P3** | When/if scoring un-paused: combined cross-source distress score | All audits |

---

## 5. Recommendations

### 5.1 Best way to start ingesting these three sources daily

**FAA OE/AAA** — easiest of the three. Just a daily REST poll:

```python
# Pseudocode
import urllib.request
H = {'Accept': 'application/xml'}
url = f"https://oeaaa.faa.gov/oeaaa/services/asnList/OE/{year}?state=FL"
# Get all FL ASNs, diff against last-pulled, fetch full case for new ones
```

Polling every 24h captures new filings within a day. Backfill once with the 4,623 FL/2026 ASNs already returned.

**RealAuction Foreclosure Auction** — daily scrape for the next 60 days of auction dates:

```python
# Pseudocode
for d in next_60_days_of_auction_calendar():
    url = f"https://www.broward.realforeclose.com/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AUCTIONDATE={d:%m/%d/%Y}"
    parse_html_for_items(url)
    # Each item: case#, parcel_id, address, judgment$, max_bid
```

Polite rate (≤1 req/3 sec). Foreclosure dates can be added/cancelled, so re-scrape recent dates daily, distant ones weekly.

**Broward AGOL Water/Sewer** — weekly REST query is fine; service-area data doesn't change often. Just like FDEP ERP. Plus selective adjacent layers (flood projection, HUD tracts, septic) on demand for editorial work.

**Broward Clerk Case Search** — keep manual; human-in-the-loop for ad-hoc lookups.

**FTL Engineering/Utility permits** — already in our DB; just add `permit_category = 'utility_connection'` tagging.

### 5.2 Red flags

- **FAA: lat/lon accuracy varies.** Field `latLongAccuracy` ranges from `1S` (1 second precision = ~30m) to `4D` (4 minutes = ~7km). For close-to-parcel join, only trust accuracy ≤ `2S`. Lower accuracy still useful for "general area" filtering.
- **FAA: ASNs cover the whole ASO region** (FL + GA + AL + MS + KY + TN + NC + SC + PR + VI). The `state=FL` filter narrows it; even so, ASN counts can be misleading. Use lat/lon bbox for true Broward filtering.
- **Foreclosure auction items can be cancelled / postponed up to the morning of the sale.** Status = `Active` on the day of sale ≠ guaranteed it ran. Re-fetch the same date the day after to confirm completion.
- **Clerk Case Search reCAPTCHA**: not bypassable. Don't waste effort.
- **Broward AGOL services aren't all consistently updated.** Some `2022_*` named services are stale by definition. Check the `editingInfo.lastEditDate` field on each layer before inferring freshness.
- **The 100-year flood projection layer** is for editorial / context use, not regulatory. It's not the FEMA flood map (which is a separate FEMA service).

### 5.3 Prioritized next steps

| Priority | Action | Effort | Gating |
|---:|---|---|---|
| **P0** | Andy approves moving forward with FAA + RealAuction + AGOL ingest as Phase-1 additions to the broader cross-source rollout | discussion | — |
| **P0** | Andy approves the unified intelligence roadmap (§ 4.5) | discussion | — |
| **P1** | New canonical doc `docs/THREE_SOURCE_IMPLEMENTATION_PLAN_2026-05-10.md` mirroring the prior plan formats | 30 min | Plan approved |
| **P1** | Build `scripts/pull_faa_oeaaa.py` (REST + bulk-CSV fallback) + `0_FAA_OEAAA_NIGHTLY.command` wrapper | ~3 hrs | Plan approved |
| **P1** | Build `scripts/pull_realauction_broward.py` (URL-iterable foreclosure scrape) + `0_REALAUCTION_NIGHTLY.command` wrapper | ~4 hrs | Plan approved |
| **P1** | Build `scripts/pull_broward_agol.py` (selective service queries: WaterandSewer, QAlert_WaterServiceAreas, 100yr flood, HUD income) + `0_BROWARD_AGOL_WEEKLY.command` wrapper | ~3 hrs | Plan approved |
| **P1** | DDL for `enrichment_faa_oeaaa`, `enrichment_realauction_foreclosure`, `enrichment_broward_agol_*` tables | ~30 min + ChatGPT QA | Plan approved |
| **P1** | Categorize utility/engineering permits in existing `permits` table (one-liner UPDATE with `permit_category = 'utility_connection'` for `ROW-SEW%/ROW-WTR%/ENG%`) | 30 min + QA | Plan approved |
| **P1** | New launchd agents per source (FAA daily, RealAuction daily, AGOL weekly) | 1 hr | Wrappers landed |
| **P2** | Address-normalization service unified across all 8 sources | 1 day | P1 ingests stable |
| **P2** | Cross-source `match_*` resolvers (foreclosure↔parcel↔permits, FAA↔parcel, etc.) | 2 days | Address normalizer |
| **P2** | Mirror new tables into Supabase (`MIRROR_TABLES` 22 → ~30) | 2 hr | Tables stable |
| **P2** | Daily Florida Signal Brief generator (markdown + dashboard widget) | 2 days | All P1 ingests stable |
| **P3** | SFWMD audit | (separate audit) | — |
| **P3** | Multi-county RealAuction (Miami-Dade, Palm Beach, etc.) | 1 day per county | Broward stable |
| **P3** | When/if scoring un-paused: cross-source distress score model | unknown | Andy un-pauses scoring |

### 5.4 What this audit explicitly did NOT do

- Did not log into the FAA portal to set up email alerts (out of scope; manual operator step)
- Did not solve any reCAPTCHA on Broward Clerk Case Search
- Did not register / log into RealAuction (out of scope; not needed for the data)
- Did not enumerate all 674 Broward AGOL services in detail (only filtered for water/sewer/utility/flood-relevant)
- Did not pull the FAA bulk weekly CSVs (the REST API is more efficient for incremental ingest)
- Did not verify accuracy of any single FAA/Foreclosure record by checking its real-world status (it's a research audit, not an investigation)
- Did not write any data into Florida Signal tables, did not start any launchd agents, did not run any wet writes

---

## Appendix A — Quick test commands

```bash
# 1. FAA OE/AAA — pull all FL 2026 ASNs (XML)
curl -s -A 'Mozilla/5.0' -H 'Accept: application/xml' \
  'https://oeaaa.faa.gov/oeaaa/services/asnList/OE/2026?state=FL' \
  | head -c 2000

# 2. FAA OE/AAA — fetch one full case
curl -s -A 'Mozilla/5.0' -H 'Accept: application/xml' \
  'https://oeaaa.faa.gov/oeaaa/services/case/OE/2026-ASO-100-OE'

# 3. FAA OE/AAA — date range filter
curl -s -A 'Mozilla/5.0' -H 'Accept: application/xml' \
  --data-urlencode "start=04/01/2026" --data-urlencode "end=05/10/2026" \
  -G 'https://oeaaa.faa.gov/oeaaa/services/asnList/date/OE'

# 4. RealAuction foreclosure calendar for any date
open 'https://www.broward.realforeclose.com/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AUCTIONDATE=05/12/2026'

# 5. Broward AGOL service catalog
curl -s 'https://services.arcgis.com/JMAJrTsHNLrSsWf5/arcgis/rest/services?f=json' \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('\n'.join(s['name'] for s in d['services']))" \
  | grep -iE 'Water|Sewer|Drainage|Septic|Pump|Flood|HUD|Utility'

# 6. Broward AGOL Water+Sewer feature service
curl -s 'https://services.arcgis.com/JMAJrTsHNLrSsWf5/arcgis/rest/services/WaterandSewer/FeatureServer?f=json' | python3 -m json.tool | head -60

# 7. Categorize utility permits in our DB (read-only count)
python3 -c "
import sqlite3
con = sqlite3.connect('file:db/permits.sqlite?mode=ro', uri=True)
con.execute('PRAGMA query_only=ON')
for row in con.execute(\"SELECT substr(permit_number,1,8), COUNT(*) FROM permits WHERE permit_number LIKE 'ROW-%' OR permit_number LIKE 'ENG-%' GROUP BY substr(permit_number,1,8) ORDER BY 2 DESC LIMIT 10\"):
    print(row)
"
```

## Appendix B — Quick reference card

```
═══════════════════════════════════════════════════════════════
  THREE-SOURCE QUICK REFERENCE
═══════════════════════════════════════════════════════════════

FAA OE/AAA
  Portal:           https://oeaaa.faa.gov/oeaaa/oe3a/main/#/home
  REST base:        https://oeaaa.faa.gov/oeaaa/services/
  WADL spec:        https://oeaaa.faa.gov/oeaaa/external/content/Public%20WADL.xml
  User Guide:       https://oeaaa.faa.gov/oeaaa/downloads/usermanuals/moe/External%20Web%20Services%20Guide_V_2025-DEC.pdf
  Bulk CSVs:        Portal → Download → Download Case Info  (weekly Saturday eve)
  Auth:             None
  Region for FL:    ASO (Atlanta Southern Office)
  Volume:           4,623 ASNs in FL/2026 alone
  Key fields:       asn, dateEntered, sponsor, structureType, aglStructureHeight, latitude, longitude, statusCode

BROWARD CLERK CASE SEARCH
  Portal:           https://www.browardclerk.org/Web2
  Auth:             reCAPTCHA on every search
  Limit:            200 results per query
  Court types:      All, Civil, Family, Felony, Probate, Traffic, Appeals-Criminal, Parking
  Use case:         Ad-hoc human lookups; not for daily mass-ingest

BROWARD FORECLOSURE AUCTION (RealAuction)
  Calendar:         https://www.broward.realforeclose.com/index.cfm?zaction=USER&zmethod=CALENDAR
  Day-detail:       https://www.broward.realforeclose.com/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AUCTIONDATE=MM/DD/YYYY
  Auth:             Login required only for bidding; data viewable without login
  Volume:           ~100-150 foreclosure sales / month in Broward
  Per item fields:  Auction Type, Case #, Final Judgment Amt, Parcel ID (12-char folio), Property Address, Plaintiff Max Bid, Auction Date/Time
  Multi-county:     RealAuction operates dozens of FL counties — same URL pattern with county subdomain

BROWARD WATER & WASTEWATER (ArcGIS)
  Public map:       https://experience.arcgis.com/experience/9482b6dfab74466d9f09232f6cf0e4b4/
  AGOL tenant:      https://services.arcgis.com/JMAJrTsHNLrSsWf5/arcgis/rest/services
  Total services:   674 published (Broward county)
  Key services:     WaterandSewer, WaterSewerDrainage_WFL1, PumpStations, QAlert_WaterServiceAreas, BCPA_Parcels,
                    100_Year_Flood_Elevation__Current_vs_2060_WFL1, 2022_HUD_Low_Mod_Income, Community Wastewater Treatment
  Auth:             None; standard ArcGIS REST query pattern

FTL ENGINEERING / UTILITY PERMITS
  Source:           Existing LauderBuild Accela ingest
  Permit prefixes:  ROW-SEW-, ROW-WTR-, ROW-, ENG-, PLB-
  Already in DB:    Yes — just need permit_category tagging
  Signal:           Earliest on-the-ground site-work indicator
═══════════════════════════════════════════════════════════════
```

---

*End of consolidated three-source audit. Combined with the previous three audits in this chat (Broward Recording / liens, Broward BCS / contractors-CUs-enforcement, FDEP ERP / environmental), Florida Signal now has a clear path to a four-week implementation rollout that can build a multi-source property/owner/contractor intelligence layer that no commercial provider currently sells for Broward. Recommended next session prompt: "approved — produce the implementation plan doc per § 5.3 P1 covering FAA + RealAuction + AGOL + utility-permit categorization, bundled or separate as you recommend."*
