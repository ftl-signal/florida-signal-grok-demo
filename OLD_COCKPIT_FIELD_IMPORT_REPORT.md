# OLD_COCKPIT_FIELD_IMPORT_REPORT — Full Case File Port

**Date:** 2026-05-28  
**Context:** Port of rich field depth from old Claude cockpit (reference/old_claude_cockpit/) into the clean Grok sandbox architecture. Strict adherence to hard boundary and ADHD-friendly layout rules.

## Fields Successfully Ported into Full Case File View
- permit_number, status, applied_date, issued_date, valuation, description, region (Snapshot + Permit tabs)
- resolved_owner_name, owner_confidence, parcel_id / folio (Owner & Parcel + BCPA tabs)
- contractor_name, source_sunbiz (Contractor & Sunbiz tab)
- source_accela, source_bcpa, source_sunbiz, last_enriched_at (Provenance tab)
- application_info_json, inspections (Accela Detail tab — stubbed depth)
- Basic BCPA property concepts (BCPA Property Card tab)

## Fields Deferred (intentionally not wired this sprint)
- Full normalized inspections history (row-by-row)
- Workflow timeline events (often empty in current sample)
- Detailed bcpa_sales_history rows + tax/flood fields
- Broward Clerk liens / NOC recordings (no table in sandbox snapshot)
- accela_related_records, subpermit_events, documents, conditions, comments
- Owner resolution notes + human verification workflow

## Fields Not Available in Current Sandbox Data
- Most rich BCPA fields (just_value, use_code, homestead, sales history, etc.) — current permits_sample.json has very limited columns
- accela_inspections normalized rows for most permits in the sample
- accela_details.application_info_json depth and workflow_json
- Any Broward Clerk / BCRM data

## Fields Intentionally Excluded from Overview / Main Table
- All rich source-specific fields (BCPA just value, Accela ASI key/values, inspections, workflow, etc.)
- Owner resolution confidence / human verify flags
- Detailed provenance timestamps beyond the existing badges
- Raw JSON / application_info key-values

These are only surfaced in the Full Case File view (triggered from the permit drawer) to keep Overview and the Permits Explorer table clean and scannable.

## Unsafe / Stale Assumptions Not Copied
- Any use of accela_details.raw_json (especially for inspections) — old spec explicitly forbids this
- Treating legacy signals scores as production intelligence
- Relying on the stale `enrichment` aggregate table instead of bcpa_property_card
- Assuming permits.valuation is authoritative when Accela detail is richer

## Next Recommended Sprint
"Full Case File Polish + Missing Fields Chips + Actionable Enrichment Queues + Export Bundle"

- Move Missing Fields to real chips in both Quick Drawer and Full Case File Snapshot
- Make Full Case File more persistent / linkable
- Wire richer real data (BCPA sales, inspections, workflow) when available
- One-click rich packet download from Full Case File
- Expand field_registry with every column from the old spec
- Add freshness/conflict warning banners (per old Claude spec)

All work performed 100% inside the sandbox using old Claude artifacts as read-only references only. No production impact.