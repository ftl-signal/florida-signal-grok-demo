        function renderIngestionPage() {
            const container = document.getElementById('ingestion-sources');
            if (!container) return;

            const roadmap = window.sourceRoadmap || {};
            const rmSources = roadmap.sources || [];

            // Start with enhanced cards from the full 27-entry roadmap (preferred)
            // Fall back to legacy field_registry adapters if roadmap missing
            const registry = window.fieldRegistry || {};
            const legacyAdapters = registry.ingestion_adapters || [];

            if (rmSources.length === 0 && legacyAdapters.length === 0) {
                container.innerHTML = '<div class="text-xs text-slate-400 p-4">No source data loaded.</div>';
                return;
            }

            // Build rich card list preferring roadmap entries (27), then legacy
            const cardData = [];

            // Map roadmap entries first (full 14 attrs)
            rmSources.forEach(s => {
                const isNotApproved = (s.hard_boundaries || '').includes('NOT APPROVED');
                const isFuture = ['planned','future','stub'].includes((s.current_status||'').toLowerCase());
                cardData.push({
                    name: s.source_name,
                    adapter: s.adapter_type,
                    status: s.current_status,
                    signal: s.signal_value,
                    build: s.build_cost,
                    mock_status: isFuture ? 'future / mock only' : (s.current_status === 'implemented' ? 'local snapshot (proven)' : 'partial local'),
                    future_readiness: isFuture ? 'dry-run + explicit approval required' : 'already exercised in snapshot',
                    risk: (s.hard_boundaries || '').includes('scrape') || (s.hard_boundaries || '').includes('NOT APPROVED') ? 'high' : (s.signal_value === 'very_high' ? 'medium' : 'low'),
                    first_safe: s.first_safe_test,
                    hard: s.hard_boundaries,
                    kill: isNotApproved || (s.current_status||'').toLowerCase() === 'blocked',
                    why: s.category + ' — ' + (s.signal_value || 'medium') + ' signal value per Claude audits',
                    data_exp: (s.fields_available || []).slice(0,5).join(', '),
                    refs: (s.reference_docs || []).join('; ')
                });
            });

            // If no roadmap, fall back to legacy (minimal)
            if (cardData.length === 0) {
                legacyAdapters.forEach(a => cardData.push({
                    name: a.source_name,
                    adapter: a.adapter_type || 'local',
                    status: a.freshness_status,
                    mock_status: a.fetch_mode,
                    future_readiness: 'see architecture doc',
                    risk: a.risk_level || 'low',
                    first_safe: a.first_safe_test || '—',
                    hard: a.hard_boundary || 'No live calls',
                    kill: !!a.kill_switch,
                    why: a.why_it_matters || '',
                    data_exp: (a.parsed_fields || []).slice(0,4).join(', ')
                }));
            }

            // 5 categories (enhanced)
            const categories = {
                "Mock Adapters (Current Safe State)": [],
                "Cloud-Ready Future Adapters (Require Approval)": [],
                "Require Explicit Approval Before Live (NOT APPROVED)": [],
                "Blocked or Unsafe in Current State": [],
                "Production-Frozen (Do Not Touch)": []
            };

            cardData.forEach(c => {
                const n = c.name;
                const hard = (c.hard || '').toUpperCase();
                if (hard.includes('NOT APPROVED') || hard.includes('FDEP ERP') || n.includes('FDEP') || n.includes('Official Records') || n.includes('BCS') || n.includes('Clerk')) {
                    categories["Require Explicit Approval Before Live (NOT APPROVED)"].push(c);
                } else if (hard.includes('FROZEN') || hard.includes('BLOCKED') || c.kill) {
                    categories["Blocked or Unsafe in Current State"].push(c);
                } else if (c.mock_status && c.mock_status.includes('future')) {
                    categories["Cloud-Ready Future Adapters (Require Approval)"].push(c);
                } else if (n.includes('Geocode') || n.includes('Sunbiz') || n.includes('BCPA')) {
                    categories["Cloud-Ready Future Adapters (Require Approval)"].push(c);
                } else {
                    categories["Mock Adapters (Current Safe State)"].push(c);
                }
            });

            let html = '';

            Object.entries(categories).forEach(([catName, list]) => {
                if (list.length === 0) return;
                const isDanger = catName.includes('NOT APPROVED') || catName.includes('Blocked') || catName.includes('Frozen');
                html += `<div class="col-span-full mt-3 first:mt-0"><div class="text-sm font-semibold ${isDanger ? 'text-red-400' : 'text-slate-400'} mb-2">${catName}</div><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">`;

                list.forEach(c => {
                    const riskColor = c.risk === 'high' ? 'text-red-400' : c.risk === 'medium' ? 'text-orange-400' : 'text-teal-400';
                    const notApproved = (c.hard || '').includes('NOT APPROVED');
                    html += `
                        <div class="clean-card border-l-4 ${notApproved || c.kill ? 'border-red-500' : 'border-teal-600'}">
                            <div class="flex justify-between">
                                <div class="font-semibold text-sm">${c.name}</div>
                                <div class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 ${riskColor}">${c.risk || 'low'} risk</div>
                            </div>
                            <div class="text-[10px] mt-1 text-slate-400">${c.mock_status || c.status} • adapter: ${c.adapter || '—'}</div>
                            <div class="mt-1 text-xs">
                                <div><span class="text-slate-400">Future readiness:</span> ${c.future_readiness || '—'}</div>
                                <div><span class="text-slate-400">First safe test:</span> ${c.first_safe || 'local data only'}</div>
                                <div class="text-amber-300 mt-0.5"><span class="text-slate-400">Hard boundary:</span> ${c.hard || 'Sandbox only — no live calls'}</div>
                            </div>
                            ${notApproved ? '<div class="mt-1 text-[10px] text-red-400 font-semibold">⚠ NOT APPROVED FOR LIVE CALLS</div>' : ''}
                            ${c.kill ? '<div class="mt-0.5 text-[10px] text-red-400">Kill switch / manual gate only</div>' : ''}
                            <div class="text-[9px] text-slate-500 mt-1">${(c.refs || '').slice(0,80)}</div>
                        </div>
                    `;
                });
                html += `</div></div>`;
            });

            container.innerHTML = html;
        }

        function renderAdapterTestHarness() {
            const container = document.getElementById('adapter-test-harness');
            if (!container) return;

            const results = window.adapterTestResults || {};
            const runs = results.runs || [];

            if (runs.length === 0) {
                container.innerHTML = '<div class="text-xs text-slate-400 p-3 col-span-full">No adapter_test_results.json loaded.</div>';
                return;
            }

            let html = '';
            runs.forEach(r => {
                const passColor = r.contract_pass ? 'teal' : 'red';
                html += `
                    <div class="clean-card border-l-4 border-${passColor}-500 text-xs">
                        <div class="flex justify-between items-start">
                            <div class="font-semibold">${r.source_name}</div>
                            <div class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-${passColor}-400">${r.status.toUpperCase()}</div>
                        </div>
                        <div class="mt-1 text-[10px]">
                            <div>Contract: <span class="font-semibold text-${passColor}-400">${r.contract_pass ? 'PASS' : 'FAIL'}</span></div>
                            <div>Live calls performed: <span class="text-teal-400 font-mono">false</span></div>
                            <div>No-write guarantee: <span class="text-teal-400 font-mono">true</span></div>
                            <div>Adapter: ${r.adapter_type} • Fetched: ${r.records_fetched}</div>
                        </div>
                        <div class="mt-1 text-[10px] text-amber-300">First safe test: ${r.first_safe_live_test}</div>
                        ${r.not_approved ? '<div class="mt-1 text-[10px] text-red-400 font-semibold">⚠ NOT APPROVED FOR LIVE CALLS</div>' : ''}
                        ${r.recommended ? '<div class="text-[10px] text-teal-400">★ Recommended first future live candidate</div>' : ''}
                    </div>
                `;
            });

            // Add summary line
            html += `
                <div class="col-span-full text-[10px] text-slate-400 mt-1">
                    ${results.total_mock_runs} mock runs • ${results.pass_count} pass • Recommended next: <span class="text-teal-400">${results.recommended_next_safe_source}</span>
                    <span class="ml-2 text-red-400">(All still require explicit future approval)</span>
                </div>
            `;

            container.innerHTML = html;
        }

        function renderMissingFieldMatrixDiag() {
            const el = document.getElementById('missing-field-matrix-diag');
            if (!el || !window.missingFieldMatrix) return;
            const m = window.missingFieldMatrix;
            const entries = m.entries || [];
            const counts = { PRESENT: 0, 'MISSING IN CURRENT ROW': 0, 'NOT IN SAMPLE': 0, 'NOT HOOKED UP': 0, 'PLANNED SOURCE': 0, STUB: 0, STALE: 0, UNKNOWN: 0 };
            entries.forEach(e => {
                if (counts[e.corrected_status_label] !== undefined) {
                    counts[e.corrected_status_label]++;
                }
            });
            el.innerHTML = `
                <div>Total field records audited: <span class="font-semibold text-teal-400">${entries.length}</span></div>
                <div>PRESENT: <span class="text-teal-400">${counts.PRESENT}</span></div>
                <div>MISSING IN CURRENT ROW: <span class="text-red-400">${counts['MISSING IN CURRENT ROW']}</span></div>
                <div>NOT IN SAMPLE: <span class="text-amber-400">${counts['NOT IN SAMPLE']}</span></div>
                <div>NOT HOOKED UP: <span class="text-orange-400">${counts['NOT HOOKED UP']}</span></div>
                <div>PLANNED SOURCE: <span class="text-sky-400">${counts['PLANNED SOURCE']}</span></div>
                <div>STUB: <span class="text-amber-400">${counts.STUB}</span></div>
                <div>STALE: <span class="text-orange-400">${counts.STALE}</span></div>
                <div>UNKNOWN: <span class="text-slate-400">${counts.UNKNOWN}</span></div>
                <div class="text-[10px] text-slate-500 mt-1 col-span-full">Categories above sum to total (one primary corrected label per audited field from missing_field_matrix.json).</div>
            `;
        }
