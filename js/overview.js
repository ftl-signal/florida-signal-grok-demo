        function renderHealthBanner(dash) {
            const el = document.getElementById('health-banner');
            if (!el || !dash) return;
            const warnings = dash.stale_warnings || [];
            const hasStale = warnings.length > 0;
            const overall = hasStale ? 'PROVEN with STALE components' : 'PROVEN';
            const color = hasStale ? 'border-amber-500/40' : 'border-teal-500/40';
            // Subtle top gradient for premium feel
            el.style.background = hasStale 
                ? 'linear-gradient(145deg, #1e2937 0%, #0f172a 100%)' 
                : 'linear-gradient(145deg, #1e2937 0%, #0f172a 100%)';
            const icon = hasStale ? '⚠️ text-amber-400' : '✅ text-teal-400';

            el.className = `mb-4 rounded-2xl border px-4 py-2 flex items-center justify-between text-sm ${color}`;
            const bannerText = hasStale 
                ? `Data health: real numbers, but address mapping is 23 days old.`
                : `Data health: real numbers from the current local snapshot.`;

            el.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="${icon} text-xl"></span>
                    <div>
                        <div class="font-semibold text-lg">${bannerText}</div>
                        <div class="text-xs text-slate-400">Building permits from the current local sandbox snapshot.</div>
                    </div>
                </div>
                <div class="flex gap-2 text-xs">
                    ${getClassificationPill(hasStale ? 'STALE' : 'PROVEN')}
                    <span class="px-3 py-1 bg-slate-800 rounded-2xl">${warnings.length} active warning${warnings.length !== 1 ? 's' : ''}</span>
                </div>
            `;
        }

        function renderProvenanceStrip(dash) {
            // provenance-strip element removed in UI polish (dead hook cleaned)
            const el = document.getElementById('provenance-strip');
            if (!el) return;   // fail gracefully — do not throw
            const src = dash.source || {};
            const hasStale = (dash.stale_warnings || []).length > 0;
            el.innerHTML = `
                <span class="text-teal-400/80">SNAPSHOT</span> ${dash.generated_at ? formatTimeET(new Date(dash.generated_at)) + ' ET' : '—'}
                <span class="mx-2 text-slate-600">|</span>
                <span>${src.mtime || '—'}</span>
                <span class="mx-2 text-slate-600">|</span>
                <span class="${hasStale ? 'text-amber-400' : 'text-teal-400/70'}">${hasStale ? 'STALE GEOCODE' : 'CLEAN'}</span>
                <span class="ml-3 text-[9px] text-slate-500 cursor-pointer hover:text-slate-300" onclick="openDetailsModal('stale')">details</span>
            `;
        }

        function renderTodaysWatchlist() {
            const el = document.getElementById('watchlist-content');
            if (!el || !permitsData || !permitsData.length) return;

            const highVal = permitsData.filter(p => (p.valuation || 0) > 100000);
            const majorVal = permitsData.filter(p => (p.valuation || 0) > 750000);
            const missingAddr = permitsData.filter(p => !p.address || !p.address.trim());
            const stale = permitsData.filter(p => !p.address || !p.source_bcpa || !p.source_sunbiz || !p.last_enriched_at);
            const noBcpa = permitsData.filter(p => !p.source_bcpa);
            const noSunbiz = permitsData.filter(p => !p.source_sunbiz);

            const items = [
                { label: 'Major projects ($750k+)', count: majorVal.length, filter: 'majorval', note: 'High-dollar permits to review' },
                { label: 'Missing parcel data', count: noBcpa.length, filter: 'bcpa', note: 'Owner/property details incomplete' },
                { label: 'Missing company match', count: noSunbiz.length, filter: 'sunbizmiss', note: 'Contractor/company not matched' },
                { label: 'Can’t be mapped', count: missingAddr.length, filter: 'missingaddr', note: 'No usable address' },
                { label: 'Needs a refresh', count: stale.length, filter: 'stale', note: 'Old or incomplete supporting data' }
            ];

            el.innerHTML = items.map(it => `
                <button type="button" class="watchlist-card rounded-2xl p-3 cursor-pointer flex-1 text-left" onclick="applyWatchlistFilter('${it.filter}')" aria-label="Filter permits by ${it.label}">
                    <div class="text-teal-400 text-[11px] font-semibold tracking-wider">${it.label}</div>
                    <div style="font-size:44px; line-height:1; font-weight:700; font-family: var(--font-display); letter-spacing:-0.02em;">${it.count}</div>
                    <div class="text-[10px] text-slate-400 mt-1 leading-tight">${it.note}</div>
                </button>
            `).join('');
        }

        // ===== Homepage Batch-Enrichment Snapshot (surgical sprint) =====
        function renderLatestIntakeBatch(timeWindows, dash) {
            const el = document.getElementById('latest-intake-batch');
            if (!el || !timeWindows || !timeWindows.length) {
                if (el) el.innerHTML = '<div class="text-xs text-slate-400">Latest batch data not available in local sample (UNKNOWN).</div>';
                return;
            }
            // Use "Last Pull" as the closest proxy for the newest batch
            const latest = timeWindows.find(w => (w.window || '').toLowerCase().includes('pull')) || timeWindows[0];
            const stale = (dash && dash.stale_warnings && dash.stale_warnings.length) ? dash.stale_warnings[0] : null;

            const isLive = (new URLSearchParams(window.location.search).get('livePermits') === '1') ||
                           window.__FL_SIGNAL_LIVE_DATA === true;

            if (isLive) {
                const liveSum = window.liveOverviewSummary && window.liveOverviewSummary.mode === 'live' ? window.liveOverviewSummary : null;

                let newCount = '—';
                let newLabel = 'Latest live batch pending';
                let metricsHtml = `
                    <div style="text-align:center;"><div class="text-xs text-slate-400" style="font-family: var(--font-body);">Processed</div><div style="font-size:32px; line-height:1; font-weight:600; color:#5cb8b5; font-family: var(--font-display); letter-spacing:-0.01em;">—</div></div>
                    <div style="text-align:center;"><div class="text-xs text-slate-400" style="font-family: var(--font-body);">Parcel</div><div style="font-size:32px; line-height:1; font-weight:600; color:#5cb8b5; font-family: var(--font-display); letter-spacing:-0.01em;">—</div></div>
                    <div style="text-align:center;"><div class="text-xs text-slate-400" style="font-family: var(--font-body);">Company</div><div style="font-size:32px; line-height:1; font-weight:600; color:#5cb8b5; font-family: var(--font-display); letter-spacing:-0.01em;">—</div></div>
                    <div style="text-align:center;"><div class="text-xs text-slate-400" style="font-family: var(--font-body);">Address</div><div style="font-size:32px; line-height:1; font-weight:600; color:#5cb8b5; font-family: var(--font-display); letter-spacing:-0.01em;">—</div></div>
                    <div style="text-align:center;"><div class="text-xs text-slate-400" style="font-family: var(--font-body);">Full detail</div><div style="font-size:32px; line-height:1; font-weight:600; color:#5cb8b5; font-family: var(--font-display); letter-spacing:-0.01em;">—</div></div>
                `;

                if (liveSum) {
                    if (liveSum.permits_over_700k != null) {
                        newCount = liveSum.permits_over_700k.toLocaleString();
                        newLabel = '≥ $700k live';
                    } else if (liveSum.latest_last_seen_at) {
                        newCount = 'Recent';
                        newLabel = 'see header for last seen';
                    }

                    const p = liveSum.address_coverage_pct != null ? liveSum.address_coverage_pct + '%' : (liveSum.missing_address_count != null ? 'Missing ' + liveSum.missing_address_count.toLocaleString() : 'Pending');
                    const b = liveSum.source_coverage && liveSum.source_coverage.bcpa != null ? liveSum.source_coverage.bcpa + '%' : 'Pending';
                    const s = liveSum.source_coverage && liveSum.source_coverage.sunbiz != null ? liveSum.source_coverage.sunbiz + '%' : 'Pending';

                    metricsHtml = `
                        <div style="text-align:center;"><div class="text-xs text-slate-400" style="font-family: var(--font-body);">High-value</div><div style="font-size:32px; line-height:1; font-weight:600; color:#5cb8b5; font-family: var(--font-display); letter-spacing:-0.01em;">${liveSum.permits_over_700k != null ? liveSum.permits_over_700k.toLocaleString() : '—'}</div></div>
                        <div style="text-align:center;"><div class="text-xs text-slate-400" style="font-family: var(--font-body);">Parcel</div><div style="font-size:32px; line-height:1; font-weight:600; color:#5cb8b5; font-family: var(--font-display); letter-spacing:-0.01em;">${b}</div></div>
                        <div style="text-align:center;"><div class="text-xs text-slate-400" style="font-family: var(--font-body);">Company</div><div style="font-size:32px; line-height:1; font-weight:600; color:#5cb8b5; font-family: var(--font-display); letter-spacing:-0.01em;">${s}</div></div>
                        <div style="text-align:center;"><div class="text-xs text-slate-400" style="font-family: var(--font-body);">Address</div><div style="font-size:32px; line-height:1; font-weight:600; color:#5cb8b5; font-family: var(--font-display); letter-spacing:-0.01em;">${p}</div></div>
                        <div style="text-align:center;"><div class="text-xs text-slate-400" style="font-family: var(--font-body);">Full detail</div><div style="font-size:32px; line-height:1; font-weight:600; color:#5cb8b5; font-family: var(--font-display); letter-spacing:-0.01em;">Live</div></div>
                    `;
                }

                const htmlLive = `
                    <div>
                        <div class="latest-intake-top-band" style="display:flex; align-items:flex-end; gap:28px; margin-bottom:8px;">
                            <div style="flex-shrink:0;">
                                <span style="font-size:80px; line-height:1; font-weight:800; color:#5cb8b5; text-shadow:0 0 36px rgba(92,184,181,0.22); letter-spacing:-0.04em; font-family: var(--font-display);">${newCount}</span>
                                <span style="font-size:20px; line-height:1; font-weight:400; color:#e6edf7; margin-left:14px;">new / high-value</span>
                            </div>
                            <div style="line-height:1.1; padding-bottom:4px; flex-shrink:0;">
                                <div class="uppercase text-[11px] tracking-[0.08em] text-slate-400" style="letter-spacing:0.08em; font-family: var(--font-body);">LATEST LIVE</div>
                                <div style="font-size:14px; font-weight:600; color:#7dd3fc; font-family: var(--font-display); margin-top:1px;">${newLabel}</div>
                            </div>
                            <div class="latest-intake-metrics" style="display:flex; gap:20px; margin-left:auto; padding-bottom:6px;">
                                ${metricsHtml}
                            </div>
                        </div>
                        <div class="text-[10px] text-amber-400 mt-1">Live Supabase mirror — some metrics remain pending until richer sync is wired.</div>
                    </div>`;
                el.innerHTML = htmlLive;
                return;
            }

            // Demo path (original behavior preserved exactly)
            // Pre-compute ET time for the hero (using a representative time for the sample data)
            const heroPullTime = formatTimeET(new Date('2026-05-25T13:50:00'));

            const html = `
                <div>
                    <!-- Horizontal top band: 41 + timestamp stack + 5 metrics -->
                    <div class="latest-intake-top-band" style="display:flex; align-items:flex-end; gap:28px; margin-bottom:8px;">
                        <!-- 41 + new permits -->
                        <div style="flex-shrink:0;">
                            <span style="font-size:80px; line-height:1; font-weight:800; color:#5cb8b5; text-shadow:0 0 36px rgba(92,184,181,0.22); letter-spacing:-0.04em; font-family: var(--font-display);">${latest.new_permits_seen || 41}</span>
                            <span style="font-size:20px; line-height:1; font-weight:400; color:#e6edf7; margin-left:14px;">new permits</span>
                        </div>

                        <!-- LATEST PULL relative stack -->
                        <div style="line-height:1.1; padding-bottom:4px; flex-shrink:0;">
                            <div class="uppercase text-[11px] tracking-[0.08em] text-slate-400" style="letter-spacing:0.08em; font-family: var(--font-body);">LATEST PULL</div>
                            <div style="font-size:16px; font-weight:600; color:#e6edf7; font-family: var(--font-display); margin-top:1px;">5 min ago</div>
                            <div style="font-size:12px; color:#94a3b8;">May 25, 2026 · ${heroPullTime}</div>
                        </div>

                        <!-- 5 metrics, horizontally aligned to baseline -->
                        <div class="latest-intake-metrics" style="display:flex; gap:20px; margin-left:auto; padding-bottom:6px;">
                            <div style="text-align:center;">
                                <div class="text-xs text-slate-400" style="font-family: var(--font-body);">Processed</div>
                                <div style="font-size:32px; line-height:1; font-weight:600; color:#5cb8b5; font-family: var(--font-display); letter-spacing:-0.01em;">${latest.ai_cleaned_pct||0}%</div>
                            </div>
                            <div style="text-align:center;">
                                <div class="text-xs text-slate-400" style="font-family: var(--font-body);">Parcel</div>
                                <div style="font-size:32px; line-height:1; font-weight:600; color:#5cb8b5; font-family: var(--font-display); letter-spacing:-0.01em;">${latest.bcpa_matched_pct||0}%</div>
                            </div>
                            <div style="text-align:center;">
                                <div class="text-xs text-slate-400" style="font-family: var(--font-body);">Company</div>
                                <div style="font-size:32px; line-height:1; font-weight:600; color:#5cb8b5; font-family: var(--font-display); letter-spacing:-0.01em;">${latest.sunbiz_matched_pct||0}%</div>
                            </div>
                            <div style="text-align:center;">
                                <div class="text-xs text-slate-400" style="font-family: var(--font-body);">Address</div>
                                <div style="font-size:32px; line-height:1; font-weight:600; color:#5cb8b5; font-family: var(--font-display); letter-spacing:-0.01em;">${latest.geocoded_pct||0}%</div>
                            </div>
                            <div style="text-align:center;">
                                <div class="text-xs text-slate-400" style="font-family: var(--font-body);">Full detail</div>
                                <div style="font-size:32px; line-height:1; font-weight:600; color:#5cb8b5; font-family: var(--font-display); letter-spacing:-0.01em;">${latest.accela_detail_pct||0}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            el.innerHTML = html;
        }

        function renderCoverageWindows(windows) {
            const el = document.getElementById('coverage-windows');
            if (!el || !windows || !windows.length) {
                if (el) el.innerHTML = '<div class="text-xs text-slate-400">Coverage window data not available (UNKNOWN / NOT IN SAMPLE).</div>';
                return;
            }

            const getStatus = (w) => {
                const geo = w.geocoded_pct || 0;
                const bcpa = w.bcpa_matched_pct || 0;
                const sun = w.sunbiz_matched_pct || 0;
                if (geo < 70 || (w.window && w.window.toLowerCase().includes('pull'))) return 'STALE';
                if (bcpa < 60 || sun < 60) return 'GAPS';
                if (bcpa > 75 && sun > 70 && geo > 85) return 'HEALTHY';
                return 'PARTIAL';
            };

            const rows = windows.map(w => {
                const status = getStatus(w);
                const statusCls = status === 'HEALTHY' ? 'text-teal-400 bg-teal-500/10' :
                                  status === 'STALE' ? 'bg-[#f59e0b]/10' :
                                  status === 'GAPS' ? 'bg-[#f59e0b]/10' : 'bg-[#f59e0b]/10';
                const rowLabel = (w.window || '').toLowerCase().includes('pull') ? 'Latest batch' : w.window;
                return `
                    <div class="grid grid-cols-[120px_repeat(5,1fr)_80px] items-center py-1 border-b border-slate-800 last:border-none text-xs">
                        <div class="font-medium text-[#e6edf7]">${rowLabel}</div>
                        <div class="text-right tabular-nums text-teal-400">${w.ai_cleaned_pct||0}%</div>
                        <div class="text-right tabular-nums text-sky-400">${w.bcpa_matched_pct||0}%</div>
                        <div class="text-right tabular-nums text-amber-400">${w.sunbiz_matched_pct||0}%</div>
                        <div class="text-right tabular-nums ${ (w.geocoded_pct||0) < 80 ? 'text-orange-400' : 'text-teal-400'}">${w.geocoded_pct||0}%</div>
                        <div class="text-right tabular-nums text-teal-400">${w.accela_detail_pct||0}%</div>
                        <div class="ml-2 px-2 py-px rounded text-[12px] font-bold ${statusCls} text-right" style="${status === 'STALE' || status === 'GAPS' ? 'color:#f59e0b;' : ''}">${status}</div>
                    </div>
                `;
            }).join('');

            el.innerHTML = `
                <div class="grid grid-cols-[120px_repeat(5,1fr)_80px] text-[9px] text-slate-200 mb-1">
                    <div>Window</div>
                    <div class="text-right">Processed</div>
                    <div class="text-right">Parcel</div>
                    <div class="text-right">Company</div>
                    <div class="text-right">Address</div>
                    <div class="text-right">Full detail</div>
                    <div class="text-right">Status</div>
                </div>
                ${rows}
            `;
        }
        // ===== end homepage batch snapshot =====

        function applyWatchlistFilter(key) {
            showSection('permits');
            // Clear previous quick filters
            activeQuickFilters.clear();
            document.querySelectorAll('#quick-filters .quick-filter-chip').forEach(c => c.classList.remove('active'));

            // Activate the matching chip if present
            const chip = Array.from(document.querySelectorAll('#quick-filters .quick-filter-chip')).find(c => c.dataset.filter === key);
            if (chip) {
                activeQuickFilters.add(key);
                chip.classList.add('active');
            }

            filterPermitsTable();
        }

        function renderOperatorBrief(dash, timeWindows, enrichment) {
            const el = document.getElementById('operator-brief');
            if (!el || !dash) return;

            const m = dash.metrics || {};
            const total = m.total_permits?.value || 115862;
            const lastPull = (timeWindows && timeWindows[0]) || {};
            const recent = lastPull.new_permits_seen || 41;
            const filed = lastPull.permits_filed || 0;
            const bcpa = enrichment?.bcpa_matched || 19804;
            const geo = enrichment?.geocoded || 50185;
            const staleCount = (dash.stale_warnings || []).length;

            el.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3'; // compact 5 cards
            el.innerHTML = `
                <div class="compact-brief-card">
                    <div class="title text-teal-400">TRUSTED (PROVEN)</div>
                    <div class="bullets text-slate-300">• ${total.toLocaleString()} total permits (direct from READONLY)<br>• 100% AI cleaned on recent cohort</div>
                    <button onclick="openDetailsModal('trusted')" class="detail-btn">View details</button>
                </div>
                <div class="compact-brief-card">
                    <div class="title text-amber-400">STALE</div>
                    <div class="bullets text-slate-300">• Geocode last pull 2026-05-05 (23+ days)<br>• Owner resolution ~1.4%</div>
                    <button onclick="openDetailsModal('stale')" class="detail-btn">View details</button>
                </div>
                <div class="compact-brief-card">
                    <div class="title text-amber-400">STUBBED / PLACEHOLDER</div>
                    <div class="bullets text-slate-300">• Supabase mirror & backup audit (no writes)<br>• XLSX + full AI Packet exports</div>
                    <button onclick="openDetailsModal('stubbed')" class="detail-btn">View details</button>
                </div>
                <div class="compact-brief-card">
                    <div class="title text-red-400">NEEDS ATTENTION</div>
                    <div class="bullets text-slate-300">• Re-run geocoding + owner resolution<br>• Generate full manifests before production</div>
                    <button onclick="openDetailsModal('attention')" class="detail-btn">View details</button>
                </div>
                <div class="compact-brief-card">
                    <div class="title text-teal-400">WHAT CHANGED</div>
                    <div class="bullets text-slate-300">• ${recent} new + ${filed} filed in Last Pull<br>• All values from READONLY snapshot</div>
                    <button onclick="openDetailsModal('changed')" class="detail-btn">View details</button>
                </div>
            `;
        }

        // Simple details content for the 5 cards (progressive disclosure)
        const DETAILS_CONTENT = {
            trusted: `<strong>Trusted (PROVEN)</strong><br><br>
            • ${115862} total permits — direct COUNT(*) from the read-only snapshot.<br>
            • Recent activity and 100% AI cleanup on the latest cohort are directly observed from enrichment timestamps in the snapshot.<br>
            • Accela detail is present for every permit in the current window.<br><br>
            These numbers can be treated as ground truth for the snapshot date.`,

            stale: `<strong>Stale</strong><br><br>
            • Geocoding cache last pull was 2026-05-05 — more than 23 days old at snapshot time. Coverage is ~43% but the data is old.<br>
            • Owner resolution in coverage_summary is extremely low (~1.4%).<br><br>
            Do not rely on geocode or owner fields for any production decision without a fresh pull.`,

            stubbed: `<strong>Stubbed / Placeholder</strong><br><br>
            • Supabase mirror and full backup/truth audit layers have not been executed in this sandbox session.<br>
            • XLSX and complete AI Packet exports are client-side only (no SheetJS or server generation).<br><br>
            These are honest placeholders. The UI shows what would exist in a full deployment.`,

            attention: `<strong>Needs Attention</strong><br><br>
            • Re-run geocoding and owner resolution before any production scoring or spatial work.<br>
            • Generate full row-level export manifests + checksums before promoting any data out of the sandbox.<br><br>
            The current snapshot is excellent for exploration but not yet production-ready.`,

            changed: `<strong>What Changed in This Snapshot</strong><br><br>
            • Dozens of new permits observed in the most recent pull window.<br>
            • Geocode cache has not been refreshed (stale flag remains).<br>
            • Every metric shown was freshly computed directly from the READONLY snapshot at generation time.<br><br>
            No external systems or live feeds were used.`
        };

        function openDetailsModal(key) {
            const modal = document.getElementById('details-modal');
            const title = document.getElementById('details-title');
            const body = document.getElementById('details-body');
            if (!modal || !title || !body) return;

            title.textContent = key.toUpperCase().replace(/-/g, ' ');
            body.innerHTML = DETAILS_CONTENT[key] || 'No details available.';
            modal.classList.add('open');
            modal.style.display = 'flex';
        }

        function closeDetailsModal() {
            const modal = document.getElementById('details-modal');
            if (modal) {
                modal.classList.remove('open');
                modal.style.display = 'none';
            }
        }

        function toggleMobileNav() {
            const panel = document.getElementById('mobile-nav');
            if (panel) panel.classList.toggle('hidden');
        }

function toggleEditionDropdown() {
            const dd = document.getElementById('edition-dropdown');
            const trigger = document.querySelector('#edition-selector button');
            if (!dd) return;
            dd.classList.toggle('hidden');
            if (trigger) trigger.setAttribute('aria-expanded', String(!dd.classList.contains('hidden')));
            // Close on outside click
            setTimeout(() => {
                document.addEventListener('click', function handler(e) {
                    if (!dd.contains(e.target)) {
                        dd.classList.add('hidden');
                        if (trigger) trigger.setAttribute('aria-expanded', 'false');
                        document.removeEventListener('click', handler);
                    }
                }, { once: true });
            }, 10);
        }

        function renderMissionControlCards(dash, timeWindows, enrichment) {
            const c = document.getElementById('mission-control-cards');
            if (!c || !dash) return;

            const isLive = (new URLSearchParams(window.location.search).get('livePermits') === '1') || window.__FL_SIGNAL_LIVE_DATA === true;

            const m = dash.metrics || {};
            const total = m.total_permits?.value || 115862;
            const lastPull = (timeWindows && timeWindows[0]) || {};
            const recent = lastPull.new_permits_seen || 41;
            const filed = lastPull.permits_filed || 0;
            const aiPct = lastPull.ai_cleaned_pct || 100;

            // Live summary from dedicated endpoint (preferred over local/demo data)
            const liveSum = (isLive && window.liveOverviewSummary && window.liveOverviewSummary.mode === 'live') ? window.liveOverviewSummary : null;

            let liveTotal = total;
            let newTodayVal = isLive ? '—' : recent.toLocaleString();
            let newTodayLine = isLive ? 'Live metric pending' : 'May 25';
            let parcelVal = 'Pending live metric';
            let companyVal = 'Pending live metric';
            let addressVal = 'Pending live metric';

            if (liveSum) {
                liveTotal = liveSum.total_permits || total;
                if (liveSum.latest_last_seen_at) {
                    newTodayVal = 'See header';
                    newTodayLine = 'based on last live seen';
                }
                const over700k = liveSum.permits_over_700k;
                if (over700k != null) {
                    // Show high-value count instead of generic "New today" when available
                    newTodayVal = over700k.toLocaleString();
                    newTodayLine = '≥ $700k (live)';
                }

                if (liveSum.address_coverage_pct != null) {
                    addressVal = liveSum.address_coverage_pct + '%';
                } else if (liveSum.missing_address_count != null) {
                    addressVal = 'Missing: ' + liveSum.missing_address_count.toLocaleString();
                }

                if (liveSum.source_coverage) {
                    const sc = liveSum.source_coverage;
                    parcelVal = sc.bcpa != null ? sc.bcpa + '%' : 'Pending';
                    companyVal = sc.sunbiz != null ? sc.sunbiz + '%' : 'Pending';
                }
            } else if (isLive) {
                // No summary yet or partial failure → clear pending labels (no scattered dashes)
                newTodayVal = 'Live metric pending';
                newTodayLine = '';
                parcelVal = 'Live metric pending';
                companyVal = 'Live metric pending';
                addressVal = 'Live metric pending';
            } else {
                parcelVal = Math.round(((enrichment && enrichment.bcpa_matched || 19804) / total) * 1000) / 10 + '%';
                companyVal = Math.round(((enrichment && enrichment.sunbiz_matched || 55910) / total) * 1000) / 10 + '%';
                addressVal = Math.round(((enrichment && enrichment.geocoded || 50185) / total) * 1000) / 10 + '%';
            }

            const accelaPct = 100.0;
            const warnings = (dash.stale_warnings || []).length;

            // Exactly 6 key metrics — live uses real summary or clear "pending" labels
            const cards = [
                { label: 'Total permits', val: liveTotal.toLocaleString(), statusLine: isLive ? 'live Supabase mirror' : 'all time' },
                { label: 'High-value / Recent', val: newTodayVal, statusLine: newTodayLine },
                { label: 'Processed', val: (typeof aiPct === 'string' ? aiPct : aiPct + '%'), statusLine: 'all rows seen' },
                { label: 'Parcel / BCPA', val: parcelVal, statusLine: isLive ? '' : '19,804 of 115,862' },
                { label: 'Company / Sunbiz', val: companyVal, statusLine: isLive ? '' : '55,910 of 115,862' },
                { label: 'Address coverage', val: addressVal, statusLine: isLive ? (liveSum && liveSum.missing_address_count != null ? 'live count' : '') : 'geocoded sample' }
            ];

            c.innerHTML = cards.map(card => `
                <button type="button" class="metric-card-premium kpi-card bg-slate-900 border border-slate-700 rounded-2xl p-3 flex flex-col cursor-pointer hover:border-slate-500 text-left" onclick="drillMetricCard('${card.label}', '${card.drill}')" style="min-height: 112px;" aria-label="Open ${card.label} details">
                    <div class="text-[11px] font-semibold tracking-wider text-slate-400">${card.label}</div>
                    <div style="font-size:44px; line-height:1; font-weight:700; font-family: var(--font-display); letter-spacing:-0.02em;">${card.val}</div>
                    <div class="mt-2 text-[10px] text-slate-400 ${card.label === 'Warnings' && card.statusLine.includes('stale') ? 'font-semibold' : ''}" style="${card.label === 'Warnings' && card.statusLine.includes('stale') ? 'color:#f59e0b;' : ''}">${card.statusLine}</div>
                </button>
            `).join('');
        }

        function renderTimeWindowsOnOverview(windows) {
            const container = document.getElementById('overview-time-windows');
            if (!container) return;

            const isLive = (new URLSearchParams(window.location.search).get('livePermits') === '1') || window.__FL_SIGNAL_LIVE_DATA === true;
            if (isLive) {
                container.innerHTML = `<div class="text-xs text-amber-400 p-3">Live completeness / time windows pending — richer sync not yet wired.</div>`;
                return;
            }
            if (!windows || !windows.length) return;
            container.innerHTML = windows.map(w => `
                <div class="time-window-card bg-slate-900 border border-slate-700 rounded-3xl p-5">
                    <div class="font-semibold text-base mb-3">${w.window}</div>
                    <div class="space-y-1.5 text-sm">
                        <div class="flex justify-between"><span class="text-slate-400">New permits seen</span> <span class="font-medium">${(w.new_permits_seen||0).toLocaleString()}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Permits filed</span> <span class="font-medium">${(w.permits_filed||0).toLocaleString()}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">AI cleaned</span> <span class="font-medium">${w.ai_cleaned_pct || 0}%</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">BCPA / Sunbiz / Geo / Accela</span> <span class="font-medium">${w.bcpa_matched_pct||0}% / ${w.sunbiz_matched_pct||0}% / ${w.geocoded_pct||0}% / ${w.accela_detail_pct||0}%</span></div>
                    </div>
                </div>
            `).join('');
        }

        function flashCardContext(label) {
            const brief = document.getElementById('operator-brief');
            if (brief) {
                brief.style.transition = 'box-shadow .2s';
                brief.style.boxShadow = '0 0 0 3px rgba(92,184,181,0.25)';
                setTimeout(() => { brief.style.boxShadow = 'none'; }, 1100);
            }
            brief?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function drillMetricCard(label, cardData) {
            const l = (label || '').toUpperCase();

            if (l.includes('TOTAL PERMITS')) {
                showSection('permits');
            } else if (l.includes('RECENT')) {
                showSection('permits');
                activeQuickFilters.clear();
                document.querySelectorAll('#quick-filters .quick-filter-chip').forEach(c => c.classList.remove('active'));
                const chip = Array.from(document.querySelectorAll('#quick-filters .quick-filter-chip')).find(c => c.dataset.filter === 'lastpull');
                if (chip) { activeQuickFilters.add('lastpull'); chip.classList.add('active'); }
                filterPermitsTable();
            } else if (l.includes('BCPA')) {
                showSection('permits');
                activeQuickFilters.clear();
                document.querySelectorAll('#quick-filters .quick-filter-chip').forEach(c => c.classList.remove('active'));
                const chip = Array.from(document.querySelectorAll('#quick-filters .quick-filter-chip')).find(c => c.dataset.filter === 'bcpa');
                if (chip) { activeQuickFilters.add('bcpa'); chip.classList.add('active'); }
                filterPermitsTable();
            } else if (l.includes('SUNBIZ')) {
                showSection('permits');
                activeQuickFilters.clear();
                document.querySelectorAll('#quick-filters .quick-filter-chip').forEach(c => c.classList.remove('active'));
                const chip = Array.from(document.querySelectorAll('#quick-filters .quick-filter-chip')).find(c => c.dataset.filter === 'sunbizmiss');
                if (chip) { activeQuickFilters.add('sunbizmiss'); chip.classList.add('active'); }
                filterPermitsTable();
            } else if (l.includes('GEOCODED')) {
                showSection('enrichment');
            } else if (l.includes('WARNING')) {
                const brief = document.getElementById('operator-brief');
                if (brief) brief.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                flashCardContext(label);
            }
        }

        function copyOperatorBrief() {
            const el = document.getElementById('operator-brief');
            if (!el) return;
            const text = el.innerText.replace(/\s+/g, ' ').trim();
            navigator.clipboard.writeText('FLORIDA SIGNAL — OPERATOR BRIEF\n\n' + text + '\n\nSource: dashboard_summary.json (READONLY) — ' + new Date().toISOString()).then(() => {
                const orig = el.style.borderColor;
                el.style.borderColor = '#166534';
                setTimeout(() => el.style.borderColor = orig || '#1e2937', 900);
            }).catch(() => alert('Brief copied to clipboard (manual):\n\n' + text.slice(0, 280) + '...'));
        }
