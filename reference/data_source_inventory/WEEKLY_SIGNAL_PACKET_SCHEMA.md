# Florida Signal — Weekly Signal Packet Schema

*Created 2026-04-29. Specifies the standardized JSON object that will eventually be
sent to Gemini, Grok, and Claude for parallel scoring and adjudication. **This is a
schema design document, not a generator.** No code is written here. No packet is
generated. The packet generator is Phase 3 work in `BUILD_ROADMAP.md`.*

---

## 1. What a packet is

One Signal Packet = one Candidate Signal (per `SIGNAL_DEFINITION.md`) plus all the
context needed to score it. The packet must be:

- **Self-contained** — the receiving agent does not need any external lookup to score it.
- **Identical across agents** — every agent receives the same bytes, normalized the same way, in the same order. This enforces the report's "fair playing field" principle.
- **Human-readable** — Andy must be able to open the packet, read it once, and know what the agent saw. No opaque encodings.
- **Sourced** — every fact in the packet has a source URL or a table.column.row pointer.
- **Versioned** — the packet schema version is the first field. Schema changes are append-only; old packets stay valid.

## 2. Top-level shape

```json
{
  "packet_schema_version": "0.1",
  "packet_id": "<uuid>",
  "generated_at": "<ISO 8601 UTC>",
  "week_of": "YYYY-MM-DD (Monday of the week the signal was promoted)",
  "candidate": { /* see § 3 */ },
  "permit": { /* see § 4 */ },
  "parcel": { /* see § 5 */ },
  "owner": { /* see § 6 */ },
  "entity_graph": { /* see § 7 */ },
  "location": { /* see § 8 */ },
  "nearby_activity": { /* see § 9 */ },
  "two_year_archive_context": { /* see § 10 */ },
  "meeting_minutes_matches": [ /* see § 11 */ ],
  "media_blog_matches": [ /* see § 12 */ ],
  "sources": [ /* see § 13 */ ],
  "confidence_flags": { /* see § 14 */ },
  "missing_data_flags": [ /* see § 15 */ ],
  "human_review_notes": [ /* see § 16 */ ]
}
```

## 3. `candidate`

Identifies why this packet was generated.

```
{
  "primary_permit_number": "BLD-NEW-26010142",
  "primary_parcel_id_verified": "504201020010",
  "tier_at_packet_time": "candidate_signal",          // per SIGNAL_DEFINITION.md
  "silos_supporting": ["permit", "sales", "entity_graph"],
  "silo_count": 3,
  "rules_fired": ["fresh_deed_permit", "llc_cluster"],
  "promoted_at": "<ISO 8601 UTC>",
  "promoted_by_script": "detect_signals_v2.py"
}
```

## 4. `permit`

A flattened view of the row from `permits` and the joined `accela_details` row, raw values preserved alongside derived ones.

```
{
  "permit_number": "...",
  "report_source": "Issued Permits | Opened Permits | Permit Activity | Review Status",
  "permit_type": "BLD | PLN | ROW | TAM | ENF",
  "permit_subtype": "NEW | ROOF | DEMO | SITE | VARIANCE | ...",
  "status": "...",
  "applied_date": "YYYY-MM-DD",
  "issued_date": "YYYY-MM-DD | null",
  "finalized_date": "YYYY-MM-DD | null",
  "address_raw": "...",
  "address_normalized": "...",
  "description_raw": "...",
  "work_type_ai_classified": "...",
  "valuation_raw": "...",
  "valuation_usd_clean": <int|null>,
  "fees_total": <number|null>,
  "applicant_name": "...",
  "contractor_name_raw": "...",
  "contractor_name_normalized": "...",
  "contractor_sunbiz_doc": "...",
  "owner_name_raw": "...",                   // from accela_details when populated
  "owner_normalized": "...",
  "owner_sunbiz_doc": "...",
  "raw_json": { /* full original Crystal Reports + Accela detail row, untouched */ }
}
```

## 5. `parcel`

The full BCPA picture. Numeric fields are emitted twice — the raw string the source
returned and the parsed integer — so the agent can detect parsing errors.

```
{
  "folio": "504201020010",
  "use_code": "...",
  "just_value_raw": "$1,265,000",
  "just_value_num": 1265000,
  "assessed_value_num": <int>,
  "taxable_amount_county_num": <int>,
  "taxable_amount_municipal_num": <int>,
  "taxable_amount_school_num": <int>,
  "land_value_num": <int>,
  "bldg_value_num": <int>,
  "total_value_num": <int>,
  "homestead_flag": "...",
  "actual_year_built": <int>,
  "effective_year_built": <int>,
  "year_built_deviation": <int>,           // derived: effective - actual
  "bldg_sq_ft": <number>,
  "bldg_under_air_footage": <number>,
  "beds": <int>,
  "baths": <number>,
  "site_address_1": "...",
  "site_address_2": "...",
  "legal_description": "...",
  "neighborhood": "...",
  "historic_district": "...",
  "voting_precinct": "...",
  "tax_history": [
    { "year": 2024, "just_value": <int>, "assessed_value": <int>, "building_value": <int> },
    { "year": 2025, "just_value": <int>, "assessed_value": <int>, "building_value": <int> },
    { "year": 2026, "just_value": <int>, "assessed_value": <int>, "building_value": <int> }
  ],
  "sales_history": [
    {
      "sale_date": "YYYY-MM-DD",
      "sale_amount": <int>,
      "deed_type": "W | Q | O | ...",
      "book_and_page_or_cin": "...",
      "is_recent": <bool>,                 // derived: within last 6 months
      "is_off_market_premium": <bool>      // derived: sale_amount > 2 * just_value
    }
  ],
  "flood": {
    "fld_zone": "AE | VE | X | ...",
    "static_bfe_ft": <number|null>,
    "is_pre_1990_in_high_risk_zone": <bool>
  },
  "raw_json": { /* full BCPA property card response, untouched */ }
}
```

## 6. `owner`

Owner identity, with explicit absentee / institutional flags.

```
{
  "owner_name_raw": "...",
  "owner_name_normalized": "...",
  "ownership_type": "individual | LLC | trust | corp | gov | other",
  "mailing_address_1": "...",
  "mailing_city": "...",
  "mailing_state": "...",
  "mailing_zip": "...",
  "mailing_country": "...",
  "mailing_is_same_as_situs": <bool>,
  "mailing_is_out_of_county": <bool>,
  "mailing_is_out_of_state": <bool>,
  "mailing_is_corporate_services_address": <bool>,    // detected: PO box, Delaware/Scottsdale, etc.
  "matched_seed_developer": "RELATED GROUP | null"
}
```

## 7. `entity_graph` (Sunbiz)

The owner's corporate footprint from Sunbiz. The schema covers up to 2 hops as
recommended by the report, but each hop is optional. Today the codebase resolves
hop 1 (owner → document_number) only; hop 2 must be added for the report's
"who else does this manager run?" signal.

```
{
  "owner_sunbiz_doc": "...",
  "entity_name": "...",
  "entity_status": "Active | Inactive | Dissolved",
  "filing_date": "YYYY-MM-DD",
  "principal_addr1": "...",
  "principal_city": "...",
  "principal_state": "...",
  "principal_zip": "...",
  "registered_agent": {
    "name": "...",
    "addr1": "...",
    "city": "...",
    "state": "...",
    "is_law_firm": <bool>,
    "represents_n_other_entities": <int>      // hop-2; null if not yet computed
  },
  "officers": [
    {
      "name": "...",
      "title": "...",
      "addr1": "...",
      "other_entities_managed": <int>,         // hop-2; null if not yet computed
      "other_entities_sample": ["...", "..."]
    }
  ]
}
```

## 8. `location`

Geographic context. Fields marked **(missing)** are not yet computable.

```
{
  "lat": <number>,
  "lon": <number>,
  "geo_source": "bcpa_parcel | google | gemini | other",
  "geo_match_confidence": "high | medium | low",
  "neighborhood_code": "...",
  "scarcity_multiplier": <number|null>,         // (missing) Rio Vista 1.25, Harbor Beach 1.30, etc.
  "brightline_distance_mi": <number|null>,      // (missing)
  "is_inside_brightline_isochrone": <bool|null>,// (missing)
  "is_on_deepwater_canal": <bool|null>,         // (missing)
  "las_olas_distance_ft": <number|null>,        // (missing)
  "is_inside_rac_polygon": <bool|null>,         // (missing)
  "is_inside_uuv_polygon": <bool|null>          // (missing)
}
```

## 9. `nearby_activity`

Permits within a configurable radius. Default radius 500 m, lookback 12 months.
Sorted newest first.

```
{
  "radius_m": 500,
  "lookback_months": 12,
  "n_permits": <int>,
  "n_distinct_owners": <int>,
  "n_distinct_contractors": <int>,
  "is_cluster": <bool>,                         // derived: n_permits >= 3
  "permits": [
    {
      "permit_number": "...",
      "applied_date": "YYYY-MM-DD",
      "permit_type": "...",
      "address": "...",
      "owner_name": "...",
      "distance_m": <number>
    }
  ]
}
```

## 10. `two_year_archive_context`

Two-year lookback on the same parcel and the same owner. Used by the report's
"dormant address reawakens" pattern and for the LLC-traversal context.

```
{
  "lookback_start": "YYYY-MM-DD",
  "lookback_end": "YYYY-MM-DD",
  "parcel": {
    "permits_in_window": <int>,
    "permits_sample": [ /* up to 5 most recent */ ],
    "first_dormant_then_active": <bool>
  },
  "owner": {
    "permits_in_window_anywhere_in_city": <int>,
    "permits_sample": [ /* up to 10 most recent across all parcels */ ]
  }
}
```

## 11. `meeting_minutes_matches` *(deferred — no source ingested yet)*

When city minutes are ingested and vectorized (BUILD_ROADMAP Phase 2 stretch), each
match is one entry:

```
[
  {
    "meeting_type": "PZB | DRC | City Commission",
    "meeting_date": "YYYY-MM-DD",
    "matched_text_snippet": "(<= 250 chars; quoted from minutes)",
    "match_score": <number 0..1>,
    "matched_on": "address | owner | project_name | contractor",
    "source_url": "..."
  }
]
```

Until the source is ingested, this array is always `[]` and `missing_data_flags`
records `meeting_minutes_unavailable`.

## 12. `media_blog_matches` *(partially exists in `enrich_news.py` today)*

```
[
  {
    "outlet": "The Real Deal | South Florida Business Journal | local blog",
    "title": "...",
    "url": "...",
    "published_at": "YYYY-MM-DD",
    "matched_on": "address | owner | project_name",
    "snippet": "(<= 250 chars)"
  }
]
```

## 13. `sources`

Every fact in the packet must point back to a source. The agents are instructed never
to invent data; if a fact is not in `sources`, it is a hallucination.

```
[
  { "label": "BCPA property card", "url": "https://web.bcpa.net/..." , "pointer": "bcpa_property_card.folio=504201020010" },
  { "label": "LauderBuild permit page", "url": "https://aca-prod.accela.com/FTL/Cap/CapDetail.aspx?...", "pointer": "permits.permit_number=BLD-NEW-26010142" },
  { "label": "Sunbiz filing", "url": "https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResultDetail?inquirytype=DocumentNumber&directionType=Initial&searchNameOrder=...&aggregateId=...", "pointer": "sunbiz_entities.document_number=L24000000000" },
  { "label": "Recorded deed image", "url": "https://officialrecords.broward.org/AcclaimWeb/...", "pointer": "bcpa_sales_history.book_and_page_or_cin=..." }
]
```

## 14. `confidence_flags`

Per-section confidence. Drives the agent's caveats in the brief.

```
{
  "permit_data_confidence": "high | medium | low",
  "parcel_match_confidence": "high | medium | low",
  "owner_resolution_confidence": "high | medium | low",
  "entity_graph_confidence": "high | medium | low",
  "geocode_confidence": "high | medium | low",
  "overall_confidence": "high | medium | low"
}
```

## 15. `missing_data_flags`

An explicit list. Not just nulls — the absence of a *capability* is also flagged.

```
[
  "owner_name_missing",
  "no_recent_sale_in_window",
  "meeting_minutes_unavailable",
  "noc_lookup_unavailable",
  "code_enforcement_lookup_unavailable",
  "brightline_distance_unavailable",
  "lien_data_unavailable"
]
```

## 16. `human_review_notes`

Reserved space for Andy (or a future operator) to attach a note to a packet — for
example, "manager confirmed in person at 13th Street walk-through, do not auto-publish
this one." The agents see these notes and weight them above algorithmic findings.

```
[
  {
    "note_id": "<uuid>",
    "author": "andy@fortlauderdalesignal.com",
    "added_at": "<ISO 8601>",
    "text": "...",
    "priority": "info | caution | block_publication"
  }
]
```

## 17. Storage

The packet is intended to live in a new (not yet created) table along the lines of:

```
signal_packets (
  packet_id TEXT PRIMARY KEY,
  permit_number TEXT,
  parcel_id_verified TEXT,
  week_of TEXT,
  generated_at TEXT,
  packet_schema_version TEXT,
  packet_json TEXT,        -- the entire packet as documented above
  silo_count INTEGER,
  tier TEXT
);
```

Storing the packet JSON is what makes the system reproducible: re-running the agents
on the same packet should yield the same scores. Schema changes bump
`packet_schema_version`; old packets stay readable.

## 18. What this document does NOT do

- It does not generate any packet today.
- It does not create the `signal_packets` table.
- It does not change `signals_v2` or `signals_v2_context`.
- It does not specify the agent prompts that consume the packet.

---

*Generator and storage layer are Phase 3 in `BUILD_ROADMAP.md`. Until then this is a
specification only.*
