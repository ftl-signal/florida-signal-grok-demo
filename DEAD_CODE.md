# Dead Code Audit

Scope: `dashboard/index.html`, `dashboard/css/styles.css`, `dashboard/js/**/*.js` (excluding `js/inline-extracted.js` backup artifact).

Method:
- Function usage: declaration and call/reference scan across HTML + JS.
- CSS usage: class selector scan vs classes referenced in HTML/JS strings.
- DOM IDs: `getElementById()` references vs actual `id="..."` in `index.html`.

## 1) Functions Not Called

These are declared but never called (count=1 means declaration only):

- `clearPermitFilters` in `js/permits.js`
- `copyOperatorBrief` in `js/overview.js`
- `copyPermitSummary` in `js/components/permit-drawer.js`
- `simulateGrokTrigger` in `js/app.js`

## 2) CSS Classes Not Used

High-confidence unused class selectors (not found in HTML/JS class strings):

- `drawer-section`
- `drill-hint`
- `exec-hero`
- `exec-title`
- `glass`
- `lane-group-header`
- `last-updated-label`
- `metric-value`
- `overflow-wrap-anywhere`
- `sandbox-pill`
- `section-grid`
- `section-header`
- `watchlist-item`

Additional likely-unused utility classes from the local compatibility layer:

- `gap-x-1`
- `gap-x-2`
- `h-7`
- `inline-block`
- `inline-flex`
- `leading-normal`
- `mr-2`
- `overflow-x-hidden`
- `pt-0`
- `py-4`
- `space-x-2`
- `space-x-3`
- `text-blue-600`
- `text-orange-300`
- `truncate`
- `w-7`
- `whitespace-nowrap`

## 3) DOM IDs Referenced But Missing

Referenced in JS but no matching `id` exists in `index.html`:

- `grok-prompt` (referenced in `js/app.js`)
- `grok-response` (referenced in `js/app.js`)
- `health-banner` (referenced in `js/overview.js`)
- `operator-brief` (referenced in `js/overview.js`)
- `overview-time-windows` (referenced in `js/overview.js`)
- `pipeline-summary` (referenced in `js/pipeline.js`)
- `provenance-strip` (referenced in `js/overview.js`)

## Notes

- `js/inline-extracted.js` is an extraction artifact from the refactor and should remain excluded from runtime.
- Some “unused” CSS utilities may be intentionally kept for future iterations; entries above are based on current runtime usage only.
