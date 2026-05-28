# Florida Signal — Source Field Capture Audit

*Generated 2026-04-27. Read-only audit of what each source system EXPOSES vs what we CAPTURE. No code or scoring changes.*

---

## TL;DR

| Source | Fields exposed | Fields we capture | Capture % | Verdict |
|---|---|---|---|---|
| **Accela CSV** (Crystal Reports) | ~22 distinct headers across 3 reports | 21 mapped + `raw_<label>` fallback for unknowns | ~100% | Strong — we have a fallback for unmapped headers. |
| **Accela Detail Page** (DOM) | ~45+ fields visible on CapDetail | 35 stored as columns + 4 JSON blobs + raw_json | ~85% | Good but two extraction paths are dead (applicant_name, parcel_block always null). |
| **BCPA Property Card JSON** | **~190 distinct fields** in `parcelInfo` block + 4 sub-blocks | 33 columns | **~17%** | **Weakest of the three**. We persist raw_json so nothing is lost, but most fields are buried in JSON. |
| **Sunbiz fixed-width** | 36 master fields + 6×7 officer fields per record | All 36 master + 7 officer | **~100%** | Complete capture per the DOS spec. |

The three biggest "available but not captured" areas, in priority order:

1. **BCPA mailing address** (where the owner *lives*) — exists in property card JSON, not extracted to a column. Critical for absentee-owner / out-of-state-LLC stories.
2. **BCPA legal description, neighborhood, voting precinct, owner alert verified** — in raw_json, not extracted.
3. **BCPA inline 5-row sales history** (saleDate1-5, deedType1-5, stampAmount1-5, etc.) — in raw_json. We *do* have a separate `bcpa_sales_history` table but it covers only 26% of matched parcels.

Two extraction bugs to flag:

- `accela_details.applicant_name` is **0% populated** even though the scraper has explicit code to extract it.
- `accela_details.parcel_block` is **0% populated** even though the scraper has explicit code to extract it.
- `accela_inspections` has **9,919 of 19,973 rows that are pagination junk** (empty inspection_type, "View Details", "< Prev", "1", etc.) — half of that table is garbage.

---

## 1. Accela — CSV (Crystal Reports export)

Source: `scrape_accela.py` downloads three report URLs (Issued Permits, Opened Permits, Permit Activity, plus Review Status). `parse_crystal_xls.py` parses the binary .xls. The header→canonical map lives in `parse_crystal_xls.HEADER_MAP`. Unknown headers are passed through as `raw_<label>` so nothing is silently dropped.

| CSV Field (normalized) | → Canonical Field | In DB? | Stored Column | Coverage | Notes |
|---|---|---|---|---|---|
| permitnbr / permitnumber / recordnumber / recordnbr | permit_number | Yes | `permits.permit_number` | 100% | Primary key. |
| parcelnbr / parcelnumber / parcel | parcel_id | Yes | `permits.parcel_id` | 31.2% | Raw, unverified parcel id from Accela. |
| permitaddress / siteaddress / address | address | Yes | `permits.address` | 81.5% | |
| permitissuedate / issueddate / issuedate | issued_date | Yes | `permits.issued_date` | 47.9% | |
| permitopendate / openeddate / opendate | opened_date | Yes | `permits.opened_date` | 100% | |
| applieddate | applied_date | Yes | `permits.applied_date` | 100% | |
| finalizeddate | finalized_date | Yes | `permits.finalized_date` | **0%** | Field exists; never populated. Likely the report column itself is blank. |
| applicantfml / applicantname / applicant | applicant_name | Yes (recently added) | `permits.applicant_name` | (sparse — added Apr 2026) | |
| applicantaddress | applicant_address | **No** | — | — | **Available in CSV; never stored.** |
| applicantemail / applicantemailad | applicant_email | **No** | — | — | **Available in CSV; never stored.** |
| ownername / owner | owner_name | Yes | `permits.owner_name` | 2.1% archive-wide, **0% on newest 1,000** | Issued Permits sometimes carries owner; many reports do not. |
| contractorname / contractor | contractor_name | Yes | `permits.contractor_name` | 56.4% | |
| permittype / recordtype / permittypefull | permit_type | Yes | `permits.permit_type` | 99.9% | |
| description / workdescription / notetext | description | Yes | `permits.description` | 77.5% | |
| feetotal / totalfees | fees_total | Yes | `permits.fees_total` | 18.8% | |
| currentstatus / recordstatus / status / reviewstatus / permitstatus / statusdescription | status | Yes | `permits.status` | 100% | |
| statusdate / datereached / datechanged / lastupdated | status_date | Yes | `permits.status_history` JSON | partial | Stored as part of history JSON, not a top-level column. |
| assignedto / reviewer / currentreviewer | assigned_to | **No** | — | — | **Captured in canonical map; never stored.** Useful for "who's holding this up" stories. |
| valuation / jobvalue / jobvaluation / jobcost / latestjobcost | valuation | Yes | `permits.valuation` | 7.9% | |
| originaljobcost | original_valuation | **No** | — | — | **Available in Permit Activity report; never stored.** Bid value vs. revised value comparison would surface scope creep. |
| codate | co_date | **No** | — | — | Certificate-of-Occupancy date from Permit Activity report. **Not stored.** |
| usageclass | usage_class | **No** | — | — | Permit Activity field; **not stored.** |
| license | contractor_license | Yes (via detail) | `accela_details.contractor_license` | 77% of accela_details (1.7% of permits) | CSV value is dropped on load — only the detail-page version persists. |
| phone | contractor_phone | Yes (via detail) | `accela_details.contractor_phone` | 30%+ of accela_details | Same — CSV phone is dropped. |
| mailingaddress | contractor_address | **No** | — | — | **Available in CSV; never stored.** |
| email | email | **No** | — | — | Generic email field — not stored. (Disambiguates to applicant or contractor depending on report.) |
| raw_<unknown> | (preserved) | No | (only in `raw_json`) | n/a | Anything else lands in `permits.raw_json` for forensic recovery. |

**Verdict on Accela CSV:** mostly complete. Six clear losses: `applicant_address`, `applicant_email` (CSV form), `assigned_to`, `original_valuation`, `co_date`, `usage_class`, `contractor_address` (CSV form), generic `email`. All preserved in `permits.raw_json` so the data isn't lost — just not queryable as a column.

---

## 2. Accela — Detail Page (Playwright DOM scrape)

Source: `scrape_accela_detail.py` fetches `aca-prod.accela.com/FTL/Cap/CapDetail.aspx?...` and parses the rendered HTML. Only **2,461 of 109,409 permits** have been through this scraper.

### 2a. Top-level fields the scraper extracts

| DOM Field | In DB? | Stored Column | Coverage (within 2,461) | Notes |
|---|---|---|---|---|
| Status | Yes | `accela_details.status` | 97.5% | More current than CSV. |
| Status Date | Yes | `accela_details.status_date` | high | |
| Applied / Opened Date | Yes | `accela_details.applied_date` | **0%** | Code path exists but stores 0 rows. Worth investigating — could be a parser regression. |
| Issued Date | Yes | `accela_details.issued_date` | **0%** | Same. |
| Finalized Date | Yes | `accela_details.finalized_date` | **0%** | Same. |
| Description | Yes | `accela_details.description` | 83.3% | Often longer than CSV. |
| Valuation | Yes | `accela_details.valuation` | 31.7% | The fallback we wired into v1 scoring. |
| Fees Total | Yes | `accela_details.fees_total` | high | |
| Outstanding Balance | Yes | `accela_details.outstanding_balance` | high | Unpaid fees (admin-status indicator). |
| Applicant Name | Yes | `accela_details.applicant_name` | **0%** | **Extraction code exists at line 1262; column is always null.** Likely a regex/locator regression. |
| Applicant Phone | Yes | `accela_details.applicant_phone` | 35.6% | |
| Applicant Email | Yes | `accela_details.applicant_email` | 37.0% | |
| Owner Name | Yes | `accela_details.owner_name` | 77% | **The only source of permit-owner data we have.** Backfilled to `permits.owner_name`. |
| Owner Address | Yes | `accela_details.owner_address` | 89.1% | Mailing address of the owner — useful for absentee detection. |
| Contractor Name | Yes | `accela_details.contractor_name` | 77% | |
| Contractor Company | Yes | `accela_details.contractor_company` | high | |
| Contractor Phone | Yes | `accela_details.contractor_phone` | 30%+ | |
| Contractor License | Yes | `accela_details.contractor_license` | 30%+ | FL contractor license number. |
| Site Address | Yes | `accela_details.site_address` | high | |
| Parcel Number | Yes | `accela_details.parcel_number` | high | |
| Parcel Block | Yes | `accela_details.parcel_block` | **0%** | **Extraction code exists at line 1334; column is always null.** Same kind of bug. |
| Parcel Lot | Yes | `accela_details.parcel_lot` | high | |
| Subdivision | Yes | `accela_details.subdivision` | 79.7% | |
| Source URL | Yes | `accela_details.source_url` | 97.6% | Direct link back to the Accela page. |

### 2b. Structured sub-blocks (stored as JSON)

| Block | In DB? | Stored As | Coverage | Notes |
|---|---|---|---|---|
| Workflow steps (plan review) | Yes | `accela_details.workflow_json` | 97.6% (in scraped) | Each step has type, status, due_date, completed_date, comments. Stored as opaque JSON — **not queryable as columns**. |
| Related permits / cap tree | Yes | `accela_details.related_permits_json` | 97.6% (in scraped) | Plus `accela_related_records` separate table for fast JOIN. |
| Conditions of approval | Yes | `accela_details.conditions_json` | 8.6% have conditions | Each condition has priority, condition_number, raw_text. **Not queryable as columns.** |
| Application info (custom fields) | Yes | `accela_details.application_info_json` | 97.5% | Free-form key→value pairs from the "Application Information" section. Captures any custom Accela fields (e.g. "Project Description", "Permit Number" cross-references) but **not queryable as columns**. |
| Inspections | Yes | `accela_inspections` table | 19,973 rows | But ~50% are pagination junk — see §2c. |
| Comments | Count only | `accela_details.comments_count` | 100% (count) | **The actual comment content is NOT stored.** Each permit has 0-N comments visible on CapDetail; we capture only the integer. |
| Documents | Count only | `accela_details.documents_count` | 100% (count) | The `accela_documents` table is **empty (0 rows)**. The `0_capture_accela_documents.command` wrapper exists but has never been run. Document URLs, filenames, and types are not captured. |

### 2c. accela_inspections quality issue

Out of 19,973 rows in `accela_inspections`:
- 6,806 rows have `inspection_type = ''` (empty string)
- 3,113 rows have `inspection_type = NULL`
- 2,705 rows have `inspection_type = 'View Details'` (button label)
- 410 rows have `inspection_type = '< Prev'` (pagination control)
- 200 rows have `inspection_type = '1'` (page number)
- 153 rows have `inspection_type = '< Prev 1 2 Next >'` (pagination)
- The remaining ~6.5K rows are real inspections (BLD-BUILDING FINAL, ELE-ELECTRICAL FINAL, BLD-FRAMING, etc.)

**~50% of the inspections table is parser fall-through** — pagination DOM elements being captured as inspection rows. The `inspections_count` field on `accela_details` (which is just `len(record.get("inspections") or [])`) inherits the same noise.

### 2d. Fields visible on the detail page that we don't extract at all

These were not found in the scraper's extraction code:

- **Education / GPS coordinates / topo** — sometimes shown in a "GIS Information" section on CapDetail.
- **Plan-review reviewer comments** — workflow_json carries the step labels but not the inline reviewer notes that show up in the page accordion.
- **Document download URLs** — `documents_count` is captured but the actual document list (filename, type, upload date, URL) is not. The `accela_documents` table is empty.
- **Comments content** — `comments_count` is captured; the comment bodies are not.
- **Hold reasons** — when a permit is on hold, the reason text (often visible in a yellow banner) isn't extracted.
- **Inspection results detail** — the inspections table captures type and date but the *failed-inspection comments* are usually empty (`comments` column nearly all null).

---

## 3. BCPA — Property Card JSON

Source: `enrich_bcpa_property_card.py` calls BCPA's full property-card JSON endpoint. The response wraps everything under `d`, with five sub-blocks. Coverage: **3,956 of 109,409 permits** (~3.6%) have a matched parcel and a property card pulled. **The full JSON is preserved in `bcpa_property_card.raw_json`** — so nothing is lost, but most fields are buried in JSON, not extracted as columns.

### 3a. `parcelInfok__BackingField` (the main payload — 145 fields exposed)

This is a single-element list whose one dict carries 145 distinct keys. We extract a small subset.

#### Captured into columns

| BCPA JSON Key | DB Column | Coverage |
|---|---|---|
| `folioNumber` | `bcpa_property_card.folio` | 100% |
| `useCode` | `bcpa_property_card.use_code` | 98.6% |
| `useCodeName` | (folded into use_code) | n/a |
| `ownerName1` | `bcpa_property_card.owner_name_1` | 98.6% |
| `ownerName2` | `bcpa_property_card.owner_name_2` | 35.6% |
| `ownerShipType` | `bcpa_property_card.ownership_type` | high |
| `justValue` | `bcpa_property_card.just_value` | 98.6% |
| (parsed) `justValue` | `bcpa_property_card.just_value_num` | 98.6% |
| `justLastYearValue` | `bcpa_property_card.just_last_year_value` | high |
| `justLastTwoYearsValue` | `bcpa_property_card.just_last_two_years_value` | high |
| `bldgValue` | `bcpa_property_card.bldg_value` | high |
| `bldgLastYearValue` | `bcpa_property_card.bldg_last_year_value` | high |
| `bldgLastTwoYearsValue` | `bcpa_property_card.bldg_last_two_years_value` | high |
| `assessedLastYearValue` | `bcpa_property_card.assessed_last_year_value` | high |
| `assessedLastTwoYearsValue` | `bcpa_property_card.assessed_last_two_years_value` | high |
| `homesteadFlag` | `bcpa_property_card.homestead_flag` | 98.6% |
| `homesteadPercent` | `bcpa_property_card.homestead_percent` | high |
| `he1Amount`, `he2Amount` | `he1_amount`, `he2_amount` | high |
| `exemptionType` | `exemption_type` | high |
| `countyAHAmount`, `cityAHAmount`, `independentAHAmount` | `county_ah_amount`, `city_ah_amount`, `independent_ah_amount` | high |
| `countyMexAmount`, `cityMexAmount`, `independentMexAmount` | `county_mex_amount`, `city_mex_amount`, `independent_mex_amount` | high |
| `grannyFlatReduction` | `granny_flat_reduction` | low |
| `portabilityValue` | `portability_value` | low |
| `sohValue`, `sohLastYearValue`, `sohLastTwoYearsValue`, `sohSbValue`, `sohYear`, `comSohYear` | various `soh*` cols | high |
| `bldgSqFT` | `bldg_sq_ft` | 98.6% |
| `bldgTotSqFootage` | `bldg_tot_sq_footage` | high |
| `bldgUnderAirFootage` | `bldg_under_air_footage` | high |
| `beds`, `baths` | `beds`, `baths` | 57.5% |
| `actualAge`, `effectiveAge` | `actual_age`, `effective_age` | high |
| `picturePath` | `picture_path` | high |
| `countyCommDistrict`, `countyCommName` | `county_comm_district`, `county_comm_name` | high |
| `flHouseRepDistrict`, `flHouseRepName` | `fl_house_rep_district`, `fl_house_rep_name` | high |
| `flSenatorDistrict`, `flSenatorName` | `fl_senator_district`, `fl_senator_name` | high |
| `fireDistrict` | `fire_district` | high |
| `elementarySchoolName/Grade`, `middleSchoolName/Grade`, `highSchoolName/Grade` | school cols | high |
| (millage block) | `millage_rate`, `millage_year` | high |

**Subtotal: ~33 columns capture ~50 of the JSON keys (some grouped).**

#### Available but NOT captured

These are present in `parcelInfok__BackingField` for every parcel, but never extracted into a column. Listed by category. (All preserved in `raw_json`.)

**Address — situs (property location)**

| BCPA JSON Key | Notes |
|---|---|
| `situsAddress`, `situsAddress1`, `situsAddress2` | Full formatted address. We use `bcpa_info.situs_*` instead, but the property card's situs fields aren't directly exposed. |
| `situsCity` | (we get from bcpa_info) |
| `situsStreetNumber`, `situsStreetDirection`, `situsStreetName`, `situsStreetType`, `situsZipCode` | (we get from bcpa_info) |
| `situsNoUnit` | Unit number — only in property card, not bcpa_info. |

**Address — mailing (where the OWNER LIVES) — CRITICAL GAP**

| BCPA JSON Key | Notes |
|---|---|
| `mailingAddress1` | Owner's mailing address line 1. **NOT STORED ANYWHERE.** |
| `mailingAddress2` | City, state, ZIP of owner. **NOT STORED ANYWHERE.** |

**Why this matters:** when an LLC owns a Fort Lauderdale parcel and the mailing address is in NYC or Miami Beach or Wyoming, that's a journalism story. We have no way to query for absentee owners today.

**Land valuation breakdown**

| BCPA JSON Key | Notes |
|---|---|
| `landValue`, `landLastYearValue`, `landLastTwoYearsValue` | Land-only assessed value (vs. building). Useful for "land grab" / teardown speculation. |
| `landCalcType1-4`, `landCalcPrice1-4`, `landCalcFact1-4`, `landCalcZoning` | How the land is being valued (front-foot, square-foot, acreage). Reveals zoning posture. |
| `landTag` | Land classification tag. |

**Sales history (inline 5-row form on the property card)**

The property card includes the **last 5 sales** as flat fields. We store these in a separate `bcpa_sales_history` table (1,024 rows total — only ~26% of matched parcels have any sales loaded). The inline form duplicates that data:

| BCPA JSON Key | Notes |
|---|---|
| `saleDate1-5` | Up to 5 most recent sale dates. |
| `bookAndPageOrCin1-5` | Recording reference. |
| `book1-5`, `page1-5` | Older book/page format. |
| `deedType1-5` | Type code (warranty deed, quitclaim, etc.). |
| `stampAmount1-5` | Documentary stamp tax — proxy for sale price. |
| `saleVerification1-5` | BCPA's sale-verification code. |

**Tax assessments (per-jurisdiction)**

| BCPA JSON Key | Notes |
|---|---|
| `taxableAmountCounty`, `taxableAmountMunicipal`, `taxableAmountSchoolBoard`, `taxableAmountIndependent` | Per-taxing-authority taxable values after exemptions. |
| `improvementAssessment`, `improvementClass`, `improvementDistrict`, `improvementValue` | Improvement-district assessment. |
| `cleanAssessment`, `cleanClass`, `cleanDistrict` | Clean Beach assessment. |
| `safeNeighborhoodAssessment`, `safeNeighborhoodClass`, `safeNeighborhoodDistrict` | Safe Neighborhood assessment. |
| `stormAssessment`, `stormClass`, `stormDistrict` | (already in bcpa_info but not in property_card cols) |
| `fireAssessment`, `fireClass` | Fire-district assessment. |
| `garbageAssessment`, `garbageClass`, `garbageDistrict` | Garbage-district. |
| `lightAssessment`, `lightClass`, `lightDistrict` | Light-district. |
| `drainageAssessment`, `drainageClass`, `drainageDistrict` | Drainage-district. |
| `miscAssessment`, `miscClass`, `miscDistrict` | Misc. |
| `totalValue` | Sum of all taxable values. |
| `wvdValue`, `ncuPercent` | Working value differential, NCU percent. |
| `flatRateFlag`, `flatRateFlagText` | Flat-rate flag. |

**Property metadata**

| BCPA JSON Key | Notes |
|---|---|
| `legal` | Legal description (metes-and-bounds). Useful for matching adjacent parcels. |
| `neighborhood` | BCPA neighborhood code. |
| `multiNote` | Multi-parcel note. |
| `pairingCode` | Whether this parcel is paired (e.g., commercial + residential). |
| `historicDistrict` | Historic-district designation. **NOT STORED.** Useful for preservation/teardown stories. |
| `votingPrecinct` | Voting precinct code. |
| `usHouseRepDistrict`, `usHouseRepName` | U.S. House district. (We store FL House + Senate but not U.S. House.) |
| `propertyAppraiser` | Name of the appraiser. |
| `schoolBoardName` | Name of the school board. |
| `units` | Unit count from BCPA. (Different from bldg_units in bcpa_info.) |
| `dpsc` | Property classification code. |
| `cBrow`, `checkTrim` | Internal BCPA flags. |
| `multiNote` | Multi-parcel note. |
| `seniorExemptionCity`, `seniorExemptionCounty` | Senior-exemption flags. |
| `schoolAHAmount`, `schoolMexAmount` | School-board amounts. |
| `otherExemptValue` | Other exemption total. |
| `justOtherValue`, `justOtherLastYearValue`, `justOtherLastTwoYearsValue` | Other-property just values. |
| `ownerAlertVerified` | **Owner-alert flag** — Broward's anti-fraud flag indicating the owner has subscribed to deed alerts. Useful operator signal. |
| `problemDeed`, `rejectedDeed` | Deed-validity flags. |

**Subtotal: ~95 BCPA fields available in the parcel block but NOT stored as columns.** All preserved in `raw_json`.

### 3b. `appraizerInfok__BackingField` (BCPA appraiser contact — 3 entries)

| BCPA JSON Key | In DB? | Notes |
|---|---|---|
| `firstName`, `lastName` | **No** | Name of BCPA appraiser. |
| `email` | **No** | Direct contact. |
| `phoneNumber` | **No** | Direct contact. |
| `department` | **No** | (Residential / Commercial / etc.) |

**Useful for journalism — gives a direct source contact for every parcel.** Not stored.

### 3c. `recentSalesk__BackingField` (5 most recent sales)

We have a `bcpa_sales_history` table (1,024 rows / ~26% coverage). The fields exposed:

| BCPA JSON Key | In `bcpa_sales_history`? | Notes |
|---|---|---|
| `saleDate` | (likely yes, would need to verify schema) | Sale date. |
| `price` | (likely yes) | Sale price. |
| `type` | (likely yes) | Deed type. |
| `qualified` | (likely yes) | Qualified-sale flag. |
| `book`, `page`, `cin` | (likely yes) | Recording reference. |
| `propertyAddress` | (likely yes) | Address at time of sale. |

(Schema not directly inspected in this audit; flagging for verification.)

### 3d. `picturesListk__BackingField` (property photos)

| BCPA JSON Key | In DB? | Notes |
|---|---|---|
| `picturePath` (per photo) | **No** | We store one `picture_path` from the parcel block but the per-photo list is not stored. |

### 3e. `millageRatek__BackingField`

| BCPA JSON Key | In DB? | Notes |
|---|---|---|
| `millageRate`, `millageYear` | Yes | `bcpa_property_card.millage_rate`, `millage_year`. |

---

## 4. BCPA — Info API (`bcpa_info` table)

Source: `enrich_bcpa_tier1.py`. A separate, lighter ArcGIS REST endpoint. Stored in 3,956-row `bcpa_info` table. Mostly overlaps with property card but exposes a few unique fields.

| BCPA Info Field | In DB? | Notes |
|---|---|---|
| `folio`, `use_code`, `name_line_1`, `pairing_code`, `land_tag` | Yes | Stored. |
| `bldg_units` | Yes | 7.4% coverage (mostly null on residential parcels). |
| `bldg_year_built`, `actual_year_built` | Yes | High coverage. |
| `total_prc_per_sqft`, `total_prc_per_unit`, `b_sqft`, `b_sqft_rate`, `l_prc` | Yes | Per-unit/per-sqft pricing. |
| `inspect_date`, `cycle`, `reinspect_year` | Yes | When BCPA last appraised. |
| `situs_*` (street_number, street_direction, street_name, street_type, street_post_dir, situs_unit_number, situs_city, situs_zip_code) | Yes | Full situs address parts. |
| `res_district`, `comm_district`, `comm_ab_district` | Yes | Stored. |
| `bldg_use_code`, `new_property_code`, `class` | Yes | Classification. |
| `damage_type`, `damage_reported` | Yes | **Stored but not currently used.** Storm-damage flags. |
| `owner_alert` | Yes | **Stored but not currently used.** |
| `model`, `source_service` | Yes | Audit-only. |

---

## 5. Sunbiz — Master + Officer fixed-width records

Source: `ingest_sunbiz_sftp.py`. Format defined by FL DOS at `dos.sunbiz.org/data-definitions/cor.html`. Total record length 1,440 chars; 36 master fields + 6 officers × 7 fields each.

### 5a. Master block (36 fields)

| DOS Field # | Field Name | In DB? | Stored Column | Notes |
|---|---|---|---|---|
| 1 | document_number | Yes | `sunbiz_entities.document_number` | Primary key. |
| 2 | entity_name | Yes | `sunbiz_entities.entity_name` (+ `entity_name_normalized` derived) | |
| 3 | status | Yes | `sunbiz_entities.status` | A/I. |
| 4 | filing_type | Yes | `sunbiz_entities.filing_type` | DOMP/FORP/FLAL/etc. |
| 5-10 | principal_addr1, addr2, city, state, zip, country | Yes | `sunbiz_entities.principal_*` | |
| 11-16 | mailing_addr1, addr2, city, state, zip, country | Yes | `sunbiz_entities.mailing_*` | |
| 17 | filing_date | Yes | `sunbiz_entities.filing_date` | YYYYMMDD → ISO. |
| 18 | fei_number | Yes | `sunbiz_entities.fei_number` | Federal EIN. |
| 19 | more_than_six_flag | Yes | `sunbiz_entities.more_than_six_flag` | Y if >6 officers. |
| 20 | last_transaction_date | Yes | `sunbiz_entities.last_transaction_date` | |
| 21 | state_country | Yes | `sunbiz_entities.state_country` | |
| 22-30 | report_year_1/2/3, report_date_1/2/3 | Yes | `sunbiz_entities.report_year_*`, `report_date_*` | Filler bytes 23/26/29 dropped. |
| 31-36 | ra_name, ra_type, ra_addr1, ra_city, ra_state, ra_zip | Yes | `sunbiz_entities.ra_*` | Registered agent. |

### 5b. Officer block (6 officers × 7 fields)

| DOS Field | In DB? | Stored Column |
|---|---|---|
| seq (block index 0-5) | Yes | `sunbiz_officers.seq` |
| title | Yes | `sunbiz_officers.title` |
| title_full (derived from `TITLE_MAP`) | Yes | `sunbiz_officers.title_full` |
| type | Yes | `sunbiz_officers.type` |
| officer_name | Yes | `sunbiz_officers.officer_name` (+ `officer_name_normalized` derived) |
| addr1 | Yes | `sunbiz_officers.addr1` |
| city, state, zip | Yes | `sunbiz_officers.city`, `state`, `zip` |

**Verdict on Sunbiz: 100% capture per the DOS spec.** Every byte of the fixed-width record is either stored or explicitly identified as a filler byte. The DOS spec doesn't expose anything else for these records.

What Sunbiz **doesn't** expose in the SFTP feed (and we therefore can't capture):
- Officer addr2, country, phone, email — none in the spec.
- Beneficial-owner / FinCEN reporting — not in the public file.
- Annual report PDF / detailed events history — only the most recent 3 report dates.
- Document images — would require scraping sunbiz.org HTML per document.

---

## 6. Cross-cutting findings

### 6a. Fields we're NOT capturing but should consider

In rough impact order, by source:

**Accela**
1. `applicant_address`, `applicant_email` (CSV) — exists in some reports; not stored. Useful for contact.
2. `assigned_to` / `currentReviewer` (CSV) — who's holding up plan review. **Useful for "stuck permit" stories.**
3. `original_valuation` (CSV — Permit Activity report) — bid value vs. revised value. **Captures scope creep.**
4. `co_date` (CSV) — Certificate-of-Occupancy date.
5. `usage_class` (CSV) — Permit Activity field.
6. **Comments content** (detail page) — we count them, we don't store them. Project drama lives here.
7. **Document URLs/filenames** (detail page) — `accela_documents` table is empty.
8. **Hold reasons** (detail page) — yellow-banner text on stalled permits.

**BCPA — high-value additions** (all already in `raw_json`, just not extracted)
1. **Mailing address 1 & 2** — owner's home address. The single biggest BCPA gap. Drives absentee-LLC detection.
2. **Land value** (vs. building value) — separate columns. Drives teardown speculation detection.
3. **Inline 5-row sales** (saleDate1-5, deedType1-5, stampAmount1-5) — where `bcpa_sales_history` is missing (74% of matched parcels).
4. **Owner alert verified** — Broward's anti-fraud flag. Operator-quality signal.
5. **Historic district designation** — drives preservation stories.
6. **Voting precinct, U.S. House district** — for political-context overlays.
7. **Legal description** — adjacency matching.
8. **BCPA appraiser contact** — direct source for every parcel.

**Sunbiz**
- Nothing unexposed in the SFTP feed. To get more (annual report PDFs, beneficial owners) you'd need a different ingest path.

### 6b. Fields we ARE capturing but never populating

1. `permits.finalized_date` (CSV field exists; never appears).
2. `permits.unit_count` (3 of 109,409 — effectively dead).
3. `permits.invalid`, `permits.invalid_reason` (0 rows).
4. `accela_details.applicant_name` — **extraction bug.** Code path exists; column is always null.
5. `accela_details.parcel_block` — **extraction bug.** Same.
6. `accela_details.applied_date`, `issued_date`, `finalized_date` — extraction code references them via `_parse_date(...)`, but coverage is 0%. Likely the locator never resolves.
7. `bcpa_property_card.site_address_1` — column exists; never populated. (We get the same data via `bcpa_info.situs_*`.)
8. `accela_documents` — entire table is 0 rows.
9. `flood_zones`, `storm_events` — entire tables are 0 rows. Schema-only.

### 6c. Fields not worth capturing

- `accela_details.scrape_status`, `error` — these are audit fields, useful as-is, no need to expand.
- Sunbiz `_filler_1`, `_filler_2`, `_filler_3` — DOS filler bytes; intentionally dropped.
- BCPA `cBrow`, `checkTrim` — internal BCPA flags with no documented meaning.
- BCPA `ExtensionData`, `__type` — WCF/SOAP envelope artifacts.

### 6d. Data quality issues to fix BEFORE adding new captures

These existing capture paths are buggy and should be repaired before adding new ones:

1. **`accela_inspections` is half pagination junk.** ~9,919 of 19,973 rows are control-element captures (`View Details`, `< Prev`, `1`, etc.). The parser is matching the inspection table's surrounding pagination DOM, not just the inspection rows.
2. **`accela_details.applicant_name` always null** despite extraction code. Likely the regex/locator no longer matches the current Accela DOM.
3. **`accela_details.parcel_block` always null** despite extraction code. Same.
4. **`accela_details.applied_date`/`issued_date`/`finalized_date` always null** despite extraction code. Same — and notably, we're losing a chance to corroborate the CSV dates.
5. **`accela_documents` table empty** — `0_capture_accela_documents.command` exists but has never run.

### 6e. Conflicts and overlaps in source coverage

| Field | Accela CSV | Accela Detail | BCPA | Resolution |
|---|---|---|---|---|
| Owner name | `permits.owner_name` (2.1%) | `accela_details.owner_name` (77% of scraped) | `bcpa_property_card.owner_name_1` (98.6% of matched parcels) | Detail backfills permits.owner_name; BCPA is authoritative for "current owner of the parcel". |
| Address | `permits.address` (81.5%) | `accela_details.site_address` | `bcpa_info.situs_*` | Permit address is what was filed; BCPA is what BCPA records as the situs. |
| Valuation | `permits.valuation` (7.9%) | `accela_details.valuation` (31.7% of scraped) | `bcpa_property_card.just_value_num` (98.6% of matched parcels) | All three are different things: permit valuation = declared project value, accela = same source via DOM, BCPA just_value = appraised property value. |
| Use code | — | — | `bcpa_info.use_code` AND `bcpa_property_card.use_code` | Sometimes disagree (raw "01" vs "01-01 SINGLE FAMILY"). Property card preferred. |
| Sales history | — | — | `bcpa_sales_history` (1,024 rows) AND `bcpa_property_card.raw_json` (5 inline) | Inline form is in raw_json for every matched parcel; standalone table covers only ~26%. |

---

## 7. Bottom line — what changes if we close every gap

If we extracted every available field today, the impact would be:

- **+1 new dimension for journalism**: absentee-owner / out-of-state-LLC detection (BCPA mailing address).
- **+1 new dimension for storytelling**: stuck-permit + plan-review delays (Accela `assigned_to`, comments content, hold reasons).
- **+1 new dimension for valuation**: scope-creep detection (CSV `original_valuation` vs. `latestjobcost`), land-vs-building speculation (BCPA `landValue`).
- **+1 backfill source** for sales history on the 74% of matched parcels currently missing it (BCPA inline saleDate1-5).
- **Bug fixes** that recover already-coded but currently-broken capture paths (Accela detail dates, applicant_name, parcel_block).

What it would NOT change: the sparseness of the underlying join keys. Even if BCPA's full property card was fully extracted into columns, only **3,956 of 109,409 permits** have a matched parcel today. New columns help the matched permits; they don't help the 92% of permits that lack a parcel match.

In other words: **capturing more fields helps richness; raising parcel-match rate helps reach.** The map-ready batches address reach. This document addresses richness.
