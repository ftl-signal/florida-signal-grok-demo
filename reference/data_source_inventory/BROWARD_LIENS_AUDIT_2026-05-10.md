# Broward County Records, Taxes & Treasury — Lien & Records Audit

*Auditor: Claude (read-only research). Date: 2026-05-10. Site audited: https://www.broward.org/RecordsTaxesTreasury — interactive search at https://officialrecords.broward.org/AcclaimWeb — bulk feed at sftp://bcftp.broward.org. This is a research output. Per the project's editorial-output convention it does not trigger the 7-step doc-update rule.*

---

## 1. Executive Summary

Broward County publishes **the entire Official Records index — including every lien, NOC, mortgage, deed, and judgment recorded against Broward property — to a public, free, no-registration SFTP server (`bcftp.broward.org`, user `crpublic` / pass `crpublic`)**. Each business day produces ~2,500–2,700 records across six pipe-delimited text files plus a ZIP of the actual document images (~370–510 MB/day total, ~600 KB/day if you skip the images). Records run **1978 → present**, with annual consolidated archives for every calendar year sitting in the same SFTP folder.

For Florida Signal's permit pipeline this is **unambiguously the highest-leverage external dataset we have not yet integrated**. Notice of Commencement (NOC) records — filed under FS 713.13 before any non-trivial Broward permit can pass first inspection — flow through this feed at ~260 per day with clean owner + contractor name fields and a parcel-ID format identical to BCPA folio. Liens (LIE), Lis Pendens (LP), Final Judgments (FJ/CFJ), and Releases (RST) flow at ~1,500/day combined. The result is two new high-confidence signals: (a) **NOC-to-permit confirmation** ("did construction actually start?") and (b) **distress liens against permitted properties** ("is this owner/contractor in trouble?"). Both can ride directly on existing Florida Signal joins (folio + owner_name + contractor_name).

**Top recommendation: use the SFTP nightly pull as the primary feed; add a free RNS subscription per parcel as an instant-alert overlay; treat the AcclaimWeb interactive search as ad-hoc lookup only (it is rate-limited / Cloudflare-protected and unsuitable for automation).**

---

## 2. Daily Download Options

### 2.1 Public SFTP — primary daily feed (FREE)

| Field | Value |
|---|---|
| Host | `bcftp.broward.org` |
| Protocol / Port | SFTP (SSH-2.0, RebexSSH server) / 22 |
| Username / Password | `crpublic` / `crpublic` |
| Folder for daily files | `/Official_Records_Download/` |
| Folder for annual archive | `/OR_Yearly_Exports/` (CY1978 → CY2025) |
| Folder for plat / map archive | `/OR_Yearly_Exports/PLATSMAPS*` |
| Retention (daily folder) | 10 most-recent fully QA'd business days |
| Posting cadence | Next business day after recording, around 10:30 ET (sample timestamps: 04-30 file dropped 05-01 10:28; 05-06 file dropped 05-08 10:28) |
| QA lag | Currently shows "Released through date: 05/06/2026" as of 05/10 morning — **3–4 calendar-day lag end-to-end** |
| Cost | **$0** |
| Registration | None |
| Rate limit | None observed in standard library / sftp behaviour |
| Auth method | Plain password (the credential is documented publicly on Broward's site — treat as an "anonymous" account, not a secret) |

### 2.2 Six file types per business day

For business day `MM-DD-YYYY` you get six files, each named with that date prefix:

| File | Records (sample 05-06-2026) | Size | Format | Contents |
|---|---:|---:|---|---|
| `MM-DD-YYYYdoc-ver.txt` | 2,697 | 228 KB | Pipe-delimited UTF-8 text | One row per recorded instrument — the master index |
| `MM-DD-YYYYnme-ver.txt` | ~6,500 | 262 KB | Pipe-delimited | Multiple rows per doc — every party indexed (Direct = Grantor/From, Reverse = Grantee/To) |
| `MM-DD-YYYYlgl-ver.txt` | ~360 | 34 KB | Pipe-delimited | Multiple rows per doc — legal description + parcel ID (only for conveyance docs) |
| `MM-DD-YYYYlnk-ver.txt` | ~1,000 | 45 KB | Pipe-delimited | Cross-references — links a Release to its prior Mortgage, etc. |
| `MM-DD-YYYYdoc-ver-rng.txt` | 2 | 22 B | Two lines | First and last instrument number for the day (sanity check) |
| `MM-DD-YYYYimg.zip` | ~5,000 TIFFs | **428 MB** | ZIP of single-page TIFFs | The actual scanned document images, named `<instrument>.<page>.tif` |

**The five text files together are ~600 KB/day** — trivial to ingest. The image ZIP is the big one (~400–500 MB/day, ~150 GB/year). You can ingest indexes only and lazy-fetch images on demand.

### 2.3 Schema cheat-sheet (parsed from `ExportFilesLayout.pdf` and verified against live data)

`doc-ver.txt` columns (pipe-delimited):

| # | Field | Notes |
|---:|---|---|
| 1 | Instrument Number | 9 digits, the primary key |
| 2 | Record Date YYYYMMDD | Always present |
| 3 | Record Date MM/DD/YYYY | Always present |
| 4 | Record Time HHMMSS | 12-hour format |
| 5 | Doc Type Code | See § 3.2 below |
| 6 | Consideration Amount | 0.00 if none |
| 7 | Book Number | Always 0 in modern records |
| 8 | Page Number | Always 0 in modern records |
| 9 | Book Type | O (Official), P (Plat), M (Map), R (RoW Map) |
| 10 | Legal Description (first) | 255-char max — empty for most non-conveyance docs |
| 11 | Parcel ID (first) | **12-char alphanumeric — matches BCPA folio format** — `000000000000` if Deed but unavailable |
| 12 | Documentary Tax | Deeds + Mortgages |
| 13 | Intangible Tax | Mortgages |
| 14 | Number of Names | Count of party rows in the nme-ver file |
| 15 | Confidential Flag | 0=public, 1=confidential, 2=sealed, 3=expunged, 4=void |
| 16 | Status | R, I, H, V — **only V (Verified & Released) appears in the public feed** |
| 17 | Re-record Flag | C=corrected, R=re-recorded |
| 18 | Source | E = received electronically (eRecording vendor) |
| 19 | Case Number | Broward Clerk of Court case # — populated for many judgments / lis pendens |

`nme-ver.txt`: Instrument | Party Name (≤150 chars) | Party Type (D=Direct/From, R=Reverse/To) | Name Sequence

`lgl-ver.txt`: Instrument | Legal Description (≤255) | Parcel ID (12)

`lnk-ver.txt`: Instrument | Book# | Page# | BookType | DocType | Prior Instrument | Prior Book# | Prior Page# | Prior BookType | Prior DocType | Keypunch

### 2.4 Historical access — `OR_Yearly_Exports`

48 calendar years (1978 → 2025) of consolidated bulk files, 30–110 MB each:

- `CY<year>doc-rec.txt` — every recorded instrument that year (replaces the daily `doc-ver` for historical bulk loads)
- `CY<year>nme-rec.txt` — every party
- `CY<year>lnk-rec.txt` — cross-references
- `CY<year>lgl-rec.txt` — legal descriptions / parcels (1995-onwards only — earlier years lack this file)
- `PLATSMAPS*` — the plat / map registry as a separate set

Total uncompressed historical archive size: roughly **8 GB of text** for the full 48-year window. **All free, all public, no registration.**

### 2.5 Other daily-access channels

- **AcclaimWeb interactive search** (https://officialrecords.broward.org/AcclaimWeb) — Harris Recording Solutions OnCore Acclaim. Nine search modes (Name, Book/Page, Document Type, Instrument #, Case #, Consideration Amount, Date Recorded, Simple Search, Parcel ID). Useful for ad-hoc lookups, **not suitable for automation** — Cloudflare-protected, throws 503/error pages under headless / scripted access. Records-detail page exposes every field plus a free PDF viewer of the document image. Cart-based purchase of certified electronic copies (PDFs) for records 1978-present.
- **Recording Notification Service (RNS)** — https://officialrecords.broward.org/PublicRecordsNotificationWebModern/Subscribe — free email alerts. Subscribe by **Individual name, Business name, or Parcel Number** (no upper limit observed). Email fires automatically when a doc is recorded against a monitored entity. Note: subscriber email + monitored names are themselves public records under FL law.
- **CET Track** — https://officialrecords.broward.org/CETTrackWeb — Certificate of Title status tracker (foreclosure-sale follow-up only).
- **PRIA 2.4 XML WEBSERVICE** — used by eRecording vendors to *submit* docs into the Official Records. Same WEBSERVICE accepts retrieval if you contract directly through Harris Recording Solutions; this is a govt-to-govt path, not a public API.
- **CD purchases** — $20/day CD of scanned images, $30 for a CD of index data. Replaced for most use cases by the free SFTP feed but still offered.

---

## 3. Complete Data Fields Available

### 3.1 Per-instrument (master index) fields

From `doc-ver.txt` — all 19 fields enumerated in § 2.3 above. Live samples I pulled from the 05/06/2026 file:

```
[NOC]  120849990 | 20260506 | 05/06/2026 | 083545 | NOC | 0.00 | "" | "" | O | "" | "" | "" | "" | 3 | 0 | V | "" | "" | ""
[LIE]  120850066 | 20260506 | 05/06/2026 | ...    | LIE | 0.00 | ... |   |   | "" | "" | ... | ... | 2 | 0 | V | "" | E  | ""
[CFJ]  120849993 | 20260506 | 05/06/2026 | 085356 | CFJ | 0.00 | ... | ... | O | "" | "" | "" | "" | 2 | 0 | V | "" | "" | COCE-25-020999
[LP]   120850461 | 20260506 | 05/06/2026 | ...    | LP  | 0.00 | "" | "" | O | "" | "" | "" | "" | 4 | 0 | V | "" | E  | CACE-26-007460
[D]    120849997 | 20260506 | 05/06/2026 | ...    | D   | 0.00 | "" | "" | O | "" | 494102BJ0010 | ...
```

### 3.2 Document-type codes (the controlled vocabulary for column 5)

Sourced from `DocumentTypeDescriptions.pdf` and verified against one day's traffic. **Lien-relevant codes are bolded — these are the codes that matter to permit cross-referencing.**

| Code | Description | Daily volume (05/06) |
|---|---|---:|
| ADP | Adoption | — |
| AFF | Affidavit | 137 |
| AGD | Agreement for Deed | — |
| AGR | Agreement | 15 |
| AST | Assignment | 46 |
| CDO | Condominium Documents | 2 |
| CER | Certificate | 2 |
| CET | Certificate of Title (foreclosure outcome) | — |
| **CFJ** | **Certified Final Judgment** | **29** |
| **CJF** | **Certified Judgment — Foreign** | — |
| CMV | Certificate of Compliance Re Sale Motor Vehicle | — |
| **COP** | **Certificate of Payment to Contractor** (FS 713 — releases owner from contractor liability) | — |
| CP | Court Paper | 93 |
| D | Deed (real-property transfer) | 281 |
| DC | Death Certificate | 23 |
| DPR | Domestic Partnership | — |
| EAS | Easement | 13 |
| **FJ** | **Final Judgment** | **271** |
| FS UCC | UCC Financing Statement | 19 |
| GOV | Government Orders / Ordinances / Petitions / Resolutions | — |
| **LIE** | **Lien** (mechanic's, HOA, code-enforcement, etc.) | **149** |
| **LIEN CORP** | **Corporate Lien Warrant Exempt** (state agency liens) | — |
| LNP | Land Patent | — |
| **LP** | **Lis Pendens** (pending lawsuit notice — usually foreclosure) | **22** |
| M | Mortgage / Modifications / Assumptions | 186 |
| M EXEMPT / M INTG EXEMPT | Mortgage tax-exempt variants | — |
| MAP | Miscellaneous Maps | — |
| MIL | Military Discharge | — |
| MOD | Modification | 3 |
| **NCL** | **Notice of Contest of Lien** | — |
| NCP | Notice of Contest of Payment | — |
| NIP | Notice of Interest in Property | — |
| **NOB** | **Notice of Bond** | — |
| **NOC** | **Notice of Commencement** (FS 713.13 — must precede most permits) | **260** |
| NOH | Notice of Homestead | — |
| **NOP** | **Notice of Permit** | — |
| NOT | Notice (general) | 46 |
| NPD | Notice of Preservation of Declaration | — |
| **PCS** | **Public Construction Security** | **2** |
| PLAT / PLAT REL | Plat / Plat Related | — |
| **PR** | **Partial Release** | 7 |
| PRO | Probate | 136 |
| **REL CORP** | **Release of Corporate Lien Warrant Exempt** | — |
| RES | Restrictions | 5 |
| **RST** | **Release / Revoke / Satisfy / Terminate** (mortgages, liens, judgments) | **818** |
| RW MAP | Right-of-Way Maps | — |
| **TBLIE** | **Transfer Lien to Bond** (FS 713.24) | — |
| **TCLIE** | **Transfer Lien to Cash Deposit** | — |
| TSD | Time Share Deed | 38 |
| (suffix X, e.g. FJX, RSTX, MODX, LIEX, CPX) | "X" suffix appears to mark expunged / cross-referenced versions | small |
| VOID | Voided record (metadata deleted) | — |

Document categories surfaced in AcclaimWeb (used for category-level filtering):

- Deeds
- Divorces
- Foreclosures
- IRS liens and docs affecting them
- Lien/Judgement Releases
- Liens/Judgements
- Liens/Judgments and Related Docs
- Military Discharges
- Mortgage Releases
- Mortgages and docs affecting mortgages
- OAMD/OEXP/OSEAL (sealed/expunged/voided)
- Plats
- UCC1 and UCC3
- Wills

### 3.3 Per-party fields (`nme-ver.txt`)

- Instrument Number — links back to the doc row
- Party Name — up to 150 chars (last,first format for individuals; full corporate name for businesses)
- Party Type — `D` = Direct (Grantor / From / Owner-on-NOC / Debtor-on-Lien); `R` = Reverse (Grantee / To / Contractor-on-NOC / Lienholder)
- Name Sequence — multiple parties per side allowed

Live NOC sample (05/06/2026, instrument 120849990, "FIRST CLASS FENCE & RAIL INC" job for the Harveys):

```
120849990 | FIRST CLASS FENCE & RAIL INC | R | 1   ← contractor
120849990 | HARVEY,BRIAN                 | D | 1   ← owner #1
120849990 | HARVEY,JANICE                | D | 2   ← owner #2
```

### 3.4 Per-legal-description fields (`lgl-ver.txt`)

- Instrument Number
- Legal Description (≤255 chars)
- Parcel ID (12 chars — **matches BCPA folio format exactly**)

### 3.5 Cross-reference fields (`lnk-ver.txt`)

11-column file used to chain related instruments — e.g. an RST (Release) row points back to the original M (Mortgage) it satisfies, or a CFJ points back to its FJ. Critical for "is this lien still open?" detection.

Live sample: `120849993 (CFJ) — points back to → 120455451 (FJ)`.

### 3.6 Document images

Every recorded instrument has at least one TIFF page in the same-day `img.zip` (named `<instrument>.<page>.tif`). The TIFFs are scans of the legally executed document and contain all the fields the index doesn't index — most importantly:

- For NOCs: project address, parcel folio, contractor license #, lender/surety name, owner phone, project description
- For Liens: legal description, lien amount, claimant address, last-furnishing date, contract amount
- For Mortgages: maturity date, terms, rider exhibits

The TIFFs can be OCR'd to extract these fields when the structured index columns are blank.

---

## 4. Pricing & Limits

### 4.1 Free public-data access (the path you should use)

| Channel | Cost | Limits |
|---|---|---|
| SFTP daily index files (text) | **$0** | None observed |
| SFTP daily image ZIPs | **$0** | None observed |
| SFTP annual archives 1978–2025 | **$0** | None observed |
| AcclaimWeb interactive search | **$0** to view + free PDF download | Cloudflare-protected, sessions throttled / 503'd under aggressive automated access |
| Recording Notification Service (RNS) | **$0** for unlimited subscriptions | Subscriber identity is itself public record |

### 4.2 Recording fees (cost to *file* a document — affects the supply side, not consumers of the data)

- First page: $10.00; each additional: $8.50
- Indexing >4 names: $1 per extra name
- Plats first page: $30; additional: $15
- Lis Pendens first page: $5; additional: $4
- Notarization: $10 per acknowledgment

### 4.3 Documentary stamp / intangible taxes (visible inside the data)

- Doc Stamp on Deeds: $0.70 per $100 (rounded up)
- Doc Stamp on Mortgages / Notes: $0.35 per $100
- Intangible Tax on Mortgages: 0.002 × principal

### 4.4 Search & Copy fees (cost to consumers — only relevant if you skip the free SFTP feed)

- Per-name-per-year search by staff: $2.00
- Per-page copy (≤8.5×14): $1.00
- Per-page copy (oversize / map / plat): $5.00
- Plat (mylar): $7.50
- Certifying any instrument copy: $2.00
- **CD of one day's scanned images: $20.00** (free via SFTP)
- **CD of index data: $30.00** (free via SFTP)
- Microfilm 16/35 mm 100' roll: $37.50 / $52.50
- Microfiche per fiche: $3.00

### 4.5 Public Records Request fees (Chap 119 statutory)

- First 50 copies (≤8.5×11): free
- Beyond 50: $0.15/page one-sided, $0.20 two-sided
- Certification (non-gov): $1.50
- Clerical assistance: $2.50/quarter-hour after first
- CD of digital sound recording (Commission meetings): $8.00

### 4.6 Value Adjustment Board (VAB) fees

- Petition per folio (late exemption): $15
- Petition for property assessment review: $15 (+$5/contiguous folio)
- CD of public petition data: $30

### 4.7 Credit-card convenience fees (in cart)

- $0.01–$76.66: flat $1.95
- $76.67+: 2.55%

---

## 5. Automation Feasibility

### 5.1 Best automation path: SFTP

A single nightly cron job is sufficient. Pseudocode:

```bash
sftp crpublic@bcftp.broward.org:/Official_Records_Download/
  → mget MM-DD-YYYY*.txt   (all five text files)
  → optionally mget MM-DD-YYYYimg.zip
```

End-to-end in your stack this is one new launchd agent firing at, say, 11:00 ET — by which time that morning's release (typically posted ~10:28 ET) is reliably present. Behaves and feels exactly like Florida Signal's existing nightly Accela / BCPA launchd agents (and, frankly, simpler than any of them since there's no JS / Cloudflare / Playwright in the path).

### 5.2 What works with what

| Component | Automation friendliness |
|---|:--|
| **SFTP feed** | **GREEN** — public credentials, plain SFTP/22, deterministic filenames, deterministic schemas, no rate limiting observed, no JavaScript anywhere |
| **AcclaimWeb interactive search** | RED — Cloudflare in front, AspxErrorPath 503s under scripted access; legitimately fine for ad-hoc human use; not a stable scrape target |
| **RNS email subscriptions** | YELLOW — manual sign-up flow, Constant Contact / Acclaim form, no documented bulk-import. You could sign up programmatically but the email-confirmation step gates it |
| **PRIA 2.4 XML WEBSERVICE** | Restricted — gov-to-gov / contracted-vendor only. Use only if Florida Signal eventually gets a govt MOU |
| **Bulk eRecording vendors** (Simplifile / ICE / CSC etc.) | Available — these are commercial APIs primarily for *submission*, but several offer paid bulk-data subscriptions cross-county. Worth a sales call only if you want **multi-county** coverage in one feed |
| **SharePoint REST API** (`/RecordsTaxesTreasury/_api/web/lists/...`) | Confirmed open anonymous access — but only exposes the CMS lists (FAQ, Service Locations, Quick Links). Not the actual records data |

### 5.3 robots.txt / Terms of Use posture

`https://www.broward.org/robots.txt` — simple disallow on `/_layouts/`, `/_vti_bin/`, `/_catalogs/`. Default `Allow: *` for everything else.

`https://officialrecords.broward.org/robots.txt` — Cloudflare-managed bot policy:

- Default: `Allow: /` with `Content-Signal: search=yes,ai-train=no` (you can index for search, you cannot use the content to train AI)
- **Disallowed by name**: Amazonbot, Applebot-Extended, Bytespider, CCBot, ClaudeBot, CloudflareBrowserRenderingCrawler, GPTBot, Google-Extended, meta-externalagent (i.e., every major AI-training crawler is banned)
- For a non-AI-training data pipeline (which Florida Signal is — we use this data for editorial/business purposes), the policy is permissive

The AcclaimWeb disclaimer (the "I accept the conditions" gate) acknowledges public records, no warranty of accuracy, no liability — standard FL public-records boilerplate.

### 5.4 RSS / webhooks / push

- **RSS feeds**: none.
- **Webhooks**: none for public consumers.
- **Email alerts**: yes — RNS (per-name / per-business / per-parcel). Closest thing to a webhook.
- **Scheduled reports**: only the SFTP feed itself.

### 5.5 Historical bulk load

A one-shot ingest of `OR_Yearly_Exports/CY<year>*.txt` for 1978–2025 gives you the full historical index in one pull. About 8 GB uncompressed text, parses with the same five-file schema (note: only 1995+ has `lgl-rec.txt`).

---

## 6. Integration with Permit Data

**This is the section that matters most for Florida Signal.**

### 6.1 Joinable fields & matching keys (in order of reliability)

| Florida Signal field | Broward Recording feed field | Match type | Reliability | Coverage |
|---|---|---|---|---|
| `permits.contractor_name` | `nme-ver.Party Name` (where Party Type = R, on a NOC) | Exact / fuzzy text | **HIGH** | 100% of NOCs have a contractor row |
| `permits.owner_name` / `bcpa_property_card.owner_name` | `nme-ver.Party Name` (where Party Type = D, on a NOC) | Exact / fuzzy text | **HIGH** | 100% of NOCs have at least one owner row |
| `bcpa_property_card.folio` / `parcels.parcel_id` (12-char alphanumeric, e.g. `494102BJ0010`) | `doc-ver.Parcel ID` (col 11) **and** `lgl-ver.Parcel ID` (col 3) | Exact | **PERFECT format-wise**, but only ~13% population on Broward index records (100% on Deeds, 0% on Liens / NOCs / Mortgages — they live in the document image, not the structured index) |
| `permits.permit_number` | Free-text inside the NOC TIFF / `doc-ver.legal_description` (occasionally) | Substring / OCR | LOW (image) | NOCs reference the building permit # but it lives in the scanned image, not the structured index |
| `permits.address_full` | `lgl-ver.Legal Description` (only on conveyance docs) | Fuzzy substring | LOW–MEDIUM | Broward explicitly states "we do not index legal descriptions and do not have the ability to search by legal description or property address" — so address-based join is fundamentally weak at the index level |
| `enrichment.case_number` (if added) | `doc-ver.Case Number` (col 19) | Exact | HIGH | Populated for FJ / CFJ / LP — links recording to court docket |
| Owner names from `bcpa_property_card` | RNS subscription monitored entity | Webhook-style alert | HIGH | Free, instant notifications |

### 6.2 Recommended enrichment opportunities (ranked by effort / value)

#### Tier 1 — implement first (high value, low effort)

1. **NOC ingest as a new source-locked fact table**: `enrichment_broward_noc(instrument_no, recorded_at, contractor_name_raw, contractor_role_seq, owner_name_raw, owner_role_seq, image_zip_path)`. Populate from daily SFTP `doc-ver` rows where `doc_type='NOC'` plus their joined `nme-ver` rows. Per the project's Expansion-Hardening doctrine: source-locked facts only, no scoring.
2. **Permit ↔ NOC match resolver**: a deterministic, document-able join that:
   - normalizes contractor / owner names (we already have a `owner_resolution` table per the 2026-05-05 mirror landing — extend it to also resolve contractor names)
   - matches a permit issued at time T to the NOC where (contractor_name_norm, owner_name_norm) match and recorded_at is within [T-90d, T+30d]
   - writes `permit_id, noc_instrument_no, match_confidence, match_method` into a new `enrichment_permit_noc_match` table (same shape as `owner_resolution`).
   - ChatGPT QA pass before any code lands.
3. **Lien-stack-against-permit signal (READ-ONLY enrichment fact, not a score)**: ingest LIE / FJ / CFJ / LP / TBLIE / TCLIE rows; cross-reference to permits via owner_name_norm and contractor_name_norm. Output table `enrichment_property_open_liens(folio_or_owner_name_norm, instrument_no, doc_type, recorded_at, debtor_party, lienholder_party, status_open, satisfied_by_instrument_no_if_any)`. The "satisfied_by" comes from the `lnk-ver` cross-reference file.
4. **RNS subscription on the most-active 500–1000 permits monthly**: free email alerts give us instant notification when a recorded-against-property event hits, without polling. Use a dedicated mailbox (e.g. `liens@fortlauderdalesignal.com`) and have an inbound-mail parser drop alerts into a `rns_alerts` table.

#### Tier 2 — implement after Tier 1 stable

5. **Historical backfill**: one-shot pull of `CY1978...CY2025` annual archives → backfill `enrichment_broward_noc` and `enrichment_property_open_liens` for the entire 48-year window. Gives you the full lien history for every Broward property — perfect for "prior distress" fields on enrichment.
6. **Image OCR for selected high-value docs**: lazy-fetch the TIFF from `img.zip`, OCR (project already has Playwright; pivot to Tesseract or a hosted vision model). Extract: permit # off NOCs, lien amount + claimant address off LIE rows, lender + maturity off M rows. Source-locked into a new `enrichment_doc_ocr` table.
7. **Contractor lien-history sidebar**: aggregate by contractor_name_norm — "this contractor has had N liens filed against their projects in the last 12mo" → contractor reputation signal.

#### Tier 3 — optional / strategic

8. **Multi-county expansion**: Broward's stack (OnCore Acclaim by Harris Recording Solutions) is the same vendor used by Miami-Dade, Palm Beach, Hillsborough, Pinellas, Orange, and most large FL counties. The same SFTP / file-layout pattern often exists for them too (with different paths and credentials). A future tri-county Florida Signal version could ingest all three South FL counties with the same code.

### 6.3 Technical integration options (concrete pipeline suggestions)

#### Recommended pipeline architecture (mirrors the existing Florida Signal `0_run_continuous_enrichment` pattern):

```
┌──────────────────────────────────────────────────────────────┐
│ 0_BROWARD_LIENS_NIGHTLY.command   (new launchd at ~11:05 ET) │
│ source .venv/bin/activate                                    │
│ python3 scripts/pull_broward_official_records.py             │
│   → SFTP fetch latest doc-ver + nme-ver + lgl-ver + lnk-ver  │
│   → write raw text to data/broward_or/raw/                   │
│   → idempotent — re-pulls same date are no-ops               │
│ python3 scripts/ingest_broward_official_records.py           │
│   → parse 5 files, upsert into:                              │
│     enrichment_broward_doc                                   │
│     enrichment_broward_party                                 │
│     enrichment_broward_legal                                 │
│     enrichment_broward_link                                  │
│   → uses writer_lock (per Expansion-Hardening doctrine)      │
│ python3 scripts/match_permits_to_nocs.py --report-only       │
│   → produce candidate matches; mutation requires --fix       │
│ scripts/quality_checks.py --severity warn                    │
└──────────────────────────────────────────────────────────────┘
```

Key stack decisions:

- **SFTP client**: paramiko or pysftp (already common in Python 3.12 venv stack)
- **Parser**: pure-Python str.split('|'); the format is stable since 12/3/2024
- **Storage tables**: SQLite (consistent with the rest of permits.sqlite). All writes go through `writer_lock` (`scripts/utils/db.py`)
- **Watermark**: `data/sync_state.json` already has watermark logic — extend it with a `broward_or_last_release_date` field
- **Supabase mirror**: source-locked Broward tables get added to `MIRROR_TABLES` in `sync_to_supabase.py` once stable (currently 22 tables → 26)
- **Image fetch**: defer until Tier 2; lazy-fetch from `img.zip` only when needed for OCR or display

#### Optional enhancements:

- **RNS via dedicated mailbox**: signup script that POSTs to the RNS subscribe form on a per-folio basis, opens the confirmation email programmatically, clicks the activation link.
- **Backfill watermark**: separate from daily watermark; have one column mark "historical ingest complete through year YYYY" to support resumable yearly bulk loads.

### 6.4 High-value signals when permits + liens are joined

These should land **as source-locked facts first**, not as scoring outputs (per `docs/SIGNAL_ENGINE_DESIGN_RULES.md` and the `docs/DO_NOT_TOUCH.md` "scoring is paused" rule). The permit-app can render them however; we don't build them into `signals_v2`.

| Signal | Construction | Why it's valuable |
|---|---|---|
| **NOC-confirmed permit** | Permit issued + matching NOC recorded within ±60 days | Proves construction actually started; absence is itself a signal of stalled jobs |
| **Permit without NOC after 60 days** | Permit issued >60 days ago + no matching NOC | Either pre-NOC (small job) or stalled / abandoned project |
| **Lien against permitted property** | LIE recorded with debtor_name = permit.owner_name OR permit.contractor_name + recorded between permit.application_date and permit.application_date+24mo | Direct mechanic's-lien dispute on a project we can attribute to a known permit |
| **Contractor lien velocity** | Count of LIE rows where Reverse party = contractor_name in last 12mo, normalized by # of permits | Reputation / quality signal |
| **Owner distress stack** | Property has ≥3 of: open LP, open FJ/CFJ, open LIE, open M assignment to debt-collection corp, recent D in/out at distressed price | Foreclosure-imminent property; cross-reference any active permits for editorial value |
| **Construction-bond transfer** | TBLIE or TCLIE recorded against permit | The contractor moved a lien to bond / cash — typically means dispute is escalating to litigation |
| **Lien satisfied** | RST recorded with prior_instrument = a previously open LIE | Trackable cleanup of distress |
| **Tourist-tax-warrant lien** | LIE recorded by Broward County BOCC against vacation-rental property | Cross-reference with permit pipeline for short-term-rental code-enforcement story |
| **Foreclosure pipeline** | LP → CET sequence on a property | Editorial signal for distressed-sale stories |
| **Code-enforcement lien** | LIE filed by municipality (R party = "CITY OF FORT LAUDERDALE" etc.) | Direct municipal lien — also see `Building Code Services 954-765-4400` for liens that don't always reach the county Recording office |

### 6.5 Challenges & mitigations

| Challenge | Detail | Mitigation |
|---|---|---|
| **Index has no address column** | "We do not index legal descriptions and do not have the ability to search by legal description or property address" — official statement | Match on (a) parcel ID where present, (b) owner_name + contractor_name normalised, (c) image OCR for explicit address |
| **Parcel ID populated only on conveyance docs** | 0% of LIE / NOC / MORTGAGE / FJ rows have parcel_id in the structured index | Use owner-name match for non-deeds; OCR the TIFF for occasional ground-truth verification |
| **Name format consistency** | Broward formats individuals as `LASTNAME,FIRSTNAME[,MI]` and corporations as full string. Florida Signal's BCPA owner_name is similarly formatted but Accela's permit owner_name is more varied | Use the existing `owner_resolution` machinery (the Supabase mirror landed 2026-05-05) — extend it with contractor name resolution |
| **3–4 day QA lag** | Today's recordings won't appear until next business day at earliest, often Day+2 or Day+3 | Acceptable for non-realtime signals; pair with RNS email for "right now" alerts |
| **Daily file is image-heavy** | 400–500 MB ZIP/day, ~150 GB/year for full image archive | Skip the ZIP unless OCR is needed; ingest text only (~600 KB/day) for indexing |
| **Cloudflare-protected interactive UI** | AcclaimWeb 503s under scripted access | Don't automate AcclaimWeb. Use SFTP for bulk; AcclaimWeb only for human ad-hoc lookups |
| **Sealed / expunged docs** | Confidential flag = 1, 2, 3, 4 strips metadata | These rows are already metadata-stripped in the public feed — no remediation needed |
| **Confidential subscriber data on RNS** | RNS subscriber emails + monitored entities are public records under FL law | Use a dedicated `liens@fortlauderdalesignal.com` mailbox so personal addresses aren't disclosed |
| **AI-bot disallow in robots.txt** | `ClaudeBot` and other AI training crawlers explicitly disallowed | Florida Signal's pipeline use is explicitly *not* AI training; document this clearly. The SFTP feed is unaffected by robots.txt. |
| **Witness-info recording requirement (FL 695.26 amended Jan 1 2024)** | Witness names + post-office addresses now required for valid recording | Pure consumer of data; doesn't affect ingest |
| **Code-enforcement liens may not all flow through Recording** | Broward staff explicitly recommend also checking with municipalities and Broward Building Code Services | Tier 3 — separately ingest municipal lien feeds (Fort Lauderdale and Broward Code Enforcement) for full coverage |

### 6.6 Existing integration documentation / case studies

None published by Broward County for permit / building data systems specifically. The OnCore Acclaim platform (Harris Recording Solutions) does have integrations published for **title companies** and **mortgage / lending platforms** (CSC, Simplifile, ICE/Indecomm, ePN). No public case study of building-permit cross-referencing — this is a relatively novel use case and one Florida Signal is well-positioned to operationalize.

---

## 7. Screenshots & Key Page Descriptions

Captured during this audit (referenced by IDs from the live Chrome session):

| Page | URL | Key observations |
|---|---|---|
| **RTT Division homepage** | `broward.org/RecordsTaxesTreasury/Pages/Default.aspx` | Quick Links: Official Records Search, Forms, Records, Service Locations, Legal Notices, Pay Tourist Development Taxes, VAB, Doc Stamps Calculator. Effective Jan 7 2025 the Tax Collector role split off to Abbey Ajayi at browardtax.org. Tax-deed auctions transitioning to RealAuction. RNS marketing block. Electronically-certified-document availability via Official Records Search 1978-present. |
| **Official Records Search landing** | `/Records/Pages/PublicRecordsSearch.aspx` | Three buckets: Search Records → AcclaimWeb · Registered Login (recording agents only — no public registration available; contact `records@broward.org`) · Search CET Track · Bulk Files (Search Files button). |
| **Download Index Files** | `/Records/Pages/IndexFiles-Completed.aspx` | The page that gives the SFTP credentials. URL `BCFTP.Broward.org`, port 22, user `crpublic`, pass `crpublic`. 10 continuous days of QA'd data. Links to two PDFs: `ExportFilesLayout.pdf` (file schema) and `DocumentTypeDescriptions.pdf` (doc-type controlled vocabulary). |
| **AcclaimWeb home** | `officialrecords.broward.org/AcclaimWeb` | OnCore Acclaim by Harris Recording Solutions. Nine search modes. Disclaimer-acceptance gate. "Released through date: 05/06/2026 · Released through Instrument Number: 120853732 · As of 5/10/2026 3:30:48 AM" header tells you the freshness. Sidebar bulk-data callout pointing back to the SFTP page. Phone for bulk requests: 954-831-4000. |
| **Document Type search** | `/AcclaimWeb/search/SearchTypeDocType` | Two pickers: "Doc Type Category" (14 categories incl. Liens/Judgements, IRS liens, Lien/Judgement Releases, Mortgages, etc.) and "Doc Type List" (every individual code). Date range selector. Cloudflare-protected (got `Service Unavailable` and AspxErrorPath errors under aggressive scripting). |
| **Recording Notification Service** | `/PublicRecordsNotificationWebModern/Subscribe` | Free email-alert sign-up. Three monitor types: Individual / Business Name / Parcel Number. Form is a multi-step Constant Contact / Acclaim front end, requires email confirmation. Public-records disclosure caveat. |
| **Records Calculator** | `/Pages/RecordsCalculator.aspx` | Three sections: Deed Doc Stamps from sale price, Recording Fee from page count, Total Calculation (recording + stamps + intangible). Pure UI calculator — no API. |
| **Recording Fees** | `/TaxesFees/Pages/FeeSchedule.aspx` | Full statutory fee schedule (see § 4 above for table). Also shows search-and-copy fees, public-records-request fees, VAB fees, credit-card convenience fees. |
| **Records section landing** | `/Records/Pages/Default.aspx` | Describes the three internal sections: Recording, Search & Copy, Document Control & Minutes. Lists exactly what's recorded (Deeds, Mortgages, Notices of Commencement, Liens, Declarations of Condominium, Final Judgments, Military Discharges, Death Certificates, Probate, Satisfactions, Court Papers, Plats, Maps). FS 695.26 witness rule effective 2024-01-01. Chap 119 redaction-request process. |
| **Search and Copy Section Services** | `/Records/Pages/SearchCopySectionServices.aspx` | **Important: "We do not index legal descriptions and do not have the ability to search by legal description or property address."** Free image viewing online from 1998-08-24+. Pre-1998 imaging in progress (back to 1883). Phone-based search not supported — written request only. |
| **eRecording vendors page** | `/Records/Pages/ElectronicRecording.aspx` | Six approved third-party submitters: CSC, E-Docs, ePN, Hopdox, ICE Mortgage Tech (formerly Simplifile), Indecomm (formerly US Recordings). Mentions a **PRIA 2.4 XML WEBSERVICE** for direct govt-to-govt integration (gated by Harris Recording Solutions validation). |
| **Forms** | `/Records/Pages/Forms.aspx` | Form PDFs incl. Notice of Commencement form, Termination of NOC form, Agent Code Application, Escrow Account Application, Property Transfer Information Sheet, Recording Transmittal, Removal/Block Information, Tourist Tax forms. |
| **Tourist Development Tax** | `/TaxesFees/Pages/TouristDevelopmentTaxes.aspx` | 6% bed tax for ≤6-month rentals. Failure to pay → tax-warrant LIEN on property + criminal misdemeanor. These warrant liens flow back through the Recording feed under doc type LIE / LIEN CORP. |
| **Service Locations** | `/Pages/ServiceLocations.aspx` | Full contact list incl. **Specialty Desk for Construction Liens (FS 713.24): 954-357-7270 · rttspecialty@broward.org**, CET Desk (954-357-5436), main Records (954-831-4000). Tax Collector services (auto tags / hunting / business tax / property tax / tax deeds) all moved to browardtax.org per Jan 7 2025 split. |
| **robots.txt (records subdomain)** | `officialrecords.broward.org/robots.txt` | Cloudflare-managed. `Allow: /` with `Content-Signal: search=yes,ai-train=no`. Explicit disallow of major AI crawlers (ClaudeBot, GPTBot, CCBot, Bytespider, Amazonbot, Applebot-Extended, Google-Extended, meta-externalagent). Does not affect SFTP. |
| **Live SFTP listing** | `sftp://crpublic@bcftp.broward.org/Official_Records_Download/` | Verified working from sandbox. 10 most-recent business days present (04-23, 24, 27, 28, 29, 30, 05-01, 04, 05, 06 of 2026). Each day: 5 small text files + 1 image ZIP. |
| **Live SFTP archive listing** | `/OR_Yearly_Exports/` | 48 calendar-year archives 1978–2025 + PLATSMAPS. ~8 GB total uncompressed. |
| **Sample lien record (live)** | Instrument 120850066 (LIE, 05/06/2026, "CHELSEA PLACE COMMUNITY ASSN INC vs JOHNSON,WILLIAM CLAUDE", filed electronically) | Pulled live from the SFTP feed. Confirms field structure exactly as documented. |
| **Sample NOC (live)** | Instrument 120849990 ("FIRST CLASS FENCE & RAIL INC" job for HARVEY,BRIAN + HARVEY,JANICE) | Pulled live. Demonstrates clean owner / contractor name pairing perfectly suited for permit join. |

Two reference PDFs were downloaded into the audit working directory and parsed:

- `broward_export_layout_v2.pdf` (6 pages) — the canonical schema for the 5 daily text files. Source: `https://www.broward.org/RecordsTaxesTreasury/Records/Documents/ExportFilesLayout.pdf`
- `broward_doctype_codes_v2.pdf` (2 pages) — the doc-type code → description mapping. Source: `https://www.broward.org/RecordsTaxesTreasury/Records/Documents/DocumentTypeDescriptions.pdf`

---

## 8. Recommendations

### 8.1 Best way to get this data daily — bottom line

**Use the SFTP feed. Nothing else comes close.**

Concrete steps:

1. Add a launchd agent `com.floridasignal.broward-or-nightly` firing daily at ~11:05 ET (approx 30 min after the typical 10:28 ET release).
2. The agent calls a new `0_BROWARD_OR_NIGHTLY.command` wrapper (must follow the 2026-05-05 wrapper-must-source-venv + PIPESTATUS doctrine — `source .venv/bin/activate` and `EC=${PIPESTATUS[0]}` after `tee`).
3. The wrapper invokes a new `scripts/pull_broward_official_records.py` (paramiko-based pull, idempotent, defaults to dry-run with a `--fetch` flag for wet mode per Expansion-Hardening rules).
4. Followed by `scripts/ingest_broward_official_records.py` (writer-lock-aware INSERT into new `enrichment_broward_*` tables).
5. Followed by `scripts/match_permits_to_nocs.py --report-only` (mutation requires `--fix`).
6. Initial historical backfill: a separate one-shot `0_BROWARD_OR_HISTORICAL_BACKFILL.command` that pulls the 48 yearly archives once (multi-hour run, source-locked output, no scoring).

### 8.2 Red flags and watch-outs

- **Do not automate AcclaimWeb interactive search.** Cloudflare is in front; it 503s under scripted access and we already saw that during this audit. Treat it as a human-only ad-hoc tool.
- **Do not rely on parcel_id alone for joining liens.** It's only populated on deeds. Owner-name match is the workhorse for liens / NOCs / mortgages.
- **Do not re-architect Florida Signal scoring or signal tables for this.** The current phase is ENRICHMENT and scoring is paused. Land Broward data as source-locked facts only; rendering / signaling / scoring is a separate decision after Andy un-pauses scoring.
- **Do not skip the `lnk-ver.txt` cross-reference file.** It is what tells you a lien has been satisfied (RST → prior LIE). Without it your "open liens" count will skew high over time.
- **Honor the AI-bot robots.txt disallow.** Don't run any LLM-training pipeline against the AcclaimWeb subdomain; the SFTP path is explicitly fine and is the right channel anyway.
- **Recording lag vs. event lag.** A document recorded 05/06 may relate to a lien claim from 04/15 (last-furnishing date). If the editorial use needs the *event* date, OCR the TIFF — the structured index gives you the *recording* date.
- **Witness-info amendment (FS 695.26, eff. 2024-01-01).** Documents lacking witness names + post-office addresses are now rejected at recording. Doesn't affect ingest, but explains why some pre-2024 docs may have re-recorded versions in the feed.
- **Sealed/expunged metadata.** Rows with confidential flag 1/2/3/4 are stripped of names and legal description in the public feed. Don't error on these — handle gracefully.
- **County-vs-municipal liens.** Broward Building Code Services (954-765-4400) and individual cities (Fort Lauderdale code enforcement) keep some liens that don't always make it to the County Recording office. Tier-3 work.

### 8.3 Prioritized next steps (Florida Signal–specific)

| Priority | Action | Owner | Effort | Gating dependency |
|---:|---|---|---|---|
| **P0** | Andy approval to spec out a Phase-1 Broward Official Records ingest (this report counts as the propose step in the propose → ChatGPT QA → approval → apply workflow) | Andy | — | — |
| **P0** | New canonical doc `docs/BROWARD_LIENS_IMPLEMENTATION_PLAN_2026-05-10.md` mirroring the structure of `docs/CACHE_SEPARATION_IMPLEMENTATION_PLAN_2026-05-01.md` | Claude (next session, after approval) | 30 min | P0 above |
| **P1** | Build `scripts/pull_broward_official_records.py` + `0_BROWARD_OR_NIGHTLY.command` wrapper. Defaults to dry-run; `--fetch` is wet. Source venv. Use writer_lock. | Implementer | ~3 hrs incl. testing | Plan approved |
| **P1** | Define new tables: `enrichment_broward_doc`, `enrichment_broward_party`, `enrichment_broward_legal`, `enrichment_broward_link`. Strict source-locked schema, no scoring fields. | Implementer | 1 hr DDL + ChatGPT QA | Plan approved |
| **P1** | Add new tables to `MIRROR_TABLES` in `scripts/sync_to_supabase.py` (current list is 22; this brings it to 26). RLS policies anon-read like other source-locked tables. Composite PK on `(instrument_no)` for doc; on `(instrument_no, name_seq, party_type)` for party; etc. | Implementer | 1 hr DDL + 30 min sync wiring | Tables landed locally |
| **P1** | New launchd agent `com.floridasignal.broward-or-nightly.plist` at 11:05 ET. Plist follows 2026-05-04 python3-trampoline doctrine for any FDA-sensitive paths. | Implementer | 30 min | Wrapper landed |
| **P2** | `scripts/match_permits_to_nocs.py` — produces a candidate `enrichment_permit_noc_match` table. Read-only by default (`--report-only`); mutation requires `--fix`. | Implementer | ~1 day incl. tuning | P1 ingest stable |
| **P2** | Extend `owner_resolution` table to also resolve **contractor names** (currently it resolves owner only). | Implementer | 1 day | P1 ingest stable |
| **P2** | Historical backfill wrapper `0_BROWARD_OR_HISTORICAL_BACKFILL.command`. One-shot, multi-hour, idempotent. | Implementer | 1 day incl. monitoring | P1 ingest proven on daily files |
| **P3** | RNS programmatic subscription (one record per BCPA folio, dedicated mailbox) | Implementer | ~1 day incl. mail parser | P1 stable |
| **P3** | Image OCR pipeline for high-value docs (NOC permit-#, LIE amount, M maturity) | Implementer | 2–3 days | P2 stable |
| **P3** | Add lien / NOC summary cards to the Florida Signal dashboard (read-only) | Implementer | ~1 day | All P1+P2 in cloud |
| **P3** | Multi-county expansion exploration (Miami-Dade + Palm Beach) | Implementer | unknown — needs a separate audit per county | After Broward stable |

### 8.4 What this report explicitly did *not* touch

- I did not log into AcclaimWeb's Registered Agent system (that requires contacting `records@broward.org` for an agent code).
- I did not test the PRIA 2.4 XML WEBSERVICE (gov-to-gov / contracted-vendor only — out of scope).
- I did not subscribe to RNS (that creates a public record of subscription).
- I did not attempt to scrape AcclaimWeb at scale (Cloudflare bot policy + practical 503s).
- I did not write any data into Florida Signal tables, did not start any launchd agents, did not run any scoring or signal writers (per the project's hard prohibitions and the current ENRICHMENT phase / scoring paused doctrine).
- I did not delete or modify the PDF schema files I downloaded into the audit working directory.

---

## Appendix A — Quick-test commands you can run yourself

```bash
# Verify SFTP is alive (any FTP client / native macOS sftp will work)
sftp crpublic@bcftp.broward.org
# password: crpublic
sftp> cd Official_Records_Download
sftp> ls -la
# You should see 6 files * up-to-10-business-days = ~50–60 entries
sftp> get $(date -v-2d "+%m-%d-%Y")doc-ver.txt    # last fully-released day
sftp> bye
```

```bash
# Count document types in one day's index, no DB needed
awk -F'|' '{print $5}' MM-DD-YYYYdoc-ver.txt | sort | uniq -c | sort -rn | head -20

# Count NOCs per day
grep -c '|NOC|' MM-DD-YYYYdoc-ver.txt

# Pull all liens-and-related records in a year
zcat OR_Yearly_Exports/CY2025doc-rec.txt | awk -F'|' \
  '$5 ~ /^(LIE|LIEN CORP|FJ|CFJ|CJF|LP|NCL|TBLIE|TCLIE|RST|REL CORP|PR|NOC)$/' \
  > 2025_liens_and_nocs.txt
```

## Appendix B — Quick reference card

```
DAILY:    sftp crpublic:crpublic@bcftp.broward.org:22/Official_Records_Download/
HISTORY:  sftp crpublic:crpublic@bcftp.broward.org:22/OR_Yearly_Exports/
SEARCH:   https://officialrecords.broward.org/AcclaimWeb        (manual only)
ALERTS:   https://officialrecords.broward.org/PublicRecordsNotificationWebModern/Subscribe
DOCS:     https://www.broward.org/RecordsTaxesTreasury/Records/Documents/ExportFilesLayout.pdf
DOCS:     https://www.broward.org/RecordsTaxesTreasury/Records/Documents/DocumentTypeDescriptions.pdf
PHONE:    954-831-4000 (main) · 954-357-7270 (Construction Liens / FS 713.24 specialty desk)
EMAIL:    records@broward.org · rttspecialty@broward.org
QA LAG:   ~3 calendar days, typically posted 10:28 ET next business day
COST:     $0 for everything described above
```

---

*End of audit report. This is a research document — no live state was changed during preparation. The two reference PDFs (export layout + doc-type codes) are saved locally for future reference. Recommended next session prompt: "approved — produce the implementation plan doc per this audit's Section 8.3 P0 deliverable."*
