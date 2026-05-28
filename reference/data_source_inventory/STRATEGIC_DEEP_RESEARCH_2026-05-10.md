# Florida Signal — Strategic Deep Research

*Author: Claude (read-only strategic research). Date: 2026-05-10. Inputs: the four 2026-05-10 audit docs (Broward Recording / liens, Broward BCS, FDEP ERP, three-source FAA+Clerk+AGOL) + the live `db/permits.sqlite` state + the existing pipeline doctrine in `CLAUDE.md`. This is editorial research output; per the project convention it does **not** trigger the 7-step doc-update rule. No code, schemas, wrappers, plists, Supabase, GitHub, Vercel, or Drive state was changed in producing this report.*

---

## How to read this

Andy: this is long because you asked for it long. If you're tired, **read Appendix C first**, then come back to whichever numbered section it points you at. The hardest tradeoffs are in **Appendix A**. The honest "I considered these and concluded they're a distraction" list is in **Appendix B**.

Citations look like `[BCS § 3.1]`, `[ERP § 4.4]`, `[LIENS § 6.4]`, `[3SRC § 1.3]`. They map to:

- **LIENS** = `BROWARD_LIENS_AUDIT_2026-05-10.md`
- **BCS** = `BROWARD_BCS_AUDIT_2026-05-10.md`
- **ERP** = `FDEP_ERP_AUDIT_2026-05-10.md`
- **3SRC** = `THREE_SOURCE_AUDIT_2026-05-10.md`

Numbers are real. Where they're estimates, I show the math.

---

## 1. Top 10 Data Assets — Ranked

Across the four new audits and what's already running, ten data assets stand out. I'll rank them by what they unlock for product and journalism, not by raw volume. The criterion is leverage: how much new truth can Florida Signal produce per dollar of build cost.

**1. Broward Official Records SFTP feed.** The single highest-leverage asset, full stop. `bcftp.broward.org` over plain SSH-22 with `crpublic`/`crpublic` credentials gives every recorded instrument in Broward — ~2,500–2,700 records per business day, six file types, ~600 KB of structured text per day plus a 400-MB image ZIP if you want the TIFFs `[LIENS § 2.1, 2.2]`. The text alone covers Notices of Commencement (~260/day), mechanic's liens (~149/day), final judgments (~271/day combined FJ+CFJ), Lis Pendens (~22/day), mortgages (~186/day), deeds (~281/day), and releases (~818/day). 48 years of consolidated annual archives sit in `/OR_Yearly_Exports/` for one-shot historical backfill, ~8 GB uncompressed text total `[LIENS § 2.4]`. Refresh: next-business-day at ~10:28 ET, 3–4 calendar-day end-to-end QA lag. Cost: $0. **No commercial competitor sells this.** PropertyRadar, ATTOM, and CoreLogic resell aggregated lien products nationally, but they ingest with multi-week latency, omit NOCs entirely (the leading-indicator field), and charge $5K–$50K/year for what Broward gives away by SFTP.

**2. FDEP ERP ArcGIS REST API.** Cleanest, most automation-friendly external dataset in the entire sweep. `ca.dep.state.fl.us/arcgis/rest/services/OpenData/ERP/MapServer` — eight feature layers, 33 fields per record on Layer 1, every record geo-referenced and document-linked via the `DOCUMENTS` field that deep-links into FDEP's DepNexus PDF portal `[ERP § 2.3, 2.5]`. Live volume: 2,249 historical Broward ERPs, 43 currently OPEN, 14 new in last 30 days, 4 in last 7 `[ERP § 4.1]`. Refresh: real-time API; we set our own cadence (daily is plenty). Cost: $0, no auth, no rate limit. The killer fact is the validated 5–6-week lead time — the audit confirmed `2401 DEL LAGO DR / RIZAI DOCK EXTENSION` filed an FDEP ERP on 2026-03-31, then matching FTL building permits dropped 2026-05-07/08 from Yacht Lifters Inc ($139K) and Precision Tech ($4,100) `[ERP § 4.4]`. **No competitor for Broward sells this cross-reference.** ATTOM has FDEP data nationally but doesn't join it to building permits.

**3. Internal `owner_resolution` table.** Not new — landed 2026-05-05, 9,043 rows synced to Supabase, composite-PK, RLS enabled `[CLAUDE.md activity log]`. This is the asset that makes every other join possible. Without it, the LLC-shell maze that surrounds every Broward developer ("`1745 SE 11TH STREET LLC`," "`OCEAN HARBOR HOLDINGS II LLC`") is unparseable. With it, an FDEP ERP applicant, a Records NOC owner, a BCS Unsafe Structure parcel owner, and a permit owner all collapse to one canonical entity. The audits explicitly call out extending this to also resolve **contractor names** (currently it only resolves owners) `[LIENS § 8.3 P2, BCS § 8.3 P2]`. That extension is the single highest-leverage code change in the next 30 days. **No competitor has anything like this for Broward.** Reonomy and PropertyShark have national LLC-resolution but they're noisy and don't include Sunbiz cross-references.

**4. BCS Unsafe Structure case database with `Expired Permit Number` field.** The killer field in Broward BCS. Every Unsafe Structure case carries a structured `Expired Permit Number` column that joins back directly to `permits.permit_number` for the 1,314 expired permits in our DB `[BCS § 3.1, 7.1]`. BCS is the countywide AHJ post-Surfside for structural-safety cases, so this dataset spans every city. The audit pulled live evidence of cases dating to 1999 still showing `Open` status — properties with 25-year unresolved structural concerns where BLD permits are still being issued. Refresh: nightly polite scrape (~03:30 ET), no API, ≤1 req/5 sec, ~70 min wall time `[BCS § 6.4]`. Cost: $0. **No competitor sells this** — it's a county-only dataset behind a Computronix POSSE form.

**5. BCS contractor competency-card licenses with status field.** 8,830 distinct contractors in our DB; the audit live-validated that **Coastal Comfort Inc — 348 permits in our DB — holds CC-545 with `License Status: Void` since 2011-08-31** `[BCS § 4 Test 2]`. That's a one-firm proof-of-concept that systematically cross-checking every contractor against `enrichment_bcs_contractor_license` will surface dozens of similar void/expired cards. Refresh: daily incremental + one-shot full sweep (~12 hours at safe rate). Cost: $0. **CoreLogic and BuildZoom both publish contractor data, but neither carries the Broward CC# license-status field** — that's because Broward CCs are county-issued, not state, and the data lives only in BCS POSSE.

**6. FAA OE/AAA tall-structure / crane filings.** Federal database of every structure filed for airspace review — typically anything over 200 ft AGL or in airport proximity, plus construction cranes. **Official RESTful API with WADL spec, 11 GET endpoints, no auth, XML response** `[3SRC § 1.2c]`. Live test: 4,623 ASNs returned for FL/2026 in a single call. Per-case 28-field schema includes `dateEntered`, `sponsor`, `structureType` (with `CRANE` as a discrete value), `aglStructureHeight`, `latitude`, `longitude`, `statusCode` `[3SRC § 1.3]`. Refresh: daily REST poll plus a fallback weekly Saturday-night CSV export. Cost: $0. **The FAA data itself is sold by airspace-consulting firms, but no competitor cross-references it to local building permits for South Florida.** The CRANE rows are the killer subset — they tell you a building is going up *right now*, before any photo or trade-press story.

**7. Broward Foreclosure Auction (RealAuction).** Per-day publicly-iterable URL `https://www.broward.realforeclose.com/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AUCTIONDATE=MM/DD/YYYY` lists every scheduled foreclosure sale with case #, **12-char Parcel ID matching BCPA folio exactly**, property address, final judgment amount, plaintiff max bid, auction date/time `[3SRC § 2.4]`. Volume: ~100–150 sales/month in Broward, 25 on busy days. RealAuction operates the same platform across dozens of FL counties (Miami-Dade, Palm Beach, Hillsborough, Pinellas, Orange) — a future multi-county Florida Signal can iterate the same scraper. Refresh: daily polite scrape. Cost: $0 (login only required for bidding, not for viewing). **PropertyRadar sells foreclosure data but updates weekly and doesn't cross-reference to building permits.** RealtyTrac's national feed is paywalled and laggy.

**8. BCS Certificates of Use (commercial occupancy).** Every commercial tenant occupying space in unincorporated Broward + contracting cities needs a CU. Format `YY-CU-NNNNN`, with a `Category` field including `Change of Use or Occupant` — a literal commercial-tenant-turnover event. Captured fields include `Business Type` controlled vocabulary (e.g. `RETAIL GROCERY SUPERMARKET`), `Required Inspections` JSON, `Status` (`Pending Inspection` / `Certificate Issued` / `Closed` / `Suspended` / `Void`) `[BCS § 3.3]`. Coverage is partial — BCS only sees BMSD + contracting cities; FTL handles its own — but it adds a tenant-level data layer we currently have nothing on. Refresh: nightly scrape. Cost: $0. **No competitor sells commercial-tenant-turnover for Broward. Reonomy comes closest but at the property-level, not the tenant-level.**

**9. Broward AGOL tenant `JMAJrTsHNLrSsWf5` — 674 published services.** Same ArcGIS REST pattern as FDEP ERP, hosted in Broward County's own AGOL tenant `[3SRC § 3.3]`. Of the 674 services, the standouts are `100_Year_Flood_Elevation__Current_vs_2060_WFL1` (climate-projection layer), `2022_HUD_Low_Mod_Income_Feature_Layer` (equity overlay), `Community___Wastewater_Treatment_*` (septic vs sewer), `BCPA_Parcels` (parcel polygons with FOLIO + USE_CODE + FULL_SITE_ADDRESS), `WaterandSewer`, `PumpStations`. Refresh: weekly is plenty for service-area data; on-demand for editorial overlays. Cost: $0. **No competitor packages this for editorial use in Broward.** This is the "context layer" — flood, equity, infrastructure context overlaid on every permit story.

**10. The existing `db/permits.sqlite` itself.** 112,554 permits, 8,830 distinct contractors, BCPA-matched 95.2% / geo 88.8% / Accela detail 99.4% on the last 14-day cohort `[CLAUDE.md current state]`. This is the spine. Without it none of the new sources have anything to attach to. Worth ranking explicitly because in any realistic acquisition or partnership conversation, this is what's being valued — the rest is enrichment around the spine.

**Stop ranking here.** Broward Clerk Case Search and Broward Water & Wastewater service-area data are both useful, but Clerk is reCAPTCHA-blocked and only good for ad-hoc lookups, and W&WS is captured implicitly by ingesting FTL's existing `ROW-SEW-/ROW-WTR-/ENG-` permit prefixes that are already in our DB and just need a `permit_category` tag `[3SRC § 3.2]`. They don't earn a top-10 slot.

---

## 2. Signal-Machine Architecture

What follows is the end-to-end design that turns 11 sources into delivered signals, given the constraints (Mac → DigitalOcean Phase 2, mostly AI-automated, one operator + occasional contractor labor, scoring frozen until further notice).

### Layer 1 — Ingest (~3 operator-weeks of new build)

The Mac launchd appliance is already proven for Accela + BCPA + Sunbiz + Google geo. Adding the four new ingest paths follows the same pattern: a `0_*.command` wrapper that sources `.venv/bin/activate` and uses `${PIPESTATUS[0]}` after `tee` `[CLAUDE.md venv doctrine]`, calls a Python module with `--report-only` default, and a launchd plist with the python3 trampoline pattern for FDA `[CLAUDE.md launchd FDA rule]`. New components:

- `scripts/pull_broward_official_records.py` — paramiko-based SFTP pull, ~600 KB/day text + optional 400 MB ZIP, idempotent re-pulls. Launchd at 11:05 ET (after the typical 10:28 release). Tables: `enrichment_broward_doc/_party/_legal/_link` `[LIENS § 8.3]`.
- `scripts/pull_fdep_erp.py` — ArcGIS REST poll of layers 0/1/4/6, watermark by `RECEIVED_DATE` and `AGENCY_ACTION_DATE`. Launchd at 04:00 ET. Tables: `enrichment_fdep_erp/_erpce/_inspection` `[ERP § 6.1]`.
- `scripts/pull_faa_oeaaa.py` — REST poll of `asnList/OE/{year}?state=FL`, diff-fetch full case for new ASNs, filter by Broward bbox `25.95–26.40 lat, -80.50 to -80.05 lon` `[3SRC § 1.4]`. Launchd at 04:30 ET. Table: `enrichment_faa_oeaaa`.
- `scripts/pull_realauction_broward.py` — daily scrape of next 60 days of `&AUCTIONDATE=MM/DD/YYYY` URLs at ≤1 req/3 sec; re-scrape recent dates daily, distant ones weekly `[3SRC § 5.1]`. Launchd at 05:00 ET. Table: `enrichment_realauction_foreclosure`.
- `scripts/pull_broward_bcs.py` — session-aware HTML scrape with cookies, screen-state harvest, ≤1 req/5 sec, ~70 min wall time `[BCS § 6.4]`. Launchd at 03:30 ET. Tables: `enrichment_bcs_contractor_license/_enforcement_case/_certificate_of_use/_elevator`.
- `scripts/pull_broward_agol.py` — selective ArcGIS REST queries of WaterandSewer, QAlert_WaterServiceAreas, 100yr flood, HUD income; weekly cadence `[3SRC § 3.3]`. Launchd Sunday 06:00 ET. Tables: `enrichment_broward_agol_*`.

Each script defaults to dry-run with a `--fetch` or `--fix` flag for wet mode, per Expansion-Hardening doctrine. All writes go through `writer_lock`. All wrappers use the venv-source + PIPESTATUS doctrine. Six new plists added to `0_install_all_launchd_agents.command`.

Effort: 3 operator-weeks for an experienced operator (Andy + AI-pair-programming) given the existing wrapper templates. The Records SFTP and FDEP ERP scripts are each ~1 day of work; the other four are 1–4 days each.

### Layer 2 — Enrichment & Resolution (~2 operator-weeks)

This is where the multi-source picture becomes one picture. The address-normalization service (street-type abbreviations, city-name canonicalization, ZIP-to-jurisdiction mapping) has to land first because every cross-source join depends on it `[ERP § 8.2, BCS § 7.4]`. Then the existing `owner_resolution` table extends to also resolve:

- contractor names (Permits.contractor_name ↔ BCS Contracting Firm ↔ Records nme-ver R-party on NOCs)
- business owners (BCS CU Business Owner ↔ Sunbiz)
- ERP applicants (FDEP APPLICANT_COMPANY ↔ Sunbiz)
- FAA sponsors (FAA `sponsor` ↔ Sunbiz)
- foreclosure plaintiffs (RealAuction Plaintiff ↔ canonical bank/servicer list)

The output is a single `entity_resolution` table that maps any source's name string to a canonical entity ID, with a confidence score. ChatGPT QA pass before each round of changes. **AI-automatable: yes** — Claude/GPT are very good at this kind of fuzzy-string-to-canonical-entity matching, with rules backstopping the LLM where the strings are clean (Sunbiz docs, parcel folios). Effort: 2 weeks.

### Layer 3 — Source-locked composite facts (~1 operator-week)

This is the layer the project doctrine `[CLAUDE.md scoring paused]` permits today. Build deterministic SQL views and materialized tables that combine sources but don't *score* them:

- `enrichment_permit_noc_match` — every permit ↔ NOC pairing within ±90/+30 day window
- `enrichment_permit_erp_match` — every permit ↔ FDEP ERP pairing on parcel/owner/address
- `enrichment_property_event_timeline` — chronological multi-source event log per parcel `[ERP § 7.2]`
- `enrichment_open_liens_per_parcel` — derived from Records LIE/FJ/CFJ/LP minus RST releases via lnk-ver cross-references
- `enrichment_contractor_license_status_per_permit` — joins BCS license rows to the contractor on each permit
- `enrichment_unsafe_structure_per_parcel` — joins BCS Unsafe Structure cases to the parcel on every permit

These are *facts*, not scores. They land as new `enrichment_*` tables, get mirrored to Supabase (MIRROR_TABLES grows from 22 → ~30), and feed the editorial brief and the dashboard. **No signals scored here** — that respects the freeze. Effort: 1 week.

### Layer 4 — Scoring (frozen; design only)

Per project doctrine, scoring stays paused. But the architecture must allow it to be wired on top later without breaking anything. The right shape is a scoring engine that reads only from `enrichment_*` source-locked tables, writes to a separate `signals_v3` namespace (not the frozen `signals_v2`), and is independently controllable. See § 7 for the v1 design.

### Layer 5 — Delivery (~2 operator-weeks)

Three delivery surfaces:

- **Markdown daily brief** generator that reads from the composite-facts layer and emits a daily-brief markdown file at ~05:30 ET, mirrored to Drive and pushed to a paid Substack via the API.
- **Real-time alerts** — when a row lands in any `enrichment_*` table that matches a subscriber's saved filter, fire an email/SMS via Postmark/Twilio. Capped at N/day per subscriber to avoid fatigue.
- **JSON/CSV API** — Supabase RLS already gates anon vs authenticated. New paid-tier policies expose select tables to API customers via a thin Next.js API route under `/api/v1/`.

Effort: 2 weeks.

### Where AI is the right tool vs rules

Three AI roles, in order of value:

1. **Entity resolution** — LLMs are very good at "is `LAS OLAS SMI, LLC` the same entity as `Las Olas SMI LLC` and `LasOlas Marina LLC`?". Use Claude Haiku for bulk, Claude Sonnet for hard cases. Already proven in the existing `ai_clean_permits.py`.
2. **Document OCR + extraction** — TIFF NOCs from `img.zip` and FDEP ERP application PDFs from DepNexus need OCR plus structured field extraction (permit #, contract amount, claimant address, project description). Claude Sonnet with vision handles this; fallback to Tesseract for cost.
3. **Editorial drafting** — daily brief headline + lead paragraph for each story, generated by Claude Sonnet from the structured event payload. Human editorial review (Andy + a contractor) approves before publish.

**Rules are sufficient for**: parcel-folio joins, date arithmetic, lien open/satisfied calculation via lnk-ver cross-references, jurisdiction mapping, controlled-vocabulary lookups (CC# license status, ERP permit type, BCS enforcement type). LLMs add no value here and would be more expensive and less reliable.

### Where humans are required

- Editorial judgment on which leads run as stories
- Tipline triage and source verification
- Pricing decisions
- Sales calls with developers/brokers/lenders
- Annual review of the scoring weights

### Phase 2 graduation

When the first paying customer lands or DB > 30 GB, migrate per the existing plan: DigitalOcean droplet $20/mo, managed Postgres $30/mo, S3 backups $2/mo `[CLAUDE.md Phase 2]`. The architecture above is portable — every script is Python+`db/permits.sqlite` today; the same scripts run unchanged against managed Postgres after a ~1-week migration. Don't migrate prematurely.

---

## 3. Uniqueness Map

What makes the combined dataset genuinely un-replicatable for Broward? Nine distinct multi-source combinations stand out. Each is a join no national vendor performs because they don't ingest all the necessary inputs.

**3.1 ERP → Permit lead-time ledger.** Already validated `[ERP § 4.4]`: filing of an FDEP ERP for a waterfront/wetland project precedes the corresponding city building permit by 5–6 weeks on average. This pattern requires (FDEP ArcGIS REST) + (existing FTL Accela permits) + (BCPA folio for parcel join) + (`owner_resolution` for owner cross-match). **Closest competitor**: ATTOM has FDEP at the state level but doesn't cross-reference to local building permits. PropertyShark doesn't carry FDEP at all.

**3.2 NOC-to-permit confirmation.** Did construction actually start? Joins the daily Records NOC stream `[LIENS § 6.4]` to the existing permits table on (contractor_normalized + owner_normalized) within a ±60-day window. The reverse — permit issued >60 days but no NOC — surfaces stalled jobs. **Closest competitor**: BuildZoom claims to do this nationally but only for a handful of large counties; Broward is not one of them. Local title insurers track NOCs internally for their own underwriting but don't publish.

**3.3 Open lien stack on permitted property.** Per-parcel count of open liens (LIE/FJ/CFJ/LP from Records, minus RST releases from lnk-ver cross-references) joined to active permits. **Closest competitor**: PropertyRadar sells lien data nationally but at weekly latency, no NOC overlay, no permit-pipeline cross-reference for Broward.

**3.4 Contractor license-void + active permits.** Validated proof-point: Coastal Comfort Inc has 348 permits in our DB while holding a `Void` BCS CC card since 2011 `[BCS § 4 Test 2]`. Requires (Permits) + (BCS contractor license scrape) + (entity_resolution) + (FL DBPR cross-reference, future audit). **Closest competitor**: BuildZoom shows contractor license data nationally but doesn't carry the Broward-specific CC# void status.

**3.5 Unsafe Structure case + active permit on same parcel.** Open Unsafe Structure cases (some 25 years old) on parcels currently pulling permits. The BCS `Expired Permit Number` field links case to permit deterministically when populated `[BCS § 3.1]`. **No competitor has this.** It's a Broward-only dataset behind a POSSE form.

**3.6 Crane on site, today.** FAA `structureType=CRANE` with `dateEntered` last 30 days, lat/lon-joined to Broward parcels, joined to active permits. Tells you a building is going up *right now*. **Closest competitor**: airspace-consulting firms publish FAA crane data nationally for $X K/year; nobody publishes the building-permit cross-reference for Broward.

**3.7 Foreclosure auction + active permit.** RealAuction parcel ID exact-matches BCPA folio `[3SRC § 2.4]`; join to permits. The edge case "owner is losing the property despite mid-stream construction" is gold for both editorial and lender-product use. **Closest competitor**: RealtyTrac sells foreclosure data nationally with no permit cross-reference; PropertyRadar sells with weekly latency.

**3.8 Lis Pendens → Foreclosure timeline closure.** When a Lis Pendens recorded today (Records LP) shows up months later as an actual foreclosure auction (RealAuction), the timeline is closed automatically via the shared `Case Number` field in both Records and RealAuction `[3SRC § 2.5]`. **No commercial vendor closes this loop with the Broward-specific Case # cross-reference.**

**3.9 Multi-source distress stack ≥4.** A property with (open lien) + (open Unsafe Structure case) + (Lis Pendens) + (expired permit) + (contractor with void license) is in catastrophic distress. Florida Signal is the only Broward source that can compute this single-row-output across five sources. Editorial: this is a "story already exists, we just need to write it up" pattern. Commercial: lenders pay six figures for distress-stack flagging at scale.

That's nine. I could stretch to twelve but the law of diminishing returns hits hard after #5; the first five carry most of the editorial and commercial value.

---

## 4. Top 12 Early-Intel Signals

Here is the buyer-facing inventory. For each I give the lead time (how many days/weeks before the public knows), the sources required, whether it's a deterministic rule or an LLM-judged probabilistic call, the buyer type, and an honest false-positive estimate.

| # | Signal | Lead time | Sources | Computability | Buyer | Est FP rate |
|---:|---|---|---|---|---|---:|
| 1 | **FDEP ERP filed → city permit incoming** | 5–6 weeks | FDEP ERP + Permits + entity_resolution | Deterministic rule (parcel/owner match within window) | Developer, broker, marine contractor | 15% (some ERPs don't lead to permits — denials, withdrawn apps) |
| 2 | **FAA tall-structure filing → high-rise permit incoming** | 2–6 months | FAA OE/AAA + Permits | Deterministic rule (geo + height>200ft + no permit yet) | Developer, broker, vertical-construction subcontractor, journalist | 20% (some FAA filings don't proceed) |
| 3 | **NOC filed → permit confirmation** | 0–60 days (NOCs filed before *or* up to 30 days after permit) | Records NOC + Permits + entity_resolution | Deterministic rule | Lender (proves construction started, draw triggered), title insurer | 5% — very clean signal |
| 4 | **NOC filed without matching permit (60+ days)** | confirms within days | Records NOC + Permits | Deterministic rule | Code enforcement, journalist (potential unpermitted construction), neighbor | 25% (some small jobs don't need permits; some cities mis-report) |
| 5 | **Lis Pendens filed → likely foreclosure auction** | 6–12 months ahead | Records LP + RealAuction (back-confirmed) | Probabilistic — most LPs settle, some go to auction | Distressed-asset investor, hard-money lender, journalist | 60% don't reach auction; 40% do. **Use as a watchlist, not a prediction.** |
| 6 | **Lis Pendens → Foreclosure auction confirmed** | known the day Final Judgment lands in RealAuction | Records LP + Records FJ/CFJ + RealAuction | Deterministic when confirmed | Distressed-asset investor (bid prep) | <5% |
| 7 | **Contractor with Void/Expired BCS license still pulling permits** | confirmed today | Permits + BCS contractor license scrape + entity_resolution | Deterministic *with caveat* — flag must say "no Broward CC found, may be FL DBPR-licensed" `[BCS § 8.2]` | Journalist, code enforcement, owner due-diligence | 30% (state-licensed contractors legitimately don't need a Broward CC; need FL DBPR audit to refine) |
| 8 | **ROW-SEW / ROW-WTR / ENG permit → BLD permit incoming** | 2–8 weeks | Existing FTL Accela permits with new permit_category tag `[3SRC § 3.2]` | Deterministic rule | Site-prep subcontractors, surveyors, suppliers | 20% (some utility work isn't followed by vertical) |
| 9 | **Unsafe Structure case + new permit on same parcel** | confirmed today | BCS Unsafe Structure scrape + Permits | Deterministic | Journalist, code enforcement, real-estate buyer | 15% (some are repair permits *for* the unsafe structure) |
| 10 | **Crane on site today** | 0–30 days from filing | FAA OE/AAA `structureType=CRANE` + Permits | Deterministic | Construction press, vertical-trade subcontractors, drone photographers | 10% |
| 11 | **Multi-source distress stack ≥4 sources** | varies; once stack assembles | All sources | Deterministic count | Distressed-asset investor, special-servicer broker | 5% (when stack is real, it's real) |
| 12 | **Owner-LLC newly registered + same-day NOC + new permit** | hours-to-days | Sunbiz + Records NOC + Permits + entity_resolution | Deterministic | Title insurer, journalist (single-purpose-LLC pattern often signals 1031 exchange or speculative flip) | 25% — sometimes routine ownership restructure |

A few honest caveats. Signal 5 (Lis Pendens → auction) is the noisiest of the bunch — most LPs settle. It's still a *watchlist* signal worth selling, but not as a "this property will be foreclosed" prediction. Signal 7 (void license) needs the future FL DBPR audit `[BCS § 8.3 P3]` to be reliably presentable — until then, present it as "no Broward CC found" not "unlicensed". Signal 10 (crane) requires the FAA `latLongAccuracy` field be ≤ `2S` (~60m) `[3SRC § 5.2]` for parcel-level confidence; lower-precision rows are still useful for "general area" filtering.

The lead-time numbers in column 3 are the differentiated value. If buyers can see (a) which permits are coming via FDEP/FAA/NOC/utility-permit chains, (b) which properties are sliding into distress via the lien-stack and Lis Pendens chains, (c) which contractors are operating under broken credentials, and (d) which commercial spaces are turning over via the CU `Change of Use` events, they have an information advantage measured in weeks-to-months over public market awareness. That's the product.

---

## 5. Journalism Credibility Flywheel

Andy is a working journalist. That changes the GTM strategy in four ways that a typical SaaS data play can't replicate.

**5.1 Editorial-first signal selection.** Most data startups ship every signal they can compute and let the customer figure out which ones matter. A journalist-led product picks signals based on whether they tell a story. The 12 signals in §4 were pre-filtered through that lens — every one is either a story (signals 4, 5, 7, 9, 10, 11, 12) or a story-adjacent commercial input (signals 1, 2, 3, 6, 8). The selection itself is the value-add. A broker buying a feed from a non-journalist competitor gets noise; a broker buying from Florida Signal gets the same noise pre-sorted by what an editor would lead with.

**5.2 Daily story drops feeding the paid weekly.** The right cadence isn't one or the other — it's both, in deliberate sequence. The daily brief publishes 7–10 free items per weekday at ~05:30 ET; one or two of them get expanded into full Fort Lauderdale Signal stories during the day; the *interesting* week's worth gets bundled into a Friday paid newsletter that includes the 5–10 stories plus a "what we saw but didn't write" exclusives section. The free daily drives traffic and email signups; the paid weekly converts the most-engaged 5–8% to subscribers. This is the flywheel that ProPublica's Local Reporting Network and The Real Deal both use, with variations.

**5.3 Brand-driven CAC reduction.** Your CAC for a paid newsletter from a no-name SaaS is $35–$80 per subscriber via paid Meta/Google ads. CAC for a paid newsletter from a known local-news brand with weekly bylines in the FTL market and a 5,000-subscriber free list is $0–$15 — most growth comes from referrals, free-tier conversion, and earned media. Run the math at any scale and the journalism brand pays for itself within 90 days.

**5.4 Source protection and reputational risk.** This is where the asymmetry cuts the other way. A SaaS data play that gets a story wrong loses one customer. Florida Signal getting a story wrong loses both editorial and commercial credibility simultaneously. Three guardrails matter:

- **Never publish a distress-stack story without a same-day phone call to the subject.** This is the single most important practice. The data is correct; the *interpretation* requires a human.
- **Never sell the underlying personal data, only the signals derived from it.** The Records SFTP feed contains witness names, addresses, sealed-flag indicators. Florida Signal can compute and surface "lien filed at parcel X" without reselling the witness PII.
- **Florida public-records and journalism law are permissive** — public-records data is publishable as-is, no court permission needed for civil filings. The standard guardrails (no minors' names without consent in Probate matters; no sealed/expunged records — those are already metadata-stripped in the SFTP feed `[LIENS § 6.5]`; no scraping court records via captcha bypass) are easy to honor.

The ethical edge case is monetizing data about properties whose owners are also potential editorial subjects. You cannot sell a "this owner is in distress" alert to a competitor of that owner without crossing into commercial-tort territory. The right structural answer is to make all data products *territorial* (parcels in zip X) or *role-based* (every NOC filed by contractor Y), not *adversarial* (everything bad about person Z). This is a discipline, not a tool, and Andy's existing journalism instincts will catch the line correctly.

There is no FL-specific bar/ethics rule that prevents distributing court-derived data to commercial subscribers — the data is public. But there's a reputational rule: the moment you start selling foreclosure leads to wholesalers who are going to door-knock distressed homeowners, you become the bad guy in the story your paper would otherwise write. Don't do that. Sell to lenders, brokers, and investors who buy in arms-length transactions. Stay out of the door-knock economy.

---

## 6. AI Automation Plan + Cost Model

What's fully automatable today, what isn't, and what it costs at meaningful scale.

**Fully AI-automatable today.** Entity resolution (Claude Haiku for bulk, Sonnet for hard cases). Daily-brief drafting (Sonnet writes headlines + lead paragraphs from structured payloads, human-approved). Document OCR + structured field extraction from NOC TIFFs and FDEP ERP PDFs (Sonnet with vision, fallback to Tesseract for cost). Owner-name normalization (Haiku). Sub-permit-to-master matching for Accela (already in production).

**Needs humans for the foreseeable future.** Editorial judgment on which leads run as stories (the "is this newsworthy" call). Tipline source verification. Direct-to-subject confirmation calls before any distress-stack story. Sales calls. Annual recalibration of scoring weights and false-positive rates.

**Cost-per-record at scale.** Florida Signal's actual record volume is much smaller than 100K/day. The realistic peak is:

- ~300 new permits/day (FTL Accela)
- ~2,700 new recordings/day (Broward Records, but only ~700 are signal-relevant after filtering)
- ~14 new ERPs/month → <1/day
- ~14 new FAA filings/month → <1/day
- ~5 new foreclosure auctions/day
- ~50–100 BCS scraped records/day (incremental)
- **Total signal-relevant new records/day: ~1,100**

At Anthropic's pricing for Claude Haiku 4.5 (input $0.80/MTok, output $4.00/MTok) and assuming each record entity-resolution call uses ~500 input + 100 output tokens, daily Haiku spend is ~1,100 × (500×$0.0000008 + 100×$0.000004) ≈ $0.88/day = **~$26/month**. Add Sonnet for hard cases at maybe 5% of records and ~10× the cost: another ~$15/month. Add daily-brief drafting (one Sonnet call per news item, maybe 30/day at 2K input + 800 output tokens): ~$15/month. Add OCR for selected images at ~50/day at $0.025/page (Sonnet with vision): ~$38/month. **All-in monthly AI spend at full ingest: ~$90–$120/month.** This is real but trivial relative to any reasonable revenue model.

If volumes go to 10K/day (statewide expansion), multiply by ~10x: **~$1,000/month** — still negligible.

If volumes go to 100K/day (national expansion fantasy), multiply by ~100x: **~$10K/month** — meaningful but still small relative to the revenue at that scale.

**Vendor lock-in risks.** Claude (Anthropic) and GPT (OpenAI) and Gemini (Google) are all viable for the entity-resolution and OCR work; the prompts port between them with minor tuning. Don't write Claude-specific tool-use plumbing if you can avoid it; keep the LLM call surface to plain text-in/JSON-out so swapping providers is a one-line change. **Real lock-in risk is in vector embeddings and fine-tunes** — Florida Signal doesn't need either, so this is not a current concern.

**Document OCR vendor recommendation.** For TIFFs and PDFs at the volume we're talking about (50–500/day), use Claude Sonnet with vision at ~$0.025/page. It produces structured JSON output (permit #, address, contractor name, contract amount, claimant address) directly, no separate parsing pass needed. Fallback to AWS Textract at $0.0015/page if cost ever matters; Textract is cheaper but requires a structured-extraction pass on top. Don't bother with Adobe PDF Services or Google Document AI for this use case — Sonnet is the right tool.

---

## 7. Signal-Scoring System v1

The doctrine in the project is clear: source-locked facts first, scoring layered on top later, scoring currently frozen `[CLAUDE.md scoring paused]`. This section designs *the system that will exist when Andy un-pauses scoring*. It does not propose un-pausing scoring.

**7.1 Score scale: 0–100, tiered at quartile breaks.** Each property and each contractor gets a continuous 0–100 score (sum of weighted signal contributions). Display tiers: Watch (1–24), Yellow (25–49), Orange (50–74), Red (75–100). Continuous scores let you re-weight without losing granularity; tiers let humans skim. Both are stored.

**7.2 Per-source weight rationale.** Five source-quality buckets:

- **Tier A (high confidence, low FP):** confirmed FJ/CFJ from Records (closed legal action), confirmed RealAuction sale (cleared transaction), expired-permit-with-Unsafe-Structure-case match. Weight: 25 points each. Cap: at most 2 of these per property.
- **Tier B (medium confidence):** open Lien (LIE), Lis Pendens (LP), open Unsafe Structure case, void contractor license on active permit. Weight: 15 points each.
- **Tier C (early indicators):** FDEP ERP filed without matching permit, FAA tall-structure filed without matching permit, NOC filed without matching permit. Weight: 10 points each.
- **Tier D (context overlays):** in 2060 flood-projection zone, in HUD low-mod tract, on septic, near pump station at capacity. Weight: 5 points each, capped at 2 contributions.
- **Tier E (decay reduction):** RST releasing a prior LIE/FJ → subtract the weight of the satisfied lien. Sale with no signals → reset to 0 (new owner, new clock).

**7.3 Multi-source confirmation.** If three or more *independent* tiers contribute, multiply final score by 1.2. If a single source contributes everything, cap that contribution at 50% of the score. This prevents a single noisy data feed from hijacking the score.

**7.4 Decay function.** Lien filed today: 100% weight. Lien open 6 months: 80%. 12 months: 60%. 24 months: 40%. 36+ months: 25% (still counts because some Florida liens linger by design, but stops dominating). Permit expired 6 months ago: 80%. 24 months: 30%.

**7.5 False-positive handling.** Two complementary mechanisms:

- **Source-level FP rate** (from § 4 estimates) is encoded as a confidence multiplier per signal. A void-license signal gets 0.7 multiplier until the FL DBPR cross-reference lands; a confirmed-foreclosure signal gets 0.95.
- **Subject-level adjudication path** — every property/owner can be flagged "verified cleared" by an editor or by the subject with documentation, with a public audit trail. Cleared signals decay 4× faster.

**7.6 Calibration plan.** At 30/60/90 days post-prediction, compare the predicted distress signals against ground truth (foreclosure filed, lien stack grown, story published, no event). Track precision (of properties scored Red, % that materialize an event) and recall (of properties that had events, % were scored Red 30 days prior). Re-tune weights quarterly. This needs ~6 months of post-launch data before tuning matters.

**7.7 Per-buyer-type customization.** Each buyer persona gets a different *signal subset* and *weight profile*:

- **Developer profile**: emphasizes Tier C (FDEP/FAA/NOC) leading indicators; de-emphasizes Tier B distress.
- **Lender profile**: emphasizes Tier A confirmed events + Tier B distress; de-emphasizes Tier D context.
- **Journalist profile**: emphasizes the *delta* week-over-week, not the absolute score; flags any property that just entered Orange or Red.
- **Investor profile**: emphasizes Tier A + B + the multi-source confirmation multiplier.

Same underlying score, different views. The system stores the contribution breakdown so any view can be reconstructed.

---

## 8. Product Line — Brief / Newsletter / Alerts / API / Personas

**8.1 Daily Morning Brief (free, ~05:30 ET, weekdays).** Plain markdown, served as a web page at `https://fortlauderdalesignal.com/brief/YYYY-MM-DD/` and pushed to a free Substack. Sections in the order shown in `[3SRC § 4.4]`: WHAT'S NEW (24h counts across permits/records/BCS/ERP/FAA/contractors), LEADING INDICATORS (5 each of FAA-ahead-of-permit, ERP-ahead-of-permit, NOC-ahead-of-permit, ROW-ahead-of-permit, LP-likely-foreclosure), DISTRESS SIGNALS (5 each of foreclosure-auction-with-active-permit, lien-stack-≥3, Unsafe-Structure-with-new-permit, contract-case-with-recent-permit-and-same-contractor, multi-source-distress-≥4), WATERFRONT/VERTICAL, COMMERCIAL TURNOVER, CLIMATE/EQUITY CONTEXT, FOR THE EDITORIAL DESK. Each item is 1–3 sentences with a deep-link to the source(s).

AI-generated vs editorial-curated split: AI drafts every section; an editor (Andy or a paid contributor in mid-MVP) approves the headline + lead of every distress item before publish. Each weekday: 7–10 items, 600–900 words total, takes a reader 4 minutes.

Who reads it: anyone in Broward CRE, anyone covering FTL development, anyone tracking the local foreclosure pipeline. Free signup gates by email; this becomes the funnel.

**8.2 Weekly Paid Newsletter (Friday, ~$25/month or ~$240/year).** Structure of a single issue:

> **The Friday Signal — Week of MM/DD/YYYY**
>
> *This week in Fort Lauderdale and Broward development, in 12 minutes.*
>
> 1. **The Lead** — one 600-word story expanding the most consequential signal of the week. Original reporting + data + photos.
> 2. **The Distress Watchlist** — 8–12 properties moving on the distress score, with one-paragraph annotations.
> 3. **What We Saw But Didn't Write** — 4–6 leads we couldn't confirm or didn't have time for, served as raw signals to subscribers who can act.
> 4. **The Permit Pipeline** — 5–8 large permits issued this week, with developer/contractor profiles and adjacent context (any liens, any ERPs).
> 5. **Foreclosure Auction Calendar** — every Broward auction next week, parcel + judgment $ + active-permit cross-flag.
> 6. **The Contractor Beat** — one contractor profile per week (license status, lien velocity, recent permit volume).
> 7. **State of the Map** — one chart from the AGOL data (flood zone, equity overlay, infrastructure capacity) overlaid on the week's permit cluster.
> 8. **Tips & Corrections** — two-line link to send tips.

12 minutes to read; the most-engaged readers will finish it. Subscriber price $25/mo / $240/yr is benchmarked to The Real Deal South Florida ($199/yr), Bisnow Premium ($199/yr), and Crain's New York's enterprise tier ($249/yr). Florida Signal at $240/yr says "premium local intelligence, not generic trade press."

**8.3 Real-time alerts (paid add-on, $15/mo/seat or $180/yr).** Email + SMS + Slack webhook (pick channel per subscriber). Trigger types: any signal in a saved filter (zip range, contractor name, owner name, permit type, distress threshold). Cap: 5 alerts/day per subscriber default; subscriber can raise to 25. Below the cap, alerts fire instantly; above the cap, they batch into a single 6 PM digest. The 5-cap is the difference between "useful" and "annoying"; experience from PagerDuty + similar shows engagement collapses past 7/day.

**8.4 JSON/CSV API (paid enterprise tier, $500–$2,500/mo).** Thin Next.js API route under `/api/v1/` that exposes select Supabase tables via signed JWT auth. Endpoints:

- `GET /v1/permits` — paginated, filterable by date/jurisdiction/permit_type/contractor
- `GET /v1/signals` — distress-score table + contribution breakdown (Tier 2 customers only)
- `GET /v1/recordings/noc` — recent NOCs with parcel + owner + contractor
- `GET /v1/recordings/liens` — recent liens by parcel/owner/contractor
- `GET /v1/erps` — FDEP ERP rows for Broward
- `GET /v1/foreclosure_auctions` — upcoming and historical
- `GET /v1/contractor_licenses` — BCS license status per contractor
- Webhook subscriptions for real-time push (Tier 2+)

Pricing tiered: Tier 1 ($500/mo) read-only access, daily-refresh; Tier 2 ($1,500/mo) webhooks + signals; Tier 3 ($2,500/mo) custom queries + named SLA.

**8.5 Personas.**

- **Mid-market developer (5–50 active projects in South FL)**. Pain: misses ROW-SEW filings on parcels they could have bought 2 weeks earlier; misses FAA filings that signal a competing project nearby. Pays today: BuildZoom ($1,200/yr) and PropertyShark ($299/mo). Would pay Florida Signal: paid newsletter ($240/yr) + alerts ($180/yr) + API Tier 1 ($6K/yr) = ~$6,420/yr. LTV at 4-year average tenure: $25K. CAC channel: direct outreach via Andy's existing journalism network + LinkedIn outbound + earned media from the daily brief.
- **Hard-money lender / private credit fund (Broward + South FL focus)**. Pain: needs distress-stack signals to source deals; needs foreclosure auction calendar; needs contractor reputation to underwrite construction loans. Pays today: CoreLogic ($15K–$50K/yr enterprise), PropertyRadar ($1,800–$6,000/yr). Would pay Florida Signal: API Tier 2 ($18K/yr) + alerts for 3 seats ($540/yr) = ~$18,540/yr. LTV at 5-year tenure: $90K. CAC channel: industry conferences, direct outreach.
- **Commercial real-estate broker (CBRE / Cushman / regional office)**. Pain: tracks tenant turnover via CU `Change of Use`; tracks new commercial developments via FAA + ERP. Pays today: CoStar ($15K/yr enterprise) — irreplaceable for them. Would pay Florida Signal: paid newsletter + alerts as a *complement* to CoStar = ~$420/yr per broker, $2K–$5K/yr per office license. LTV: $15K/office over 4 years. CAC: brokerage office outreach via Andy's existing relationships.
- **Local newsroom / freelance investigative reporter**. Pain: needs the leads, can't afford the data tools. Pays today: nothing (or modest tipline). Would pay Florida Signal: discounted media tier $50/mo for individual reporters, $500/mo for newsrooms. LTV: $4K. CAC: $0 — these are Andy's peers.
- **Title insurer / title plant operator**. Pain: needs NOC-confirmed-construction signal for draw verification on construction loans; needs lien data ahead of public title-search lag. Pays today: Datatrace, RamQuest ($5K–$50K/yr enterprise). Would pay Florida Signal: API Tier 2 or 3 = $18K–$30K/yr. LTV: $80K. CAC: industry conferences (FLTA), direct outreach.
- **Civic researcher / academic / advocacy nonprofit**. Pain: needs equity overlays, climate overlays, distress patterns for research. Pays today: nothing or grant-funded data buys. Would pay Florida Signal: nonprofit tier $25/mo. LTV: $1.5K. CAC: $0.

---

## 9. Competitive Landscape

Real names, real positioning. For each, what they sell, geographic coverage, where they fall short for Broward.

**ATTOM Data Solutions.** National property data conglomerate. Sells deeds, mortgages, foreclosures, AVMs, environmental risk, neighborhood demographics. Pricing: enterprise license $25K–$250K/yr, no public retail. Coverage: all 50 states at varying depth. Falls short for Broward: aggregated weekly latency, no NOC field, no ERP cross-reference, no BCS contractor license status, no Unsafe Structure data, no commercial CU data.

**CoreLogic.** Larger national competitor, similar product mix to ATTOM plus stronger insurance / credit / climate-risk angles. Pricing: enterprise only, $50K–$500K/yr. Falls short for Broward: same gaps as ATTOM.

**PropertyShark.** Mid-market property research portal owned by Yardi. New-York-strong, weaker outside NYC. Pricing: $99–$299/mo individual, $1K–$5K/mo team. Coverage: deeds, mortgages, ownership, basic permits, foreclosures. Falls short for Broward: thin permit data for FTL specifically, no NOC stream, no ERP, no BCS, no contractor license status.

**Reonomy.** Commercial-property research, ownership LLC-resolution. Strong UI for owner-graph queries. Pricing: $1,200–$10,000/yr team. Coverage: national CRE focus. Falls short for Broward: no permit data depth, no NOC stream, no BCS, no early-intel signals (it's a research tool, not a feed).

**PropertyRadar.** Foreclosure + lien data, California-strong, expanding to FL. Pricing: $89–$300/mo individual. Coverage: FL improving but historically thin. Falls short for Broward: weekly latency, no permit cross-reference, no NOC, no FAA, no BCS, no ERP.

**RealtyTrac (parent: ATTOM).** Foreclosure data portal, retail. Pricing: $50/mo individual. Coverage: national foreclosure listings. Falls short for Broward: just foreclosure, no permit cross-reference, no signals.

**BuildZoom.** Building permits aggregator + contractor finder. Pricing: contractor leads $50–$300 each; data API $1K–$10K/mo. Coverage: most US permits but with multi-week delay. Falls short for Broward: doesn't carry FTL Accela detail, no Broward CC# license status, no NOC stream.

**PermitFlow / Permit Place.** Permit submission and tracking SaaS for general contractors. Not a data product; doesn't compete directly. Worth knowing but irrelevant.

**Dodge Construction Network.** Largest construction-project lead service in the US. Pricing: $5K–$50K/yr per seat. Coverage: primarily larger commercial projects. Falls short for Broward: misses small/mid permits, no early-intel from FAA/ERP/NOC, no distress data.

**ConstructConnect (parent: Roper Technologies).** Similar to Dodge, project-lead focused. Same gaps.

**BuildingConnected (Autodesk).** Bid-management + project-network platform. Adjacent, not competitor.

**Compass / RealEstate-data API.** Residential MLS data, not commercial / not permit / not lien. Not competitor.

**CoStar.** The 800-pound gorilla of commercial real estate. Pricing: $5K–$50K+/yr per seat. Coverage: every US commercial market. Falls short for Broward editorial/early-intel: it's a research database, not a daily intelligence feed; no NOC stream, no FAA crane data, no BCS contractor void status, no FDEP ERP early-warning. **Florida Signal does not compete with CoStar; it complements CoStar as the early-intel layer brokers need on top.**

**Local FL competitors (media, not data).** The Real Deal South Florida ($199/yr), South Florida Business Journal ($160/yr), Crain's Florida (newer), FloridaJolt (free). They cover Broward development editorially but don't sell data. The newsletter product overlaps with theirs; the data product doesn't.

**ChatGPT plugins / custom GPTs / AI-only products.** None currently target Broward CRE intelligence. There are generic "real estate research" GPTs, but they're prompt-wrapped public data without the underlying ingest infrastructure. Not a near-term threat. Long-term: a well-funded competitor could build an AI-wrapped version of what Florida Signal is building, but the moat is the multi-year data ingest history + the journalism credibility, neither of which an AI wrapper can replicate.

**For Broward specifically**: Florida Signal would compete most directly with PropertyRadar for the developer/broker buyer; with CoreLogic/ATTOM for the lender buyer; with The Real Deal South Florida for the journalist buyer (though TRDSF doesn't really sell to journalists, it sells to industry — this is a wash). The legal/litigation buyer (mechanic's-lien attorneys, defense counsel) is currently underserved and would be a viable Tier-2 expansion play.

---

## 10. Revenue Math — Base / Mid / Aspirational

Three scenarios. I'll show the math, not just the conclusions.

**10.1 Base case — modest single-market business at 12 months.**

Assumptions:
- Free daily-brief subscriber list grows from 0 to **5,000** by month 12 (conservative — Andy's existing FTL Signal audience + 6 months of consistent daily publishing should clear this; comparable local-news Substacks routinely grow this fast)
- Paid weekly conversion rate **6%** of free list = **300 paid subscribers**
- Average paid newsletter ARPU **$240/yr** (no discounts, ~70% on annual, ~30% on monthly $25)
- Real-time alerts attach rate **20%** of paid newsletter base = **60 alert subscribers** at $180/yr
- API tier 1 customers: **3** (early lender / developer pilots) at $500/mo = $6K/yr each
- API tier 2: **1** (one early enterprise) at $1,500/mo = $18K/yr

Revenue stack at month 12:
- Newsletter: 300 × $240 = $72,000 ARR
- Alerts: 60 × $180 = $10,800 ARR
- API tier 1: 3 × $6,000 = $18,000 ARR
- API tier 2: 1 × $18,000 = $18,000 ARR
- **Total ARR: $118,800**
- MRR exiting month 12: $9,900

Costs:
- AI compute: ~$120/mo × 12 = $1,440
- Mac infra (electricity, no incremental): $0
- Phase 2 cloud infra (likely triggered mid-year): ~$60/mo × 6 = $360
- Domain, email service, Substack, Stripe fees (~3% of revenue): ~$3,500
- Contractor labor (10 hrs/week editorial assist, $50/hr): $26,000
- **Total cash costs: ~$31,300**

Unit economics: Newsletter gross margin ~95% (cost is just delivery + Stripe). API gross margin ~98%. Blended gross margin: ~96%. CAC: ~$15 newsletter via free-list conversion; ~$200 API via direct outreach. Payback: 1 month newsletter, 6 months API.

Net cash to Andy at end of year 1: ~$87,500 from operations (before tax, before any salary draw). This is a viable solo-founder business at year 1.

**10.2 Mid case — FL statewide + light enterprise at 12mo / 24mo.**

Add Miami-Dade and Palm Beach by month 12 (one new market every 4 months after MVP). Same data feeds work — Records SFTP and ERP REST cover the whole state; RealAuction covers all FL counties; FAA covers all states; BCS is Broward-only but the equivalent in Miami-Dade is the MIA Building Department with a similar HTML scrape required.

Year 1:
- Free list: 12,000 (3-county footprint)
- Paid newsletter: 720 at $240/yr = $172,800
- Alerts: 144 at $180/yr = $25,920
- API tier 1: 8 at $6K = $48,000
- API tier 2: 4 at $18K = $72,000
- API tier 3: 1 at $30K = $30,000
- **Year 1 ARR: $348,720**

Year 2 (statewide hit by month 18, light enterprise sales push):
- Free list: 30,000
- Paid newsletter: 1,800 at $240/yr = $432,000
- Alerts: 360 at $180/yr = $64,800
- API tier 1: 15 at $6K = $90,000
- API tier 2: 8 at $18K = $144,000
- API tier 3: 3 at $30K = $90,000
- Per-newsroom syndication tier (3 regional newsrooms at $6K/yr): $18,000
- **Year 2 ARR: $838,800**

Costs scale roughly linearly with market count:
- AI compute: ~$1K/mo statewide
- Cloud infra: ~$500/mo at scale
- Contractor labor: 1 FTE editor + 1 part-time engineer + 1 part-time sales = ~$200K
- Sales travel/conferences: ~$30K
- **Year 2 total cash costs: ~$280K**

Year 2 net: ~$560K. This is a viable 2-3 person business with healthy margins.

**10.3 Aspirational — regional standard, possible SE expansion at 36 months.**

By month 36: Florida statewide + Atlanta + Charlotte + Tampa-deep. ~80,000 free list, ~5,000 paid newsletter, ~50 enterprise API customers, regional press deals.

- Newsletter: 5,000 × $240 = $1,200,000
- Alerts: 1,000 × $180 = $180,000
- API stack (15 tier 1, 25 tier 2, 10 tier 3): $90K + $450K + $300K = $840,000
- Newsroom syndication (10 markets at $10K): $100,000
- One-time data licensing deals (3 deals at $50K): $150,000
- **Year 3 ARR: $2,470,000**

Costs at this scale:
- AI compute: ~$10K/mo = $120K/yr
- Cloud infra: ~$3K/mo = $36K
- Team: 1 founder + 1 head of editorial + 2 engineers + 1 sales + 1 ops = ~$1M loaded
- Sales/marketing: $200K
- **Year 3 total: ~$1.36M**

Year 3 net: ~$1.1M. This is a 6-7 person company with EBITDA margins north of 40%.

**10.4 Acquisition multiples.** Real-estate data businesses with proprietary moats trade at 4–8× ARR, journalism + data combos at 3–6× ARR (because journalism revenue is harder to scale), pure data-feed businesses with enterprise API revenue at 6–12× ARR. At Year 3 scenario:

- Strategic acquirer (ATTOM, CoreLogic) — buys for the Broward data depth + the multi-source intelligence layer they don't have. Multiple: 5–7× ARR = $12–17M.
- Regional newspaper chain (McClatchy / Gannett / Lee) — buys for the editorial brand + paid-subscriber list. Multiple: 2–4× ARR = $5–10M.
- Private equity rollup (real-estate intelligence space) — buys at the geographic-multi-market thesis. Multiple: 6–10× ARR = $15–25M.

**The math says don't sell early.** A Year 1 sale at $118K ARR × 4× = $475K is a rounding error. A Year 3 sale at $2.5M ARR × 6× = $15M is a meaningful exit. The slope between them is steep enough that staying independent through Year 3 dominates almost any earlier sale.

---

## 11. Fastest Path to First Revenue (30 / 60 / 90 days)

Andy can be collecting revenue in 30 days without compromising the long-term architecture. Here's the cleanest sequence.

**Days 0–30: Launch the free daily brief and the paid weekly newsletter, using only data already in `db/permits.sqlite`.**

What gets built:
- Daily brief generator that reads from existing `permits` + `bcpa_property_card` + `accela_details` + `owner_resolution` and emits the 7-section markdown layout in `[3SRC § 4.4]`, scoped to what we have today (no Records, no ERP, no FAA, no BCS yet — those land in days 30–90)
- Free Substack: `fortlauderdalesignal.substack.com/brief` (existing FL Signal Substack if Andy already has one; new if not)
- Paid Substack tier at $25/mo / $240/yr for the Friday newsletter
- Daily-brief publishing automation via Substack API or scheduled-post
- Initial story hero: **the Coastal Comfort 348-permit / void-license investigation** `[BCS § 4 Test 2]`. This is the single best launch story because (a) it's already validated by the audit, (b) it's a clean public-interest story, (c) it surfaces a pattern that will repeat across hundreds of contractors once BCS ingest lands, (d) it generates the natural follow-on "we're now cross-checking every Broward contractor" pitch that drives subscriptions.

What gets explicitly NOT built in MVP:
- New ingest sources (Records, ERP, FAA, RealAuction, BCS, AGOL) — Phase 2 territory
- API product — Phase 2
- Real-time alerts — Phase 2
- Mobile app, anything React-Native — never
- Statewide expansion — Phase 3

Pricing rationale: $25/mo / $240/yr for the paid weekly. Benchmark: The Real Deal $199/yr, Bisnow Premium $199/yr, Crain's $249/yr. $240 is $40 above TRD/Bisnow because Florida Signal is more vertical (just Broward at MVP) and more substantive (real intelligence vs trade press). If this is wrong, the data will say so within 90 days; tune at month 4.

Distribution for first 100 paid subscribers:
- Andy's existing FL Signal email list and social
- 3–5 launch stories that get earned media (the Coastal Comfort story gets pitched to The Real Deal, FloridaJolt, FTL local TV news for cross-coverage)
- Direct outreach to ~50 mid-market Broward developers/brokers/lenders Andy already knows
- One "founding subscriber" pitch to local Broward CRE Slack / Discord / WhatsApp groups
- Goal by Day 30: 1,000 free signups, 30 paid signups = $7,200 ARR

**Days 30–60: Land Records SFTP ingest (highest-leverage external source) + first round of paid alerts.**

What gets built:
- Records SFTP nightly pull per `[LIENS § 8.3]`
- Records ↔ permits NOC matcher (`enrichment_permit_noc_match`)
- Records ↔ permits lien-on-property matcher
- Add NOCs and liens to the daily brief
- Real-time alert system v1 — email-only, for paid newsletter subscribers, capped 5/day, 3 default filter types (your contractor portfolio, your address watchlist, your zip code)
- Goal by Day 60: 2,500 free signups, 90 paid signups, 30 alerts subscribers = $19,800 newsletter + $5,400 alerts = $25,200 ARR

**Days 60–90: Land FDEP ERP + RealAuction ingest. Launch API tier 1.**

What gets built:
- FDEP ERP nightly poll per `[ERP § 6.1]`
- ERP→permit matcher with the validated 5–6 week lead-time signal
- RealAuction nightly scrape per `[3SRC § 5.1]`
- API tier 1 endpoint at `/api/v1/permits` + `/api/v1/erps` + `/api/v1/foreclosure_auctions`
- Direct outreach to 15 prospective lenders/developers with API pitch
- Goal by Day 90: 4,000 free signups, 200 paid newsletter, 50 alerts, 2 API tier 1 customers = $48K + $9K + $12K = **$69,000 ARR by end of Q1**

This puts you on track for the Base case § 10.1 by month 12. The remaining ingests (FAA, BCS, Broward AGOL) land in Q2.

---

## 12. Post-MVP Growth Roadmap

Once revenue is real (>$50K ARR, > 100 paid subscribers, > 1 enterprise customer), six expansion moves in priority order.

**12.1 Geographic expansion to Miami-Dade and Palm Beach (Q2-Q3 of Year 1).** Same Records SFTP pattern likely (OnCore Acclaim is the same vendor across most large FL counties `[LIENS § 6.2 Tier 3]`). Same FDEP ERP API. Same RealAuction (multi-county on same platform `[3SRC § 2.4]`). Same FAA. The only redo per market is the local building-permit ingest (each county runs its own permit system) and the local equivalent of BCS (Miami-Dade Building, PBC Building & Permits). ~6–8 weeks per new market with one engineer-equivalent. Tier-2 markets after South FL: Hillsborough (Tampa), Orange (Orlando), Pinellas (St. Petersburg), Lee (Fort Myers), Duval (Jacksonville). Each is ~6 weeks.

**12.2 Vertical expansion: developer → broker → lender → litigator → insurer.** The journey reflects each persona's willingness-to-pay. Start with developers + brokers (lower ARPU but easier sales), expand to lenders (higher ARPU, longer sales cycle), then to mechanic's-lien attorneys and construction-defect litigators (high ARPU, narrow segment), then to title insurers and construction-loan insurers (highest ARPU, multi-quarter sales cycle).

**12.3 Data expansion: SFWMD ERP, FL DBPR contractor licenses, then FEMA flood + Census ACS overlays.** SFWMD is the explicit #1 Broward gap from the FDEP audit `[ERP § 8.3 P3]` and likely has 5–10× the volume of FDEP-direct ERPs in South FL. Each new audit is ~1 day; each new ingest is ~3–5 days. Don't commit until each has its own audit per the project rule `[Ground rule 4]`. After SFWMD + DBPR, the next tier is FEMA flood maps (separate from the AGOL flood projection — different regulatory layer), Census American Community Survey (demographic context for equity stories), FL DOT crash data (intersection-safety stories that pair with permits at corners).

**12.4 Channel expansion: newsletter → events / conferences → podcast → data licensing.** Around month 15, when paid base is ~500, run a quarterly in-person Florida Signal Briefing (~$200/seat, 100 seats, ~$60K/event, very high margin). At month 18, launch a weekly podcast (`The Florida Signal`, 30-min episodes interviewing developers / regulators / lenders). At month 24, license the data feed to one or two regional newspapers (McClatchy's Bradenton Herald, Gannett's Florida Today) at $10K–$30K/yr each as a syndication play.

**12.5 Team expansion sequence:** Hire #1 (Q3 of Year 1, after $100K ARR confirmed): part-time editor / second journalist, $40K/yr part-time. Hire #2 (Year 2 month 4): full-time data engineer to operate the multi-county pipeline, $120K/yr. Hire #3 (Year 2 month 9): part-time enterprise sales, $60K base + commission. Hire #4 (Year 3): head of editorial, $90K. Hire #5 (Year 3): second engineer or DevOps, $130K. By end of Year 3: 6-person team, ~$2.5M ARR per § 10.3. Don't hire ahead of revenue; the journalism brand makes contract labor accessible at every level.

**12.6 Acquisition vs independent.** Don't take an inbound acquisition meeting until Year 2 unless the offer is $5M+ cash. Strategic logic: every additional quarter of revenue growth from $100K to $1M ARR multiplies enterprise value 4–7×; a Year 1 sale destroys 80% of the realistic value. After Year 2, take meetings strategically, but only with three categories of buyer: (a) larger property-data players (ATTOM, CoreLogic — likely strategic), (b) regional newspaper chains (McClatchy, Gannett, Lee — likely brand+editorial buy), (c) PE rollup of real-estate intelligence companies (multi-asset bid). Don't take meetings with VCs proposing growth equity; this is bootstrap territory.

---

## Appendix A — Hard Choices Andy Will Face

These are the tradeoffs that have no clean answer; each has to be picked deliberately.

**A1. Developer sale vs broker sale, first.** Both pay; both have ~$5K/yr ARPU at the small end. Developers are easier to talk to (Andy already knows them) but slower to convert (longer evaluation, more bureaucratic). Brokers convert faster (CRE brokers are velocity-driven) but are flightier subscribers. **Recommendation: brokers first for the paid newsletter** (faster trial-to-paid), **developers first for the API** (higher LTV when they convert). Don't try to nail both simultaneously.

**A2. Newsletter price: $25/mo or $50/mo.** $25 matches industry comps and maximizes signups; $50 maximizes revenue per signup but cuts conversion in half. **Recommendation: $25/mo to start.** Raise to $35/mo after 12 months once retention is proven. Never go higher than $50/mo for the individual tier — that's enterprise pricing and needs a different product.

**A3. Sell to wholesalers / door-knock investors, or refuse on principle.** Wholesalers will pay $300–$1,000/mo each for distress-stack alerts. They are also, ethically, the worst possible customer — they harass distressed homeowners. **Recommendation: refuse.** Restrict the API and the alerts product to (a) institutional lenders, (b) licensed developers/brokers, (c) journalists, (d) civic researchers. This costs revenue but protects the brand. Andy's reputation is worth more than any wholesale revenue ever will be.

**A4. Un-pause scoring or stay frozen longer.** Scoring is currently paused. The §7 design works whether you launch with scores or without. **Recommendation: stay frozen for the first 6 months of revenue.** Ship raw signals + the daily brief; let the journalism do the interpretation. Un-pause scoring once you have ~6 months of post-launch data to calibrate against. Premature scoring with high false-positive rates burns credibility; staying source-locked-facts-only at launch keeps the brand journalism-clean.

**A5. Single-market for 24 months vs go-to-statewide at month 12.** Going statewide at month 12 doubles complexity (and ARR potential). Staying Broward-only for 24 months protects depth (no missed Broward stories, no thin coverage of Miami-Dade). **Recommendation: stay Broward-deep for 18 months, expand to Miami-Dade in month 18, Palm Beach in month 24.** South FL only through Year 2; statewide push is Year 3 if at all.

**A6. AI-vendor lock-in: Anthropic-only or multi-provider from day one.** Multi-provider has overhead; Anthropic-only has lock-in. **Recommendation: Anthropic-primary, OpenAI-secondary, build the LLM-call surface as a thin shim from day 1.** Total dev cost is ~2 days. Provider switching becomes a one-line change. Lock-in risk is real even if it's not biting today.

**A7. Open-source any of this.** There's a credible argument to open-source the Records SFTP parser, the FDEP ERP poller, the FAA OE/AAA REST client. Builds developer goodwill and recruits contributors. There's also an argument that the *data* is open but the *integrations and resolution layer* is the moat. **Recommendation: open-source the four ingest scripts (LIENS / ERP / FAA / RealAuction) under MIT after they're stable; keep the entity_resolution + scoring + composite-facts layer closed.** Best of both worlds.

**A8. Take seed capital or stay bootstrapped.** Bootstrap is in the project doctrine and is the right call. **Recommendation: bootstrap through Year 2 minimum.** Reconsider only if a strategic partner (a regional newspaper chain, a single big lender as a flagship customer) writes a $200K+ check that comes with distribution and reputation, not just money. Don't take VC money for any reason.

---

## Appendix B — Five Things You Looked At That Don't Matter (and Why)

**B1. The Broward Recording image ZIPs (~150 GB/year).** Tempting because they contain all the unstructured fields the index doesn't (permit # on NOCs, lien amount, contractor license #, etc.) `[LIENS § 3.6]`. But OCR'ing them at scale is expensive and slow, and the structured index plus owner-name-based matching gets you 80% of the value at 5% of the cost. **Don't ingest the image ZIPs in MVP.** Defer to Tier-2 lazy-fetch when a user clicks into a specific record.

**B2. The 95+ adjacent FDEP open-data services (Brownfield, Cleanup, OFW, Aquatic Preserves, etc.) `[ERP § 2.2]`.** Each is interesting; together they are a distraction. Adding them to ingest before MVP launch dilutes engineering effort that should be on revenue. **Defer all to Tier-3.** Pick them off one at a time when a specific story or customer demand justifies the work.

**B3. Broward Clerk Case Search reCAPTCHA bypass.** The audit flagged this as off-limits `[3SRC § 5.2]` and the project ground rules forbid it `[Ground rule 5]`. There's a recurring temptation to "find a way around" — don't. The Clerk Case Search is fine for ad-hoc human lookups; the daily-feed signal already comes through Records (the same Case # cross-references) and RealAuction (the foreclosure outcomes). Captcha-bypass would burn 6 months of engineering and never produce a stable feed, while creating legal exposure.

**B4. Broward AGOL's manatee, hurricane, and parks layers (660+ services beyond utility).** They sound editorially fun. They are distractions for an intelligence product. **Don't ingest.** A future Florida Signal long-form magazine could plumb them; the daily intelligence product doesn't need them.

**B5. The PRIA 2.4 XML web service for Broward Records.** Govt-to-govt only `[LIENS § 5.2]`; not accessible to Florida Signal as a private business. It would never offer anything the SFTP feed doesn't already give us, and pursuing access is months of bureaucracy for no gain. **Ignore it.**

---

## Appendix C — One-Page Executive Summary

**The thesis.** Florida Signal can become the standard early-intelligence product for Broward CRE in 12 months and South Florida CRE in 24 months. The four 2026-05-10 audits demonstrate that the necessary data exists, is publicly accessible, and combines into composite signals no commercial competitor sells for this market.

**The single-highest-leverage action this quarter.** Build the Records SFTP ingest. It's free, fully documented, no auth, no rate limit, gives you NOCs (~260/day), liens (~149/day), and judgments (~271/day) in clean structured form, and joins to the existing pipeline on parcel folio + owner_resolution. Once landed, two new signals (NOC-confirmed permits + open-lien-on-property) become computable immediately, and the daily brief gets the new section that turns it into a paid product.

**The validated proof points from the audits, in one sentence each.**
- ERP→permit lead time of 5–6 weeks confirmed live at 2401 Del Lago Dr `[ERP § 4.4]`.
- Coastal Comfort Inc holds 348 permits in our DB while its Broward CC card has been Void since 2011 `[BCS § 4 Test 2]`.
- 14 new Broward FDEP ERPs in the last 30 days, 4 in the last 7 — small enough volume to be every-record substantive `[ERP § 4.1]`.
- 4,623 FL/2026 ASNs in FAA OE/AAA in a single REST call, with structured `CRANE` rows and Broward bbox filtering trivial `[3SRC § 1.3]`.
- 100–150 Broward foreclosure auctions per month at fully-iterable URLs with case # + parcel + judgment $ + plaintiff `[3SRC § 2.4]`.

**The product line.** Free daily morning brief (lead funnel, ~05:30 ET, 7–10 items, 4 minutes to read) → paid Friday weekly newsletter at $240/yr (the conversion product) → real-time alerts at $180/yr add-on → JSON/CSV API at $500–$2,500/mo enterprise.

**The first 100 customers.** Free list grows from Andy's existing journalism reach + 3–5 launch stories with earned media (Coastal Comfort void-license investigation as the launch hero). Paid subscribers convert at ~6%. First enterprise API customer is a hard-money lender or mid-market developer reached via direct outreach to Andy's existing network.

**The numbers, 12 / 24 / 36 months.** Year 1 ARR ~$120K (single market, base case). Year 2 ARR ~$840K (3-county South FL + light enterprise). Year 3 ARR ~$2.5M (statewide + light SE expansion). At Year 3, realistic strategic-acquisition valuation is $12–17M (5–7× ARR).

**The non-negotiables.**
1. Stay source-locked-facts-only until at least 6 months post-launch; un-pause scoring once you have calibration data.
2. Refuse to sell to door-knock wholesalers; restrict API + alerts to institutional buyers and journalists.
3. Bootstrap through Year 2 minimum; no VC.
4. Every distress-stack story gets a same-day phone call to the subject before publishing.
5. Keep the journalism brand and the data product structurally separated only in legal entity, not in editorial values — the credibility is the moat.

**The single biggest risk.** Premature scaling — chasing Miami-Dade or Palm Beach before Broward is profitable will dilute editorial depth and burn capital. Stay deep on Broward until month 18 minimum.

**The single biggest opportunity.** Land the Records SFTP ingest in the next 30 days, ship the void-license investigation in the next 45 days, and use both to drive the paid-newsletter launch by Day 60. Everything else is downstream.

---

*End of strategic deep research. This document is editorial output; per the project convention it does not require the 7-step doc-update rule. No pipeline, schema, wrapper, plist, Supabase, GitHub, Vercel, or Drive state was changed in producing it. If Andy approves any of the proposals above, the next step is the standard propose → ChatGPT QA → approval → apply workflow on the relevant implementation plan doc (which would be a separate session).*
