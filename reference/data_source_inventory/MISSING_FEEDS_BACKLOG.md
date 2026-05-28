# Florida Signal — Missing Feeds Backlog

*Created 2026-04-29. The PDF's framework assumes nine feeds / capabilities that the
current system does not have. This document catalogs them, why each one matters,
where it stands today, what depends on what, and a recommended build order.*

*This is a backlog, not a build commitment. **No work begins until Andy approves
items individually.***

---

## 1. Format

For each missing item:

- **Why it matters** — what the PDF (and any other downstream signal) needs from it.
- **Current status** — what we have, if anything, that's adjacent.
- **Dependencies** — what must already work before this can land.
- **Recommended build order** — relative position in the queue. **A** = first wave, **B** = second wave, **C** = stretch.

## 2. The nine items

### 2.1 City meeting minutes (PZB / DRC / City Commission)

- **Why it matters.** The PDF's "Memory Layer." Connects today's permit to 2024 board commentary on the same address, owner, project name, or contractor. Powers the "board deferred → settled → permit pulled" pre-signal pattern. Multiple silos in `SIGNAL_DEFINITION.md` rely on it.
- **Current status.** Nothing is ingested. `extract_plan_review_signals.py` parses Accela plan-review fields (which are about a permit, not a hearing). No vector store. No PDF/agenda scraping. No archive of any city meeting.
- **Dependencies.** None upstream — meetings are public. Downstream: an embeddings store (Postgres pgvector, already enabled in Supabase) and a `meeting_minutes` table.
- **Recommended build order.** **B (second wave).** High value but a multi-week ingestion + parsing project. Don't start until the field audit and signal-table cleanup are done.

### 2.2 Notice of Commencement (NOC)

- **Why it matters.** PDF's commencement signal — a recorded NOC means financing is secured and physical work starts within 90 days. Single highest-confidence "this is real" indicator.
- **Current status.** Not ingested. Closest adjacent: `enrich_court.py` exists but does not specifically parse NOC filings; `bcpa_sales_history` is sales only.
- **Dependencies.** Broward Clerk Official Records Search access (CSV export already documented in `docs/SOURCE_FIELD_AUDIT.md` notes). Probably scriptable with a daily pull.
- **Recommended build order.** **A (first wave, after audit).** Highest signal-to-effort ratio of the missing feeds.

### 2.3 Conduits™ municipal liens

- **Why it matters.** Distress signal silo. Recently satisfied lien before a permit pull = clear title for project commencement. Open lien on a parcel under assembly = motivated seller. PDF's "Distress Interaction" stage in the temporal ladder.
- **Current status.** Not ingested. The City of Fort Lauderdale exposes `lien-search` on its website; the PDF references the Conduits™ system for electronic lien interests.
- **Dependencies.** Access path / API for Conduits™ is not yet established. May require scraping the lien-search page if no API is offered.
- **Recommended build order.** **B.** Wait until NOC ingestion (§ 2.2) is operational; the parsing approach will likely transfer.

### 2.4 Code-enforcement / Unsafe-Structure (ENF prefix)

- **Why it matters.** Distress silo + the "code violation origin" signal we already detect. Also the seawall-disrepair case in the PDF's "Cost-to-Cure" pattern.
- **Current status.** Partially captured. `signals.rule = 'code_violation_origin'` has fired 81 times — but the underlying source is the same Crystal Reports stream as building permits, not a dedicated ENF feed. We do not separately query Accela for ENF records.
- **Dependencies.** Accela CapHome `?module=Enforcement` URL is reachable today. Scraper is essentially `scrape_accela_detail.py` repointed at the ENF prefix.
- **Recommended build order.** **A.** Cheap to add, materially improves the existing `code_violation_origin` rule.

### 2.5 NAVD seawall compliance

- **Why it matters.** The PDF's NAVD-5.0 ordinance signal. Cost-to-Cure docking on canal-front parcels with non-compliant walls; bonus for parcels that have already raised. Also feeds the "Canal Renovation Wave" detection.
- **Current status.** Not modeled. The text "NAVD" / "cap raise" can be searched for in `permits.description` and `accela_details.description`, but no dataset exists. No seawall-height attribute on any parcel.
- **Dependencies.** Either a city-published seawall inventory (none known to exist publicly) or string-pattern parsing of permit descriptions (cheap; partial).
- **Recommended build order.** **C (stretch).** Real, but low coverage from the feasible source. Defer until proximity scoring (§ 2.6) is in.

### 2.6 Proximity / location scoring (Brightline / Las Olas / RAC / UUV / canal frontage)

- **Why it matters.** The PDF's scoring rubric is **40% Brightline + 30% deepwater canal + 20% Las Olas + 10% hotspot**, then multiplied by a neighborhood scarcity factor. Without these, every score in `signals_v2_context.location_score` is a placeholder.
- **Current status.** `context_boosts.py` already writes `location_score` and `operator_score`, but the implementation does not use the PDF's weights and does not have GIS proximity lookups. `signals_v2_context.location_score` is non-zero on 73/200 rows — under-coverage already.
- **Dependencies.** Static GIS reference data: Brightline station coords, Las Olas centroid, RAC and UUV polygons (city offers shapefiles), deepwater-canal classification (BCPA + manual), neighborhood scarcity multipliers (manual).
- **Recommended build order.** **A.** Reference data is mostly free and small. This unblocks every map and every scored signal.

### 2.7 Spatial map / Kepler.gl

- **Why it matters.** The PDF's "living surface" — a real-time map with cluster-hull detection over weekly signals, point density via KDE, temporal brushing across years, joined to RAC/UUV polygons. Today the project produces 56 static images in `permit_maps`.
- **Current status.** Not built. No Kepler.gl integration. No interactive map. The only map asset that exists is the static aerial in `permit_maps`.
- **Dependencies.** Proximity / location reference data (§ 2.6) must land first. A weekly signal packet (§ 2.8) gives the map something to plot.
- **Recommended build order.** **C.** A Kepler page is fast to stand up *once* the upstream data exists. Don't build until § 2.6 and § 2.8 are real.

### 2.8 Weekly signal packet generator

- **Why it matters.** The PDF's "fair playing field." Every AI agent must score the same JSON. Without a packet generator, each agent gets ad-hoc context and the consensus-debate loop is impossible.
- **Current status.** Schema spec is drafted in `docs/WEEKLY_SIGNAL_PACKET_SCHEMA.md`. No generator exists. No `signal_packets` table exists.
- **Dependencies.** The signal-table decision (§ `docs/SIGNAL_TABLE_DECISION.md`) must be made — the generator needs to know which table to read from. Field audit (`docs/FIELD_AUDIT_PLAN.md`) should run first so the generator knows which fields are trustworthy.
- **Recommended build order.** **A (after audit + signal cleanup).** This is the central artifact that everything else attaches to.

### 2.9 True parallel Gemini / Grok / Claude adversarial review

- **Why it matters.** PDF's central architectural move: parallel scoring by Gemini and Grok, Claude as Chairman, force a debate when scores diverge by >2.0, only promote consensus ≥7.0 to Top-15.
- **Current status.** `scripts/ai_pipeline.py` is a **series** Gemini → Grok → Claude → Gemini-fact-check pipeline that produces an editorial brief. It is not parallel scoring. There is no debate loop. There is no scoring contract that the agents can score against.
- **Dependencies.** Signal packet (§ 2.8) must exist. A scoring rubric must be agreed (currently undefined). A `signal_verdicts` table or equivalent must exist.
- **Recommended build order.** **B (second wave).** This is the headline feature, but it depends entirely on packet + rubric. Building it before those exist would mean redoing it.

## 3. Build wave summary

| Wave | Items | Rationale |
|---|---|---|
| **A** (first) | 2.2 NOC · 2.4 ENF · 2.6 Proximity scoring · 2.8 Packet generator | Cheap-to-medium effort, each unblocks multiple downstream items, none requires a new vendor or a research project. |
| **B** (second) | 2.1 Meeting minutes · 2.3 Conduits liens · 2.9 Adversarial review | Higher effort or research-heavy; depend on Wave A artifacts. |
| **C** (stretch) | 2.5 NAVD seawall · 2.7 Kepler map | Visible / glamorous but should not be built before A and B because they would render incomplete data. |

## 4. What this backlog does NOT do

- It does not start any of these builds.
- It does not estimate hours or cost.
- It does not commit to a build order.
- It does not create stub tables for any of the missing feeds.

---

*Pair with `docs/NEXT_7_DAY_BUILD_PLAN.md` (which deliberately includes none of these
items) and `docs/STRATEGIC_ROADMAP_2026-04.md` (the longer-horizon business view).*
