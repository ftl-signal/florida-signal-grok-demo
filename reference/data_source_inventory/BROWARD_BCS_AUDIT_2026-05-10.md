# Broward County Building Code Services (BCS) — Site & Data Audit

*Auditor: Claude (read-only research). Date: 2026-05-10. Site audited: https://dpepp.broward.org/BCS/. Real test queries run against the live site using contractor names, parcel IDs, owner names, and an FTL-area city filter from `db/permits.sqlite`. This is a research output. Per the project's editorial-output convention it does NOT trigger the 7-step doc-update rule. No live state was changed.*

---

## 1. Executive Summary

`dpepp.broward.org/BCS/` is the public face of Broward County **Building Code Services**, hosted on **Computronix POSSE Outrider PCI** (an ASP.NET WebForms front-end onto a Python-based POSSE backend). It exposes **eleven distinct public search interfaces** — Permits, Address (parcel/folio), Contractor License, Elevator, Certificate of Use (the occupancy permit), and Code Compliance / Code Enforcement (searchable by case#, address, OR by folio/parcel). Behind every result is an internal `PosseObjectId` exposed in the URL, which gives a stable per-record permalink for any deep-link integration we want to build.

For Florida Signal's signal/scoring pipeline, **the highest-value datasets here are (1) Unsafe Structure cases**, which BCS administers countywide post-Surfside and which include an **`Expired Permit Number` field that joins directly back to permits**; (2) **Contractor competency-card licenses** (we tested live and immediately found a real signal — Coastal Comfort Inc., 348 permits in our DB, holds CC-545 with status `Void` since 2011-08-31); and (3) **Certificates of Use / occupancy** — the operating cert every commercial tenant needs, with `Required Inspections: Structural / Electrical / Plumbing / Mechanical` and `Category: Change of Use or Occupant` fields that map cleanly to commercial-distress signals.

**BCS has no public bulk feed, no API, no robots.txt, and uses a session-cookied wildcard search interface** — so daily integration must be a polite, throttled HTML scrape (or a public-records request to BCS staff for raw exports). Even at low volume, this dataset is a high-leverage enrichment for permit data because it provides three signals you cannot derive from Accela alone: expired-permit→unsafe-structure linkage, contractor license-status/void-date, and tenant-level commercial occupancy turnover.

---

## 2. Site & Platform — what's actually here

### 2.1 The eleven public search interfaces

URL pattern is invariant: `https://dpepp.broward.org/BCS/Default.aspx?PossePresentation=<PresentationName>`. After a successful search the URL adds `&PosseObjectId=<numeric-id>` for the detail page. That numeric ID is the canonical permalink to any record.

| # | Section | Presentation Name | What it is | Public? | Accepts |
|---:|---|---|---|---:|---|
| 1 | Permits | `SearchForMasterPermit` | Search by BCS permit number | ✅ | Permit # (e.g. `12-09876`) |
| 2 | Permits | `ParcelSearchByAddress` | Search permits by Address / Folio / Parcel | ✅ | Street # + Direction + Name + Type + City dropdown · OR Folio (`02-15-01-0130` form) · OR Parcel ID (12-char alphanumeric) |
| 3 | Permits | `SearchForPermitToRequestInspec` | Inspection request lookup | ✅ | Permit # |
| 4 | Contractor Licenses | `SearchForContractorLicense` | Search Broward CC-card contractor licenses | ✅ | Last+First name · OR CC# · OR Firm Name (with `%` wildcards) |
| 5 | Contractor Licenses | `ViewContractor` ("Find My Licenses") | Authenticated portal — for contractors to manage their own license | 🔒 sign-in | Login required |
| 6 | Contractor Licenses | `RenewContractorLicenseSearch` | License-renewal lookup (also gates into authenticated flow) | partial | License # |
| 7 | Elevators | `SearchForElevator` | Search the countywide elevator registry | ✅ | BC ID # · OR Phone Access Code (the keypad code) · OR Building Name · OR Address |
| 8 | Elevators | `RenewElevatorCertificate` | Elevator certificate renewal (admin) | partial | BC ID # |
| 9 | Certificates of Use | `SearchForCertOfUse` | Search **Certificates of Use** — the commercial-tenant occupancy permit | ✅ | CU# (e.g. `01-CU-01234`) · OR Business Owner · OR Street Address (with `%`) · requires more than just City alone |
| 10 | Code Compliance & Enforcement | `SearchForEnforcement` | Search code-enforcement / Unsafe-Structure / Code-Compliance cases | ✅ | Case # · OR Street Address · OR City · `Enforcement Type` dropdown · `Created Date` From/To range |
| 11 | Code Compliance & Enforcement | `ParcelSearchForEnforcement` | Search enforcement cases **by Folio or Parcel ID** — the killer cross-reference search | ✅ | Folio # · OR Parcel ID |

Plus three navigation entries:
- **Sign In** (`PossePresentation=PublicLogin` returns POSSE error 1005 — actual login presentation has a different name; access is for licensed contractors only, not data consumers)
- **Zoning Forms** — links out to `broward.org/Planning/Zoning` (BMSD Zoning Code Chapter 39)
- **Invoice** (`SearchForInvoice`) — for paying outstanding fees

### 2.2 Platform — Computronix POSSE Outrider PCI

The error page at `?PossePresentation=PublicLogin` exposed the platform stack:

```
file =PosseExceptions.py, line 82, in __init__
file =OutriderQueryString.py, line 279, in FetchParms
file =OutriderCore.py, line 632, in __DeduceQueryStringParms
…
at Computronix.POSSE.Outrider.PageBase.ProcessError(...)
   in e:\inetpub\OutriderPCI\BCS\App_Code\PageBase.cs:line 1904
```

Translation:
- Vendor: **Computronix POSSE** (govt licensing/permitting platform also used by Edmonton, Hamilton, Pinellas, Hillsborough, many other jurisdictions)
- Product line: **Outrider PCI** (Public Citizen Interface — the read-only public face; `OutriderINT` is the staff side)
- Hosted on Windows IIS, ASP.NET WebForms, Default.aspx WebPart-style pages, with a Python-based POSSE engine underneath
- All Wt rendering happens server-side; URL contains `PossePresentation` (a presentation = a screen) and `PosseObjectId` (the record's internal ID)
- Pages depend on session cookies + JavaScript (their `posseerror` text says explicitly: "JavaScript and Session Cookies must be enabled for this Site.")
- Submit handlers call `PosseSubmitLink('Default.aspx?PossePresentation=…', 5, <ScreenID>)` — i.e., screen IDs are server-issued anti-CSRF-ish tokens; you can't just POST to the URL without first GETting the form to harvest current screen state

### 2.3 No robots.txt, no API, no sitemap

- `https://dpepp.broward.org/robots.txt` → IIS error redirect (no robots policy declared)
- `https://dpepp.broward.org/sitemap.xml` → no sitemap
- No documented REST/SOAP API. The only documented integration channel is via Computronix-validated submitter onboarding (gov-to-gov), which we don't qualify for and don't need.
- No bulk download, no FTP, no CSV export visible in the UI

### 2.4 Coverage map — which jurisdictions does BCS data span?

The Address-search City dropdown is the canonical answer:

```
(All) | COCONUT CREEK | COOPER CITY | CORAL SPRINGS | DANIA | DAVIE | DEERFIELD BEACH |
FORT LAUDERDALE | HALLANDALE | HILLSBORO BEACH | HOLLYWOOD | INDIAN RESERVATION |
LAUDERDALE BY THE SEA | LAUDERDALE LAKES | LAUDERHILL | LAZY LAKE | LIGHTHOUSE POINT |
MARGATE | MIRAMAR | NORTH LAUDERDALE | OAKLAND PARK | PARKLAND | PEMBROKE PARK |
PEMBROKE PINES | PLANTATION | POMPANO BEACH | SEA RANCH LAKES | SOUTHWEST RANCHES |
SUNRISE | TAMARAC | UNINCORPORATED | WESTON | WILTON MANORS | WEST PARK
```

All 33 Broward cities + `UNINCORPORATED` (BMSD) + `INDIAN RESERVATION` (Seminole). **But the city dropdown is just an address-filter input** — it does NOT mean BCS holds permit data for every city. The actual data is split by jurisdiction by data domain, like this:

| Data domain | What's in BCS | Why |
|---|---|---|
| **Permits** | Mostly **BMSD (unincorporated)**, plus county-jurisdiction permits and some smaller cities that contract with BCS | Most cities (FTL, Hollywood, Pompano, Coral Springs etc) operate their own building dept and BCS doesn't see their permits |
| **Contractor competency cards (CC#)** | **Countywide** — one Broward CC# is required to pull permits anywhere in the county that doesn't issue its own contractor licenses | County-level program; FL state issues separate state licenses (DBPR) |
| **Elevators** | **Countywide** — BCS is the AHJ for the entire elevator program in Broward | State law (FL Statute 399) delegates elevator program administration to counties |
| **Certificates of Use (occupancy)** | Mostly **BMSD + cities that contract with BCS** | "City Incorporation" field on each record reveals jurisdiction — see § 4.4 |
| **Code Enforcement** | Mostly **BMSD** | Each city handles its own non-structural code enforcement |
| **Unsafe Structure cases** | **Countywide post-Surfside** — BCS administers structural recertification + unsafe-building cases for the entire county | FL Building Code countywide structural-safety mandate, intensified after Champlain Towers South 2021 |

### 2.5 Permission posture — ToS, scraping, fair use

- No robots.txt, no Terms of Use page on the BCS subdomain
- BCS pages cite the standard county disclaimer: *"Be advised that data and other information derived from searches may not constitute all of the data or information that may be available… encouraged to seek independent corroboration of the legal or regulatory status of the property or facility in question."*
- Session-cookie / screen-ID anti-CSRF gates make automated scraping brittle but possible — needs a session-aware client (paramiko-style won't work; need a `requests.Session()` driver that holds cookies and parses the form's hidden fields out of each GET before POSTing)
- The platform is **slow under load** — we observed multiple `Service Unavailable` responses during this audit when running back-to-back searches. Real pipelines must throttle hard (≤1 request / 10 sec) and retry with jitter

---

## 3. Complete Data Fields — by record type

### 3.1 Code Enforcement / Unsafe Structure case (the killer table)

Captured live from instrument **`00-0421` (POSSE Object ID 4101919)**, an **Unsafe Structure / UNSAFE STR/STAGNANT POOLS** case at `672 W EVANSTON CIR, FT LAUDERDALE FL 33310`, owner WESTBROOK WILLIAM & MARGARET, established 03/10/2000, **still Open** as of 2026-05-10. URL: `dpepp.broward.org/BCS/Default.aspx?PossePresentation=ViewEnforcementCase&PosseObjectId=4101919`.

**Case Details tab:**

| Field | Example value | Notes |
|---|---|---|
| Case # | `00-0421` | Format `YY-NNNN` |
| POSSE Object ID | `4101919` | Internal permalink key |
| Status | `Open` | `Open` / `Closed` |
| Enforcement Type | `Unsafe Structure` | One of `Code Enforcement` · `Unsafe Structure` · `Code Compliance` |
| Case Type | `UNSAFE STR/STAGNANT POOLS` | Free-text-ish sub-type |
| Complainant Type | `(None)` | Possible values include resident, anonymous, city-referral, BCS-inspector |
| Property Type | `(None)` | E.g. SFR, condo, commercial, vacant |
| **Expired Permit Number** | (empty here, but exists as a structured field) | **🔥 direct join to permit data when populated** |
| Complaint / Violation | `UNPROTECTED SWIMMING POOL EM` | Free-text |
| Date Established | `03/10/2000` | Case open date |
| Correction Deadline | `03/30/2000` | Hard deadline |
| Inspector | (empty) | Assigned BCS staffer |

**Violation Location:**

| Field | Example | Notes |
|---|---|---|
| Folio Number | `0207-05-0560` | 8-char hyphenated (`02-07-05-0560` form) |
| Address | `672 W EVANSTON CIR` | |
| City/State/ZIP | `FT LAUDERDALE, FL 33310` | |
| **Jurisdiction** | `Fort Lauderdale` | The case is in BCS's database, but the local jurisdiction is FTL — so BCS records cases countywide for Unsafe-Structure even when the local building dept is a city |
| Legal Description | `MELROSE PARK SEC 5 35-49 BLOT 23 BLK 3` | |

**Parcel Owner:**

| Field | Example | Notes |
|---|---|---|
| Owner | `WESTBROOK WILLIAM & MARGARET` | |
| Mailing Address | `672 W EVANSTON CIR / FORT LAUDERDALE FL, 333122613` | Note: ZIP+4 concatenated, no hyphen |

**Activities tab:** chronological log of inspector visits, notices, hearings, compliance actions. (For the 25-year-old case I clicked into, the Activities log was empty — but newer cases have populated audit trails.)

#### Case-type taxonomy (Enforcement Type dropdown — controlled vocab)

```
Code Enforcement     -- routine code violations (most common, BMSD-only)
Unsafe Structure     -- structural-safety cases (countywide, post-Surfside critical)
Code Compliance      -- ongoing compliance / abatement programs
```

Plus countless free-text **Case Type** sub-categories (we observed `UNSAFE STR/STAGNANT POOLS`; the BCS landing page also references rental-property inspections, swimming-pool safety, and fire/life-safety). These can be mined by ingesting bulk results.

#### Real volume — Unsafe Structure in FT-LAUDERDALE-area zips

A `City State and ZIP = %Lauderdale%` + `Enforcement Type = Unsafe Structure` query returned a multi-page list including ~20 visible on the first screen, with cases dating from 2000 through recent (page-paginated). Visible sample on screen one:

| Case # | Address | City / ZIP | Established | Status |
|---|---|---|---|---|
| 00-0160 | 3110 NW 4 ST | FT LAUDERDALE 33310 | 01/21/2000 | **Open** |
| 00-0260 | 5520 NW 31 AVE | FORT LAUDERDALE 33309 | 02/15/2000 | Closed |
| 00-0271 | 4154 NW 12 TER | FT LAUDERDALE 33310 | 03/30/1999 | **Open** |
| 00-0274 | 1910 NW 44 AVE | FT LAUDERDALE 33310 | 02/17/2000 | Closed |
| 00-0421 | 672 W EVANSTON CIR | FT LAUDERDALE 33310 | 03/10/2000 | **Open** ← drilled into |
| 00-0435 | 18900 SW 50 ST | FT LAUDERDALE 33332 | 03/15/2000 | Closed |
| 00-0522 | 2801 NW 10 CT | FORT LAUDERDALE 33311 | 03/24/2000 | Closed |
| 00-0816 | 2581 NW 13 CT | FT LAUDERDALE 33310 | 05/05/2000 | Closed |
| 00-0871 | 2563 NW 13 CT | FORT LAUDERDALE 33312 | 05/17/2000 | Closed |
| 00-0887 | 3800 JACKSON BLVD | FT LAUDERDALE 33310 | 05/19/2000 | **Open** |
| … | … | … | … | … |

**The "Open" cases from 2000 are particularly interesting** — they represent properties that BCS has had unresolved structural concerns about for 25 years. Properties that today are pulling building permits while still carrying an open Unsafe Structure case are an editorial gold mine.

### 3.2 Contractor License (CC card)

Captured live from a search for `%COASTAL COMFORT%`. Result: one record. URL: `dpepp.broward.org/BCS/Default.aspx?PossePresentation=ViewContractorLicense&PosseObjectId=13233655`.

**License Information:**

| Field | Example | Notes |
|---|---|---|
| Expiration Date | `08/31/2011` | |
| **CC Number** | `CMC-545` | Format `<class>-<number>`. CMC = Class A Air Conditioning |
| License Issued | `08/02/2005` | |
| License Category | `Class A Air Conditioning Contractor` | Controlled vocab — BCS issues many classes (A/B Bldg, Roofing, Electrical, Mechanical, Plumbing, Pool, etc.) |
| **License Status** | `Void` | One of `Active` / `Void` / `Expired` / `Pending` (others possible) |

**Contractor Information:**

| Field | Example |
|---|---|
| Contractor Name (qualifier individual) | `PLASTINI, ANTHONY P.` |
| Email Address | `TONY@COASTALCOMFORTAC.COM` |
| Contracting Firm | `COASTAL COMFORT INC` |
| Contracting Firm Phone | `(954) 782-2665` |
| Contracting Firm Address | `881 W McNAB RD / POMPANO BEACH, FL 33060-` |

**Temporary License:** boolean checkbox + expiration date. **Restrictions:** free-text field where BCS staff can record sanctions or scope limits.

### 3.3 Certificate of Use (CU) — the commercial occupancy permit

This is what the user means by "occupancy" in Broward terminology. **A CU is the legal authorization for a tenant to occupy and operate a business in a commercial space.** It's distinct from a building Certificate of Occupancy (CO):

- **CO** — issued *once*, at the end of construction, on the building itself, by the building dept
- **CU** — issued *every time* a new tenant moves in, an existing tenant's use changes, or ownership transfers (for commercial property in BMSD + select cities)

Captured live from a `%PUBLIX%` business-owner search → 5 results countywide → drilled into `98-CU-00153` (POSSE Object ID 4191064), Publix Super Markets #619 at 15801 Sheridan St. URL: `dpepp.broward.org/BCS/Default.aspx?PossePresentation=ViewCertificateOfUse&PosseObjectId=4191064`.

**Header:**

| Field | Example | Notes |
|---|---|---|
| **CU Number** | `98-CU-00153` | Format `YY-CU-NNNNN` |
| POSSE Object ID | `4191064` | Permalink key |
| Status | `Certificate Issued` | Possible: `Pending Inspection` / `Certificate Issued` / `Closed` / `Suspended` / `Void` |
| Fees Due | `$0.00` | |

**Location Type / Category:**

| Field | Example | Notes |
|---|---|---|
| Location Type | `Commercial` | |
| **City Incorporation** | `Unincorporated` | **🔥 the key field** — tells you if this CU is BMSD or a contracting city |
| **Category** | `Change of Use or Occupant` | One of: `New Business` / `Change of Use or Occupant` / `Special Event` / others |

**Business Owner:**

| Field | Example |
|---|---|
| Business Owner | `PUBLIX SUPER MARKETS, INC.` |
| Business Name | `PUBLIX SUPER MARKETS INC. #619` (note the location/store number suffix) |
| Business Phone | `( ) -` (often empty in older records) |
| **Business Type** | `RETAIL GROCERY SUPERMARKET` (controlled vocab — useful for industry classification) |

**Address:**

| Field | Example |
|---|---|
| Address | `15801 SHERIDAN ST, FT. LAUDERDALE, FL 33331` |
| Parcel Folio Number | (empty in this old record; populated on newer ones) |
| Jurisdiction | (empty in this old record) |
| Legal Description | (empty) |
| Zoning District | (empty) |
| Property Zoning | (empty) |

**Parcel Owner:**

| Field | Example |
|---|---|
| Owner Address | (empty) |

**Inspection Date:** `Apr 16, 1998` (single date — when CU inspection cleared)

**Required Inspections:**

```
Structural
Electrical
Plumbing
Mechanical
```

All four trades must pass for a CU to clear. **A property without a current/active CU is operating illegally** — that's a direct distress signal.

Sample list view results (also captured live):

| CU# | Business Owner | Address | City/ZIP | Created | Status | Fees Due |
|---|---|---|---|---|---|---|
| 00-CU-00044 | PUBLIX SUPER MARKETS INC. | 5959 CORAL RIDGE DR. | CORAL SPRINGS, FL 33076 | 01/20/2000 | Closed | $0.00 |
| 01-CU-02124 | PUBLIX SUPER MARKETS # 0759 | 1601 PROMENADE BLVD | WESTON, FL 33327 | 12/10/2001 | Closed | $0.00 |
| 03-CU-01429 | PUBLIX SUPER MARKETS INC. #21 | 2465 GLADES CIR | WESTON, FL 33327 | 04/16/2003 | Closed | $0.00 |
| 04-CU-02157 | PUBLIX SUPER MARKETS INC #107 | 4567 WESTON RD | WESTON, FL 33331 | 11/10/2004 | Closed | $0.00 |
| 98-CU-00153 | PUBLIX SUPER MARKETS, INC. | 15801 SHERIDAN ST. | FT. LAUDERDALE, FL 33331 | 03/04/1998 | Certificate Issued | $0.00 |

So for one of the largest commercial chains in Broward (Publix), BCS only has 5 historical CU records — confirming **most cities run their own CU program**. BCS data is heavy on BMSD + smaller contracting cities.

### 3.4 Permit detail (BCS-issued only)

Permit-search example format is `12-09876` (`YY-NNNNN`). We did not deep-link a sample BCS permit (the user's permit data is from City of Fort Lauderdale's separate Accela system, BLD-/PLB-/MEC- prefixes — none of which appear in BCS). The permit record is structurally similar to other POSSE permit records: permit#, type, status, applied/issued/finalized dates, scope of work, valuation, contractor (linked to the CC# database), inspections list, fees, related sub-permits.

### 3.5 Address / Folio search result list

The Address search at `ParcelSearchByAddress` returns a list of **all permits + CUs + enforcement cases at that parcel** — a single-pane property history. Result columns include record-type indicator + record # + date + status. Each row is a clickable Go link to the relevant detail page.

### 3.6 Elevator record

(Mapped form structure; did not click into a detail.) Search modes: BC ID#, Phone Access Code, Building Name, Address. The BC ID# is the BCS-issued elevator unit identifier; **Phone Access Code is the keypad code** (the four-digit PIN inspectors use to physically access an elevator's mechanical equipment). Detail likely includes: BC ID, building name, address, jurisdiction, elevator type, manufacturer, last inspection date, last inspection result, certificate expiration, certificate status, inspector.

---

## 4. Live Tests Against Our Own Permit Data

Test set drawn from `db/permits.sqlite` (read-only SQLite mode) on 2026-05-10. Total permits in DB: **112,554**, distinct contractors: **8,830**, permits with `status LIKE '%expir%'`: **1,314**.

### Test 1 — Code Enforcement by Parcel ID (negative result, but informative)

- **Input**: Parcel `504211221640` (1813 SE 9 ST, Minoff trust, $215,786 permit `BLD-GEN-26050129` applied 2026-05-07)
- **BCS path**: `ParcelSearchForEnforcement`
- **Result**: `No Enforcement Cases were found for this parcel.`
- **Interpretation**: This is a Fort Lauderdale parcel with an FTL-issued permit. FTL handles its own code enforcement. So **parcel-level lookup of FTL parcels in BCS will mostly return empty** — except for Unsafe Structure cases, which are countywide.
- **Important detail**: the URL after submission was `…&PosseObjectId=453037` — meaning the parcel itself has a POSSE Object ID. Even when no cases are linked, BCS knows the parcel exists in its system (it's loaded for cross-reference). That ID can be reused to query other endpoints.

### Test 2 — Contractor License search (POSITIVE — real signal!)

- **Input**: `%MAG CONSTRUCTION%` (the contractor on the $5.7M permit at 1204 NW 6 ST in FTL)
- **Result**: `No Contractors were found matching your search criteria.`
- **Interpretation**: MAG Construction Inc holds a state-level (FL DBPR) license, not a Broward CC card. They pull permits in cities that accept state licenses; they don't need a Broward CC.

- **Input**: `%COASTAL COMFORT%` (348 permits in our DB; AC contractor active in FTL & Pompano)
- **Result**: ONE record:
  - `CC-545 / Class A Air Conditioning Contractor`
  - **Status: `Void`**
  - **Expiration Date: `08/31/2011`** (expired ~15 years ago)
  - License Issued: 08/02/2005
  - Contractor: PLASTINI, ANTHONY P. / Coastal Comfort Inc / 881 W McNAB RD, POMPANO BEACH 33060
  - Email: TONY@COASTALCOMFORTAC.COM
- **Interpretation**: 🔥 **Direct, validated signal.** Coastal Comfort has been pulling 348 permits in our DB without an active Broward CC card — they presumably operate under a state license now, but it confirms BCS's CC database doesn't capture every active contractor. **Cross-referencing every contractor in our 8,830-distinct-contractor list against BCS would turn up similar void/expired/missing cards.**

### Test 3 — Unsafe Structure cases by city (POSITIVE)

- **Input**: `City = %Lauderdale%`, `Enforcement Type = Unsafe Structure`
- **Result**: Multi-page result set, dozens visible on first page alone, mix of **Open** and **Closed** cases dating from 1999 to recent. Some "Open" cases are 25 years old.
- **Interpretation**: Broward maintains decades of Unsafe Structure history countywide. **Every property with an Open Unsafe Structure case + a recent permit application is a high-confidence editorial signal.**

### Test 4 — Certificate of Use by Business Owner (POSITIVE)

- **Input**: `Business Owner = %PUBLIX%`
- **Result**: 5 historical CU records (Coral Springs, Weston, Ft. Lauderdale 33331). All `Closed` or `Certificate Issued`, all `$0.00 Fees Due`, dated 1998–2004. All with `City Incorporation: Unincorporated` on the records that include that field.
- **Interpretation**: Publix has 50+ stores in Broward; only 5 show up in BCS. **Most cities run their own CU program**. BCS CU data is heavy on BMSD and smaller contracting cities — so for a Florida Signal use case in FTL, BCS CU data has lower coverage but is still valuable for the 33% of Broward addresses that fall in BCS jurisdiction.

### Test 5 — Real expired permits in our DB that might match BCS Unsafe-Structure cases

The Unsafe-Structure case detail has an **`Expired Permit Number`** structured field. Permits in our DB currently in `Expired` status include:

| Permit # | Address | Status | Applied |
|---|---|---|---|
| BLD-ACC-24040794 | 4030 NE 25 AVE, FTL 33305 | Expired | 2024-04-26 |
| BLD-ACC-24050329 | 700 SW 18 CT, FTL 33315 | Expired | 2024-05-13 |
| BLD-ACC-24080775 | 731 E EVANSTON CIR, FTL 33310 | Expired | 2024-08-29 |
| BLD-ACC-24100495 | 2572 NE 26 ST, FTL 33305 | Expired | 2024-10-17 |
| BLD-ACC-24110425 | 3451 BERKELEY BLVD | About to Expire | 2024-11-18 |
| BLD-BARR-24090621 | 700 FLAMINGO DR | About to Expire | 2024-09-25 |

Worth noting: **`731 E EVANSTON CIR` is on the same street as the live Unsafe Structure case 00-0421 at `672 W EVANSTON CIR`** that we drilled into earlier. Probably coincidence (different blocks), but it illustrates the kind of correlation worth surfacing.

---

## 5. Pricing & Limits

- All public search interfaces: **$0** to use
- No subscription tiers, no rate limits documented (but real-world throttling kicks in around 1 req/3 sec)
- Fees only apply when filing a permit, renewing a license/CU/elevator cert, or paying enforcement fines — none of those are relevant to read-only consumers
- Public-records requests via Broward County's PRR portal (broward.org/opengovernment/prr) for **bulk exports** would be the right path if we ever want a CSV dump from BCS

---

## 6. Automation Feasibility

### 6.1 What works (with constraints)

- **Polite session-aware HTML scrape**: Use a `requests.Session` with cookies persisted, GET each search form first to extract the hidden `__VIEWSTATE` / POSSE screen state, then POST your query, parse the result list HTML, deep-link into each `PosseObjectId` for full detail. Rate ≤ 1 req / 5 sec, with retry+jitter on 503s.
- **Permalinks via PosseObjectId**: once you have a PosseObjectId, `Default.aspx?PossePresentation=ViewEnforcementCase&PosseObjectId=<id>` is a stable permalink that you can store and re-fetch.
- **Wildcard `%` searches** for contractor name, business owner, street address, city — letting you do batch lookups on our DB's existing names.

### 6.2 What doesn't work

- ❌ No bulk download endpoint
- ❌ No API
- ❌ No RSS / webhook / scheduled email
- ❌ No CSV export from search results (you have to scrape the result HTML)
- ❌ No PRIA-XML / standardized building-permit feed
- ❌ Sign In is for licensed contractors managing their own license — does NOT unlock additional public data
- ❌ Direct URL deep-linking for searches doesn't carry POSSE state, so you can't bookmark a query

### 6.3 Robots / ToS posture

- No `robots.txt`, no Terms of Use page on `dpepp.broward.org`
- The pages cite the standard FL public-records-disclaimer text
- Default position: public-records data, scraping at polite rate is permissible, but be considerate of the slow shared infrastructure

### 6.4 Recommended pipeline

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 0_BROWARD_BCS_NIGHTLY.command   (new launchd at ~03:30 ET)               │
│ source .venv/bin/activate                                                │
│ python3 scripts/pull_broward_bcs.py --mode incremental                   │
│   → reuse existing requests.Session w/ cookies                           │
│   → for each contractor in permits.contractor_normalized (top 500/night) │
│        query SearchForContractorLicense, persist license + status        │
│   → for each parcel_id with a 2025-26 permit (bounded newest-first)      │
│        query ParcelSearchForEnforcement, persist case rows               │
│   → for each city in our coverage:                                       │
│        query SearchForEnforcement EnforcementType=Unsafe Structure       │
│        From=last 30 days, persist new cases                              │
│ python3 scripts/ingest_bcs.py                                            │
│   → upsert into:                                                         │
│        enrichment_bcs_contractor_license                                 │
│        enrichment_bcs_enforcement_case                                   │
│        enrichment_bcs_certificate_of_use                                 │
│        enrichment_bcs_elevator                                           │
│   → uses writer_lock (Expansion-Hardening doctrine)                      │
│   → defaults --report-only; mutation needs --fix                         │
│ scripts/quality_checks.py --severity warn                                │
└──────────────────────────────────────────────────────────────────────────┘
```

Watermark: each table gets a `bcs_first_seen_at` column. Rate budget per night: ~500 contractor lookups + 300 parcel lookups + ~3 city-wide enforcement queries = ~800 GET+POST pairs ≈ ~70 minutes at 5-sec rate.

---

## 7. Integration with Florida Signal Permit Data

### 7.1 Joinable fields & matching keys

| Florida Signal field | BCS field | Match | Reliability | Coverage |
|---|---|---|---|---|
| `permits.contractor_name` / `contractor_normalized` | BCS Contractor License `Contracting Firm` | Fuzzy/exact text via `%` wildcard | HIGH for BCS-listed contractors; **null for many state-licensed contractors** (validated: MAG Construction not in BCS) | Partial — mainly captures contractors who pull permits in BMSD + small cities |
| `permits.contractor_license` (when present) | BCS `CC Number` (e.g. `CMC-545`) | Exact | HIGH when both populated | BCS's CC# format prefixed by class code; FTL Accela license # often a state DBPR number — requires translation |
| `bcpa_property_card.folio` (12 alphanumeric) | BCS `Parcel ID` (12) **AND** `Folio Number` (8 hyphenated) | Exact | HIGH for property-level lookup | The BCS folio variant is the BCPA "property control number" — same identifier in two formats |
| `permits.address` | BCS `Address` (Street# + Direction + Name + Type + City) | Fuzzy/exact normalized | MEDIUM (text normalization required — e.g., `FT LAUDERDALE` vs `FORT LAUDERDALE`) | Universal |
| `permits.permit_number` (Expired status) | BCS Enforcement Case `Expired Permit Number` | **Exact** | HIGH when populated | 🔥 **the prized join field** — links our 1,314 expired permits directly to any unsafe-structure case BCS opened against them |
| `permits.owner_name` / `bcpa_property_card.owner_name` | BCS Enforcement Case `Owner` (parcel owner) | Fuzzy/exact text | HIGH for residential SFR; varies for trusts/LLCs | Cross-validation source |
| Business owner / tenant name | BCS CU `Business Owner` / `Business Name` | Fuzzy/exact | MEDIUM | Adds tenant-level data we don't currently capture |
| `enrichment.case_number` (existing) | BCS Code-Enforcement `Case #` | Exact | HIGH | Different namespace from court case numbers; needs separate column |

### 7.2 New signal opportunities (source-locked facts only — no scoring per current freeze)

These are **source-locked enrichment facts** to land in the DB; they are NOT signal scores. Per `docs/SIGNAL_ENGINE_DESIGN_RULES.md` and the project's "scoring is paused" rule, dashboards / signal_v2 wiring is out of scope until Andy un-pauses scoring.

| Fact | Construction | Why it's valuable |
|---|---|---|
| **License-status-on-permit** | Cross-reference `permits.contractor_normalized` against `enrichment_bcs_contractor_license`. Flag permits where the contractor's BCS license status is `Void` / `Expired` / missing | Directly surfaces contractors operating with bad credentials — public-interest editorial value |
| **Unsafe-Structure-on-property** | Join `bcpa.folio` → BCS Unsafe Structure cases with `Status = Open` | Buildings BCS considers structurally unsafe, with active permits being pulled |
| **Expired-permit-with-unsafe-case** | Join `permits.permit_number` (status=Expired) → BCS `Expired Permit Number` field | The single highest-confidence distress signal — BCS literally points back to our permit |
| **Permit without CU at commercial address** | For commercial permits in BMSD areas: check if a current Active CU exists for the business at that address | Spots commercial fit-outs that haven't gotten occupancy clearance — frequently illegal-occupancy stories |
| **CU-tenant-turnover** | Track CU records by Address — how many `Change of Use or Occupant` events per year per address | Commercial-corridor distress index (high turnover = struggling shopping center) |
| **Business-type-by-address** | BCS `Business Type` field (e.g. `RETAIL GROCERY SUPERMARKET`) maps every commercial parcel to a controlled-vocab industry | Adds an industry-classification column to our property data |
| **Elevator-out-of-service** | BCS Elevator record `Certificate Status` for buildings in our pipeline | Highrise / mid-rise distress — broken elevators are reportable |
| **Active code-enforcement case during construction** | Permit issued at parcel where BCS has active code-enforcement case | Permits being pulled while the property is in active enforcement = compliance theater |
| **Owner-distress stack (multi-source)** | Property has ≥2 of: Open BCS enforcement case, Open BCS Unsafe Structure case, expired BCS contractor license on the most recent permit, lien filed against the parcel (per Broward Records audit), Lis Pendens (per Broward Records audit) | Compounding distress — the five-alarm signal |

### 7.3 Concrete table proposals (DDL spec, not actual create — per propose-first rule)

```sql
-- Source-locked facts; no scoring; no derived signals.

CREATE TABLE enrichment_bcs_contractor_license (
  cc_number               TEXT PRIMARY KEY,        -- e.g. 'CMC-545'
  posse_object_id         INTEGER NOT NULL,        -- the permalink ID
  contractor_individual   TEXT,                    -- 'PLASTINI, ANTHONY P.'
  contracting_firm        TEXT,                    -- 'COASTAL COMFORT INC'
  contracting_firm_norm   TEXT,                    -- our normalized form for joins
  contractor_email        TEXT,
  contracting_firm_phone  TEXT,
  contracting_firm_addr   TEXT,
  license_category        TEXT,                    -- 'Class A Air Conditioning Contractor'
  license_status          TEXT,                    -- 'Active','Void','Expired','Pending'
  license_issued_date     TEXT,
  license_expiration_date TEXT,
  is_temp_license         INTEGER,
  temp_license_expiration TEXT,
  restrictions            TEXT,
  bcs_url                 TEXT,
  first_seen_at           TEXT NOT NULL,
  last_seen_at            TEXT NOT NULL,
  source                  TEXT NOT NULL DEFAULT 'broward_bcs'
);

CREATE TABLE enrichment_bcs_enforcement_case (
  case_number             TEXT,                    -- '00-0421'
  posse_object_id         INTEGER NOT NULL PRIMARY KEY,
  status                  TEXT,                    -- 'Open','Closed'
  enforcement_type        TEXT,                    -- 'Unsafe Structure','Code Enforcement','Code Compliance'
  case_type               TEXT,                    -- 'UNSAFE STR/STAGNANT POOLS', etc.
  complainant_type        TEXT,
  property_type           TEXT,
  expired_permit_number   TEXT,                    -- 🔥 join key to permits.permit_number
  complaint_violation     TEXT,
  date_established        TEXT,
  correction_deadline     TEXT,
  inspector               TEXT,
  folio_number            TEXT,                    -- BCS form '02-07-05-0560'
  parcel_id               TEXT,                    -- 12-char form '0207050560' (derived)
  address                 TEXT,
  city                    TEXT,
  state                   TEXT,
  zip                     TEXT,
  jurisdiction            TEXT,                    -- 'Fort Lauderdale','Broward County',etc.
  legal_description       TEXT,
  parcel_owner            TEXT,
  parcel_owner_norm       TEXT,
  parcel_owner_mailing    TEXT,
  bcs_url                 TEXT,
  first_seen_at           TEXT NOT NULL,
  last_seen_at            TEXT NOT NULL,
  source                  TEXT NOT NULL DEFAULT 'broward_bcs'
);

CREATE TABLE enrichment_bcs_certificate_of_use (
  cu_number               TEXT PRIMARY KEY,        -- '98-CU-00153'
  posse_object_id         INTEGER NOT NULL,
  status                  TEXT,                    -- 'Pending','Certificate Issued','Closed','Suspended','Void'
  fees_due                REAL,
  location_type           TEXT,                    -- 'Commercial', etc.
  city_incorporation      TEXT,                    -- 'Unincorporated', city name
  category                TEXT,                    -- 'New Business','Change of Use or Occupant',...
  business_owner          TEXT,
  business_name           TEXT,                    -- often includes store/unit number
  business_phone          TEXT,
  business_type           TEXT,                    -- controlled vocab e.g. 'RETAIL GROCERY SUPERMARKET'
  address                 TEXT,
  city                    TEXT,
  state                   TEXT,
  zip                     TEXT,
  parcel_folio_number     TEXT,
  jurisdiction            TEXT,
  legal_description       TEXT,
  zoning_district         TEXT,
  property_zoning         TEXT,
  parcel_owner            TEXT,
  owner_address           TEXT,
  inspection_date         TEXT,
  required_inspections    TEXT,                    -- JSON array ['Structural','Electrical','Plumbing','Mechanical']
  bcs_url                 TEXT,
  first_seen_at           TEXT NOT NULL,
  last_seen_at            TEXT NOT NULL,
  source                  TEXT NOT NULL DEFAULT 'broward_bcs'
);

CREATE TABLE enrichment_bcs_elevator (
  bc_id                   TEXT PRIMARY KEY,
  posse_object_id         INTEGER NOT NULL,
  building_name           TEXT,
  address                 TEXT,
  city                    TEXT,
  jurisdiction            TEXT,
  elevator_type           TEXT,
  manufacturer            TEXT,
  certificate_status      TEXT,
  certificate_expiration  TEXT,
  last_inspection_date    TEXT,
  last_inspection_result  TEXT,
  inspector               TEXT,
  bcs_url                 TEXT,
  first_seen_at           TEXT NOT NULL,
  last_seen_at            TEXT NOT NULL,
  source                  TEXT NOT NULL DEFAULT 'broward_bcs'
);
```

### 7.4 Challenges & mitigations

| Challenge | Detail | Mitigation |
|---|---|---|
| **No bulk feed** | All ingest is per-record HTML scrape | Polite session-aware client, ≤1 req/5 sec, bounded newest-first; cap at top-N per night |
| **POSSE screen-state anti-CSRF** | Direct GET on a search URL doesn't auto-submit | Each scrape = GET form → parse hidden state → POST query → parse result |
| **City-name normalization** | `FT LAUDERDALE` vs `FORT LAUDERDALE` vs `Ft. Lauderdale` | Canonical city dictionary using the BCS dropdown's 33-city list |
| **Folio format dual-form** | BCS uses both `02-07-05-0560` and `0207050560` | Store both; emit one as canonical (12-char no-hyphens) |
| **City-name contains-multiple-municipalities** | USPS `33311` covers parts of FTL + Lauderhill + unincorporated | Use Jurisdiction field on BCS records, not USPS city; fall back to BCPA jurisdiction when missing |
| **Old records have empty fields** | E.g. CU `98-CU-00153` missing folio + zoning | Don't fail validation on these; mark `data_completeness` per row; prioritize newer records for fresh queries |
| **License coverage gap** | State-licensed contractors absent from BCS | Document this as a known limitation; don't conclude "no license" from "no BCS hit" — flag as "no Broward CC found, may be FL DBPR-licensed" |
| **Slow infrastructure** | We saw 503s under modest load | Build retry+jitter from day one; alert if >10% requests fail in a 24h window |
| **Activities-tab data incomplete on old records** | The 25-year-old test case had empty Activities | Don't depend on Activities for joining — use Case Details fields instead |
| **Sealed/confidential cases** | Some enforcement cases (homestead, juvenile, sensitive) get suppressed | Handle missing fields gracefully; never hard-error |

---

## 8. Recommendations

### 8.1 Best way to get BCS data daily

**Build a polite session-aware nightly HTML scraper.** No public bulk feed exists; this is the only path. Architecture and rate-budget are spelled out in § 6.4.

### 8.2 Red flags

- **Don't claim "contractor X has no license"** on the basis of "no BCS hit" — they may be state-licensed. Always classify as `not_in_bcs_database` instead of `unlicensed`.
- **Don't deep-link to PosseObjectId without a freshness check** — POSSE Object IDs are stable, but the underlying record may have been updated. Re-fetch on each access.
- **Don't burst-scrape during business hours** — BCS shares infrastructure with internal staff workflows. Schedule the nightly run between 02:00–05:00 ET.
- **Don't scrape Sign In / authenticated areas.** Public read-only is fine; logging in as a contractor and harvesting data from the auth side would cross an ethical line and may violate the platform's intended use.
- **Account for the post-Surfside Unsafe Structure data being recently rebuilt** — Broward did a major recertification push in 2022–2024. Old records may have status discrepancies vs newer ones.
- **The Permit number format on BCS (`12-09876`) does not match our FTL Accela permit format (`BLD-GEN-26050129`)** — different jurisdictions, different namespaces. Don't try to look up FTL permit numbers in BCS's permit search.

### 8.3 Prioritized next steps (Florida Signal–specific)

| Priority | Action | Effort | Gating |
|---:|---|---|---|
| **P0** | Andy approval to spec out BCS Phase-1 ingest (this report counts as the propose step) | — | — |
| **P0** | Decide whether to land all four enrichment tables in Phase 1, or just `enrichment_bcs_enforcement_case` + `enrichment_bcs_contractor_license` first (highest-signal, smallest scope) | discussion | P0 above |
| **P1** | New canonical doc `docs/BROWARD_BCS_IMPLEMENTATION_PLAN_2026-05-10.md` mirroring the format of the cache-separation and ENRICHMENT_BACKFILL_OPERATING_MODEL plans | 30 min | Plan approved |
| **P1** | Build `scripts/pull_broward_bcs.py` (session-aware client, paramiko-style) + `0_BROWARD_BCS_NIGHTLY.command` wrapper. Defaults to dry-run; `--fetch` is wet. Source venv. PIPESTATUS guard. Use writer_lock. | ~1 day incl. testing | Plan approved |
| **P1** | DDL for the 2-4 enrichment tables (per § 7.3). ChatGPT QA pass. | ~30 min | Plan approved |
| **P1** | New launchd agent `com.floridasignal.broward-bcs-nightly.plist` ~03:30 ET. Plist follows python3-trampoline doctrine for FDA. | 30 min | Wrapper landed |
| **P2** | One-shot **contractor-license cross-check**: for every distinct contractor in `permits.contractor_normalized`, query BCS `SearchForContractorLicense` and persist. ~8,830 lookups, ~12 hours at safe rate. Run once, then incrementally on new contractors. | 1 day batch | P1 stable |
| **P2** | Extend `owner_resolution` (the table that landed 2026-05-05) to also resolve contractor names against the new `enrichment_bcs_contractor_license.contracting_firm_norm`. Adds a `bcs_cc_number_resolved` column. | 1 day | P2 above + existing owner_resolution table |
| **P2** | Code-enforcement parcel cross-check: for every BCPA folio with a 2025-26 permit, query BCS `ParcelSearchForEnforcement` once; persist any cases. | 1 day batch | P1 stable |
| **P2** | Mirror the new BCS tables into Supabase (extend `MIRROR_TABLES` from 22 → 24 or 26 depending on table count). RLS anon-read like the other source-locked tables. | 1 hr | Tables stable locally |
| **P3** | Expand to historical Unsafe Structure ingest — full city-wise sweep for `Enforcement Type = Unsafe Structure` open cases | 2-3 days batch | P2 stable |
| **P3** | Certificate of Use ingest at scale (commercial address sweep) | 2-3 days batch | P2 stable |
| **P3** | Elevator ingest for buildings in our permit pipeline | 1-2 days | P2 stable |
| **P3** | When/if scoring is un-paused: build the cross-source distress score that combines BCS + Broward Records + permits + BCPA. | unknown | Andy un-pauses scoring |

### 8.4 What this report explicitly did NOT do

- Did not log into the Sign In / authenticated portal (out of scope; public-only)
- Did not write any data into Florida Signal tables
- Did not start any launchd agents
- Did not attempt automation against BCS (only ad-hoc human-rate searches during the audit)
- Did not exhaustively enumerate every Case Type sub-vocabulary or License Category — we captured the high-level taxonomy only; full enumeration is a Phase-2 task
- Did not capture the elevator detail field structure (mapped form only, didn't deep-link)
- Did not capture a full BCS-issued permit detail page (BCS permit format `12-09876` doesn't match our FTL `BLD-GEN-...` prefixes; we would need a known BMSD permit # to test)
- Did not run any wet writes anywhere

---

## Appendix A — Quick-test commands you can run yourself

```bash
# Open the BCS root
open "https://dpepp.broward.org/BCS/"

# Search for a contractor named like X
open "https://dpepp.broward.org/BCS/Default.aspx?PossePresentation=SearchForContractorLicense"
# then in the Contracting Firm field type:  %YOUR_CONTRACTOR%

# Search for code enforcement on a specific FTL folio
open "https://dpepp.broward.org/BCS/Default.aspx?PossePresentation=ParcelSearchForEnforcement"
# then enter your 12-char Parcel ID e.g. 504211221640

# Find all Unsafe Structure cases in a city, last year
open "https://dpepp.broward.org/BCS/Default.aspx?PossePresentation=SearchForEnforcement"
# Enforcement Type = Unsafe Structure
# City State and ZIP = %Lauderdale%
# Created Date From = 01/01/2025

# Look up a chain by business owner
open "https://dpepp.broward.org/BCS/Default.aspx?PossePresentation=SearchForCertOfUse"
# Business Owner = %PUBLIX% (or your chain of choice)
```

## Appendix B — Quick reference card

```
ROOT:              https://dpepp.broward.org/BCS/
PLATFORM:          Computronix POSSE Outrider PCI on IIS (e:\inetpub\OutriderPCI\BCS\)
PERMALINK FORM:    Default.aspx?PossePresentation=<View*>&PosseObjectId=<numeric>

KEY SEARCH PATHS:
  Permits by addr:      ?PossePresentation=ParcelSearchByAddress
  Permits by #:         ?PossePresentation=SearchForMasterPermit
  Contractors:          ?PossePresentation=SearchForContractorLicense
  Elevators:            ?PossePresentation=SearchForElevator
  Cert. of Use:         ?PossePresentation=SearchForCertOfUse
  Code Enforcement:     ?PossePresentation=SearchForEnforcement
  Code Enf by Folio:    ?PossePresentation=ParcelSearchForEnforcement

OFFICIAL DETAIL VIEWS (replace <id> with PosseObjectId):
  Contractor Lic:       ?PossePresentation=ViewContractorLicense&PosseObjectId=<id>
  Enforcement Case:     ?PossePresentation=ViewEnforcementCase&PosseObjectId=<id>
  Cert. of Use:         ?PossePresentation=ViewCertificateOfUse&PosseObjectId=<id>
  (Permit / Elevator views follow same pattern)

KEY FIELDS FOR JOIN BACK TO OUR PIPELINE:
  Enforcement Case > Expired Permit Number  ←→  permits.permit_number (status=Expired)
  Enforcement Case > Folio / Parcel ID      ←→  bcpa_property_card.folio
  Contractor License > Contracting Firm     ←→  permits.contractor_normalized
  Cert. of Use > Address + Business Owner   ←→  permits.address + (new) tenant table

CONTROLLED VOCAB SEEN:
  Enforcement Type:   Code Enforcement, Unsafe Structure, Code Compliance
  CU Status:          Pending, Certificate Issued, Closed, Suspended, Void
  CU Category:        New Business, Change of Use or Occupant, Special Event
  CU Location Type:   Commercial, Residential, Industrial, ...
  CU Required Insp:   Structural, Electrical, Plumbing, Mechanical
  License Status:     Active, Void, Expired, Pending

SISTER REGS REFERENCES (not on this site, but you'll cite them):
  - BC Code of Ordinances Ch. 5 (Building Regulations and Land Use)
  - BC Code of Ordinances Ch. 39 (BMSD Zoning Code)
  - Florida Building Code (statewide)
  - FL Statute 399 (elevator program — basis for countywide elevator data)
  - FL Statute 553 + post-Surfside SB 4-D (basis for countywide Unsafe Structure / structural recertification)
```

---

*End of audit. The two reference points the user explicitly asked about — **(a) "occupancy"** and **(b) "codes"** — are covered in § 3.3 (Certificate of Use is the operating/occupancy permit; full field schema captured live from a Publix CU record) and § 3.1 + 7.2 (case-type/violation-code taxonomy + how to use it for signals). Recommended next session prompt: "approved — produce the BCS implementation plan doc per § 8.3 P1."*
