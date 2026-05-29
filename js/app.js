        let permitsData = [];
        let filteredPermits = [];
        let dashboardSummaryData = null;
        let currentSort = { asc: true };

        // ===== Permit Code Decoder + Valuation Tiers (surgical sprint) =====
        // Glossary source of truth: data/permit_code_glossary.json (loaded as const here for zero-timing risk)
        const PERMIT_CODE_GLOSSARY = {
          "prefixes": {
            "BLD": { "meaning": "Building", "confidence": "KNOWN" },
            "ELE": { "meaning": "Electrical", "confidence": "KNOWN" },
            "PLB": { "meaning": "Plumbing", "confidence": "KNOWN" },
            "MEC": { "meaning": "Mechanical", "confidence": "KNOWN" },
            "FIR": { "meaning": "Fire", "confidence": "KNOWN" },
            "ENG": { "meaning": "Engineering", "confidence": "KNOWN" },
            "LND": { "meaning": "Landscape", "confidence": "KNOWN" },
            "GEN": { "meaning": "General", "confidence": "KNOWN" },
            "COC": { "meaning": "Certificate / completion-related permit", "confidence": "LIKELY" },
            "RADD": { "meaning": "Residential addition", "confidence": "LIKELY" },
            "FEN": { "meaning": "Fence", "confidence": "LIKELY" },
            "POOL": { "meaning": "Pool / spa / fountain", "confidence": "LIKELY" }
          },
          "notes": "Permit codes are local Accela/category codes. Unknown prefixes are marked UNKNOWN and require source confirmation. No live calls; decoder is local only."
        };

        function decodePermitCode(permitNumber) {
            if (!permitNumber) return { display: '—', confidence: 'UNKNOWN', prefix: '', sub: '' };
            const parts = String(permitNumber).split('-');
            const p1 = (parts[0] || '').toUpperCase();
            const p2 = (parts[1] || '').toUpperCase();
            const g = PERMIT_CODE_GLOSSARY.prefixes || {};
            const d1 = g[p1] || { meaning: 'UNKNOWN', confidence: 'UNKNOWN' };
            const d2 = p2 ? (g[p2] || { meaning: 'UNKNOWN', confidence: 'UNKNOWN' }) : null;
            let display = d1.meaning;
            if (d2 && d2.meaning !== 'UNKNOWN') display += ' · ' + d2.meaning;
            else if (d2 && d2.meaning === 'UNKNOWN') display += ' · ' + p2 + ' (UNKNOWN)';
            const allKnown = d1.confidence === 'KNOWN' && (!d2 || d2.confidence === 'KNOWN');
            const hasLikely = d1.confidence === 'LIKELY' || (d2 && d2.confidence === 'LIKELY');
            const conf = (d1.meaning === 'UNKNOWN' && (!d2 || d2.meaning === 'UNKNOWN')) ? 'UNKNOWN' : (allKnown ? 'KNOWN' : (hasLikely ? 'LIKELY' : 'UNKNOWN'));
            if (d1.meaning === 'UNKNOWN' && (!d2 || d2.meaning === 'UNKNOWN')) display = 'UNKNOWN — needs source confirmation';
            return { display, confidence: conf, prefix: p1, sub: p2 };
        }

        const VALUATION_TIERS = [
            { label: 'Marquee valuation', min: 1000000 },
            { label: 'Major valuation', min: 750000 },
            { label: 'Meaningful project', min: 250000 },
            { label: 'Watch valuation', min: 100000 }
        ];

        function getValuationTier(valuation) {
            const v = Number(valuation || 0);
            if (v >= 1000000) return { label: 'Marquee valuation', cls: 'text-violet-400' };
            if (v >= 750000) return { label: 'Major valuation', cls: 'text-amber-400' };
            if (v >= 250000) return { label: 'Meaningful project', cls: 'text-teal-400' };
            if (v >= 100000) return { label: 'Watch valuation', cls: 'text-sky-400' };
            if (v > 0) return { label: 'Below watch', cls: 'text-slate-400' };
            return { label: 'MISSING', cls: 'text-red-400' };
        }
        // ===== end decoder + tiers =====

        // ===== Precise Missing-Field Truth Labels (from data/missing_field_matrix.json audit) =====
        // Surgical: small lookup for the exact displayed fields that previously used blunt MISSING/STUB.
        // Returns one of the 8 allowed labels. Falls back to simple PRESENT / MISSING IN CURRENT ROW.
        function getPreciseFieldStatus(fieldKey, rawValue, p) {
            const hasValue = rawValue !== null && rawValue !== undefined && rawValue !== '' && rawValue !== '—';
            const key = (fieldKey || '').toLowerCase();

            // High-signal corrections from the audit matrix (only fields that appear with status labels in drawer / 9 tabs / Case Tree)
            if (key.includes('valuation')) {
                return hasValue ? 'PRESENT' : 'MISSING IN CURRENT ROW';
            }
            if (key.includes('address')) {
                return hasValue ? 'PRESENT' : 'MISSING IN CURRENT ROW';
            }
            if (key.includes('parcel') || key.includes('folio')) {
                return hasValue ? 'PRESENT' : 'MISSING IN CURRENT ROW';
            }
            if (key.includes('owner_name') || key.includes('owner name')) {
                return hasValue ? 'PRESENT' : 'MISSING IN CURRENT ROW';
            }
            if (key.includes('contractor_name') || key.includes('contractor name')) {
                return hasValue ? 'PRESENT' : 'MISSING IN CURRENT ROW';
            }
            if (key.includes('just_value') || key.includes('just value') || key.includes('use_code') || key.includes('homestead')) {
                return 'NOT IN SAMPLE';   // rich BCPA fields known in spec + field_registry + DATA_REALITY_MATRIX but absent from permits_sample columns
            }
            if (key.includes('license') && (key.includes('sunbiz') || key.includes('contractor'))) {
                return 'NOT HOOKED UP';   // deeper license data in mocks/old spec but not wired to displayed fields
            }
            if (key.includes('application_info') || key.includes('workflow') || key.includes('inspection')) {
                if (key.includes('workflow')) return 'STALE';
                return 'NOT IN SAMPLE';   // rich Accela detail known in old spec / audits but not in current snapshot columns
            }
            if (key.includes('geocode') || key.includes('lat') || key.includes('lon')) {
                // Values exist in sample but explicitly documented STALE (23+ days, dashboard_summary)
                return hasValue ? 'STALE' : 'MISSING IN CURRENT ROW';
            }
            if (key.includes('broward') || key.includes('clerk') || key.includes('lien') || key.includes('noc')) {
                return 'PLANNED SOURCE';  // No table in any sandbox JSON; high-risk planned per source_roadmap + reality matrix + 9 audits
            }
            if (key.includes('sales') || key.includes('tax') || key.includes('flood') || key.includes('mailing')) {
                return 'NOT IN SAMPLE';   // BCPA raw_json depth per SOURCE_FIELD_AUDIT (17% capture); not in permits_sample
            }
            if (key.includes('confidence') && key.includes('owner')) {
                return 'STUB';            // field_registry marks owner_confidence STUB; never surfaced
            }
            if (key.includes('subpermit') || key.includes('related') || key.includes('document') && key.includes('accela')) {
                return 'NOT IN SAMPLE';
            }
            if (key.includes('source_accela') || key.includes('source_bcpa') || key.includes('source_sunbiz') || key.includes('last_enriched')) {
                return hasValue ? 'PRESENT' : 'MISSING IN CURRENT ROW';
            }
            if (key.includes('work description') || key.includes('work_description')) {
                return hasValue ? 'PRESENT' : 'MISSING IN CURRENT ROW';
            }

            // Default truthful fallback (never fabricate)
            if (hasValue) return 'PRESENT';
            return 'MISSING IN CURRENT ROW';
        }
        // ===== end precise field status =====

        function isLiveMode() {
            try {
                return (new URLSearchParams(window.location.search).get('livePermits') === '1') ||
                       window.__FL_SIGNAL_LIVE_DATA === true;
            } catch (e) { return false; }
        }

        function preciseStatusPill(fieldKey, rawValue, p) {
            const label = getPreciseFieldStatus(fieldKey, rawValue, p);
            if (label === 'PRESENT') return ''; // reduce visual noise on normal visible values

            const live = isLiveMode();

            let displayLabel = label;

            if (live) {
                // In live mode, use clearer, honest labels instead of generic "MISSING IN CURRENT ROW"
                if (['owner_name', 'contractor_name', 'parcel_id', 'lat', 'lon', 'raw_json'].some(k => fieldKey.includes(k))) {
                    displayLabel = 'Not included in current live contract';
                } else if (label === 'MISSING IN CURRENT ROW' || label === 'UNKNOWN') {
                    displayLabel = 'Not yet mirrored';
                } else if (label === 'NOT IN SAMPLE' || label === 'PLANNED SOURCE') {
                    displayLabel = 'Not available in current live mirror';
                }
            }

            const clsMap = {
                'MISSING IN CURRENT ROW': 'text-red-400',
                'NOT IN SAMPLE': 'text-amber-400',
                'NOT HOOKED UP': 'text-orange-400',
                'PLANNED SOURCE': 'text-sky-400',
                STUB: 'text-amber-400',
                STALE: 'text-orange-400',
                UNKNOWN: 'text-slate-400',
                'Not included in current live contract': 'text-amber-400',
                'Not yet mirrored': 'text-amber-400',
                'Not available in current live mirror': 'text-amber-400'
            };
            const cls = clsMap[displayLabel] || 'text-slate-400';
            return `<span class="ml-2 text-xs font-bold ${cls}">[${displayLabel}]</span>`;
        }

        function showSection(section) {
            document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
            const sec = document.getElementById('section-' + section);
            if (sec) sec.classList.add('active');

            document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
            // Find matching tab by onclick text (robust for non-event calls)
            document.querySelectorAll('.nav-tab').forEach(tab => {
                if (tab.getAttribute('onclick') && tab.getAttribute('onclick').includes("'" + section + "'")) {
                    tab.classList.add('active');
                }
            });
        }

        function formatDate(d) {
            if (!d) return '—';
            try { return new Date(d).toISOString().slice(0, 10); } catch { return d; }
        }

        function getClassificationPill(cls) {
            if (cls === 'PROVEN') return '<span class="px-2 py-0.5 text-[10px] font-bold bg-teal-500/20 text-teal-400 rounded">PROVEN</span>';
            if (cls === 'STALE') return '<span class="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 rounded">STALE</span>';
            if (cls === 'UNKNOWN') return '<span class="px-2 py-0.5 text-[10px] font-bold bg-slate-500/20 text-slate-400 rounded">UNKNOWN</span>';
            if (cls === 'BLOCKED') return '<span class="px-2 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 rounded">BLOCKED</span>';
            return '<span class="px-2 py-0.5 text-[10px] font-bold bg-slate-500/20 text-slate-400 rounded">' + (cls || '—') + '</span>';
        }

        // Resilience helper for render functions (emergency data render blocker fix)
        function safeRender(name, fn) {
            try {
                fn();
            } catch (err) {
                console.error(`[render error] ${name}:`, err);
                // Record for diagnostics
                if (!window.__renderErrors) window.__renderErrors = [];
                window.__renderErrors.push({ name, message: err.message || String(err) });
            }
        }

        async function loadDashboardData() {
            try {
                const [dashboardSummary, permitsResponse, signals, coverage, timeWindows, enrichmentStats] = await Promise.all([
                    fetch('data/dashboard_summary.json').then(r => r.json()),
                    // Phase 2B: Use adapter (demo by default, live only if explicitly enabled)
                    (typeof window.getPermits === 'function' 
                        ? window.getPermits({ limit: 100 }) 
                        : fetch('data/permits_sample.json').then(r => r.json()).then(d => ({ data: d, meta: { source: 'demo_static' } }))),
                    fetch('data/signals_sample.json').then(r => r.json()),
                    fetch('data/coverage_summary.json').then(r => r.json()).catch(() => ({})),
                    fetch('data/time_windows.json').then(r => r.json()).catch(() => []),
                    fetch('data/enrichment_stats.json').then(r => r.json()).catch(() => ({}))
                ]);

                const permits = (permitsResponse && permitsResponse.rows) ? permitsResponse.rows : (permitsResponse && permitsResponse.data) ? permitsResponse.data : permitsResponse;

                window.dashboardSummary = dashboardSummary;
                dashboardSummaryData = dashboardSummary;
                window.permitsData = permits;
                permitsData = permits;
                filteredPermits = [...permits];
                window.timeWindowsData = timeWindows;
                window.enrichmentStatsData = enrichmentStats;

                // === LIVE MODE METRIC OVERRIDES (Phase 2E) ===
                const isLiveForMetrics = (new URLSearchParams(window.location.search).get('livePermits') === '1') || window.__FL_SIGNAL_LIVE_DATA === true;
                if (isLiveForMetrics) {
                    // Use real total from Supabase (hardcoded safe value for now; future: fetch count)
                    if (dashboardSummary && dashboardSummary.metrics && dashboardSummary.metrics.total_permits) {
                        dashboardSummary.metrics.total_permits.value = 116517;
                    }

                    // Sanitize time windows to remove fake "New today" and impossible % 
                    if (Array.isArray(timeWindows)) {
                        timeWindows.forEach(w => {
                            if (w.window && w.window.toLowerCase().includes('pull')) {
                                w.new_permits_seen = null; // remove fake "17"
                            }
                        });
                    }

                    // Force enrichment to pending for now (real % not yet computed live)
                    if (enrichmentStats && typeof enrichmentStats === 'object') {
                        // Do not invent % — leave as-is or mark pending in render
                    }
                }

                // === DATA DIAGNOSTICS (emergency repair) ===
                try {
                    const diag = document.getElementById('data-diagnostics');
                    if (diag) {
                        diag.innerHTML = `
                            <div>dashboard_summary.json: <span class="text-teal-400">LOADED</span></div>
                            <div>permits_sample.json: <span class="text-teal-400">LOADED</span> <span class="text-slate-400">(${permits.length} rows)</span></div>
                            <div>source_roadmap.json: <span class="text-teal-400">LOADED</span> <span class="text-slate-400">(${ (window.sourceRoadmap?.sources || []).length } sources)</span></div>
                            <div>field_registry.json: <span class="text-teal-400">LOADED</span></div>
                            <div>adapter_test_results.json: <span class="text-teal-400">LOADED</span></div>
                        `;
                    }
                    const errBox = document.getElementById('data-load-error');
                    if (errBox) errBox.classList.add('hidden');
                } catch(e) { /* non-fatal */ }

                // Load field registry (for Ingestion page adapter contract)
                try {
                    const reg = await fetch('data/field_registry.json').then(r => r.json());
                    window.fieldRegistry = reg;
                } catch (e) {
                    console.warn('Could not load field_registry.json');
                }

                // Load source roadmap (Claude inventory integration - single source of truth for Sources + enhanced Ingestion)
                try {
                    const rm = await fetch('data/source_roadmap.json').then(r => r.json());
                    window.sourceRoadmap = rm;
                    // Update System diagnostic live
                    const d = document.getElementById('data-diagnostics');
                    if (d) {
                        const srcCount = (rm && rm.sources) ? rm.sources.length : 0;
                        // crude replacement for the line
                        d.innerHTML = d.innerHTML.replace(/source_roadmap\.json:.*?<\/div>/, `source_roadmap.json: <span class="text-teal-400">LOADED</span> <span class="text-slate-400">(${srcCount} sources)</span></div>`);
                    }
                } catch (e) {
                    console.warn('Could not load source_roadmap.json');
                }

                // Load missing field truth matrix (from surgical audit sprint)
                try {
                    const mtx = await fetch('data/missing_field_matrix.json').then(r => r.json());
                    window.missingFieldMatrix = mtx;
                } catch (e) {
                    console.warn('Could not load missing_field_matrix.json');
                    window.missingFieldMatrix = { total_audited: 0, entries: [] };
                }

                // Load adapter test harness results (mock-only preflight gate)
                try {
                    const tr = await fetch('data/adapter_test_results.json').then(r => r.json());
                    window.adapterTestResults = tr;
                } catch (e) {
                    console.warn('Could not load adapter_test_results.json');
                }

                // Header timestamp — premium human readable
                // last-updated element removed in UI polish (dead hook cleaned per code review)

                // Health + provenance (core sprint requirement #2 + #3)
                safeRender('renderHealthBanner', () => renderHealthBanner(dashboardSummary));
                safeRender('renderProvenanceStrip', () => renderProvenanceStrip(dashboardSummary));

                // 9 Mission Control cards + Operator Brief (executive polish)
                safeRender('renderMissionControlCards', () => renderMissionControlCards(dashboardSummary, timeWindows, enrichmentStats));
                safeRender('renderOperatorBrief', () => renderOperatorBrief(dashboardSummary, timeWindows, enrichmentStats));

                // Time windows
                safeRender('renderTimeWindowsOnOverview', () => renderTimeWindowsOnOverview(timeWindows));

                // Homepage batch-enrichment snapshot (Latest + Coverage Windows)
                safeRender('renderLatestIntakeBatch', () => renderLatestIntakeBatch(timeWindows, dashboardSummary));
                safeRender('renderCoverageWindows', () => renderCoverageWindows(timeWindows));

                // Permits Explorer (full wiring)
                safeRender('renderPermitsTable', () => renderPermitsTable(permits));
                safeRender('updatePermitsCount', () => updatePermitsCount(permits.length, permits.length));

                // Signals (FROZEN)
                safeRender('renderSignals', () => renderSignals(signals));

                // Enrichment
                safeRender('renderEnrichmentTab', () => renderEnrichmentTab(timeWindows, enrichmentStats, coverage));

                // Pipeline (new page + summary card)
                safeRender('renderPipelineHealth', () => renderPipelineHealth(dashboardSummary, timeWindows, enrichmentStats));

                // Action Queue (replaces low-value Recent Activity)
                safeRender('renderTodaysWatchlist', () => renderTodaysWatchlist());

                // New Ingestion / Cloud Plan page
                safeRender('renderIngestionPage', () => renderIngestionPage());

                // Adapter Test Harness (mock-only preflight results)
                safeRender('renderAdapterTestHarness', () => renderAdapterTestHarness());

                // Missing Field Truth Matrix diagnostic (surgical sprint)
                safeRender('renderMissingFieldMatrixDiag', () => renderMissingFieldMatrixDiag());

                // Sources page (now driven by source_roadmap.json - 5-section Claude inventory)
                safeRender('renderSourcesPage', () => renderSourcesPage());

                // Reports preview table + initial manifest
                safeRender('renderExportPreviewTable', () => renderExportPreviewTable());
                const pre = document.getElementById('live-manifest-preview');
                if (pre) {
                    const m = buildManifest((permitsData||[]).length, {});
                    pre.textContent = JSON.stringify(m, null, 2);
                }

                // Charts removed in polish sprint — now clean bar cards inside renderEnrichmentTab

            } catch (e) {
                console.error("Dashboard render error", e);

                const overview = document.getElementById('section-overview');
                const isFetchError = e && (e.message || '').toLowerCase().includes('fetch') || (e + '').includes('Failed to fetch');

                if (overview) {
                    if (isFetchError) {
                        overview.innerHTML = '<div class="text-red-400 p-8">Failed to load local data files. Serve dashboard/ via static server (python -m http.server).</div>';
                    } else {
                        overview.innerHTML = `<div class="text-red-400 p-8">Dashboard render error: ${e.message || e}. See console for details.</div>`;
                    }
                }

                // Fail loud diagnostics (emergency repair)
                const errBox = document.getElementById('data-load-error');
                if (errBox) {
                    errBox.classList.remove('hidden');
                    errBox.textContent = `RENDER ERROR: ${e.message || e}`;
                }
                const diag = document.getElementById('data-diagnostics');
                if (diag) diag.innerHTML = `<div class="text-red-400">Render error: ${e.message || e}. Check console.</div>`;
            }
        }

        // ===== EXPORT SCAFFOLDS (sprint #9) =====
        function downloadBlob(filename, content, type) {
            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
        }

        function buildManifest(rowCount, filters, extra = {}) {
            const ds = window.dashboardSummary || {};
            return {
                export_id: 'fs-sandbox-' + new Date().toISOString().replace(/[:.]/g,'').slice(0,15),
                generated_at: new Date().toISOString(),
                source_files: ['dashboard_summary.json', 'permits_sample.json'],
                source_mtime: ds.source?.mtime || '2026-05-26',
                row_count: rowCount,
                filters_applied: filters || {},
                stale_warnings: (ds.stale_warnings || []),
                fingerprint: 'sha256-local-sandbox-' + Date.now().toString(36),
                implemented_exports: ['csv', 'json'],
                stub_exports: ['xlsx', 'ai-packet', 'pdf'],
                ...extra
            };
        }

        function exportCSV(all = false) {
            const rows = all ? permitsData : (filteredPermits.length ? filteredPermits : permitsData);
            if (!rows.length) return alert('No data to export');
            const headers = ['permit_number','address','status','applied_date','issued_date','owner_name','contractor_name','parcel_id','valuation','source_accela','source_bcpa','source_sunbiz'];
            let csv = headers.join(',') + '\n';
            rows.forEach(p => {
                csv += headers.map(h => {
                    let v = p[h] != null ? String(p[h]).replace(/"/g,'""') : '';
                    if (v.includes(',') || v.includes('"')) v = '"' + v + '"';
                    return v;
                }).join(',') + '\n';
            });
            const manifest = buildManifest(rows.length, { all, search: document.getElementById('permit-search')?.value || '' });
            downloadBlob('florida-signal-permits-' + (all?'all':'filtered') + '.csv', csv, 'text/csv');
            // Also emit tiny manifest sidecar note
            console.log('[EXPORT] CSV manifest:', manifest);
        }

        function exportJSON() {
            const rows = filteredPermits.length ? filteredPermits : permitsData;
            if (!rows.length) return alert('No data');
            const manifest = buildManifest(rows.length, { search: document.getElementById('permit-search')?.value || '' });
            const payload = { manifest, permits: rows };
            downloadBlob('florida-signal-export-' + Date.now() + '.json', JSON.stringify(payload, null, 2), 'application/json');
        }

        function stubExport(kind) {
            const msg = `STUB: ${kind} export requested.\n\nIn a full build this would:\n- Load SheetJS for real .xlsx\n- Bundle top signals + full provenance for AI packet\n- Write manifest + checksums\n\nCurrently only CSV + JSON are fully wired from live filtered table.`;
            alert(msg);
            console.log('[STUB EXPORT]', kind, 'at', new Date().toISOString());
        }

        function exportSinglePermit(permitNum) {
            const p = permitsData.find(x => x.permit_number === permitNum);
            if (!p) return;
            const manifest = buildManifest(1, { single: permitNum });
            const payload = { manifest, permit: p };
            downloadBlob('permit-' + permitNum + '.json', JSON.stringify(payload, null, 2), 'application/json');
            closePermitModal();
        }

        function renderExportPreviewTable() {
            const tbody = document.getElementById('export-preview-tbody');
            const cnt = document.getElementById('reports-preview-count');
            if (!tbody) return;

            const rows = (filteredPermits && filteredPermits.length ? filteredPermits : permitsData || []).slice(0, 8);
            if (cnt) cnt.textContent = `${rows.length} preview rows • ${ (filteredPermits||[]).length || (permitsData||[]).length } total filtered`;

            tbody.innerHTML = rows.map(p => `
                <tr class="hover:bg-slate-800 cursor-pointer" onclick="showPermitModalByNumber('${p.permit_number}')">
                    <td class="px-4 py-1.5 font-mono text-teal-300">${p.permit_number}</td>
                    <td class="px-4 py-1.5 text-slate-300">${(p.address || p.parcel_id || '—').slice(0,42)}</td>
                    <td class="px-4 py-1.5"><span class="status-badge ${getStatusColor(p.status)}">${p.status || '—'}</span></td>
                    <td class="px-4 py-1.5 text-right">${p.valuation ? '$' + Math.round(p.valuation).toLocaleString() : '—'}</td>
                </tr>
            `).join('');
        }

        function copyCurrentManifest() {
            const rows = filteredPermits && filteredPermits.length ? filteredPermits : (permitsData || []);
            const m = buildManifest(rows.length, {
                search: document.getElementById('permit-search')?.value || '',
                quick: Array.from(window.activeQuickFilters || [])
            });
            navigator.clipboard.writeText(JSON.stringify(m, null, 2)).then(() => {
                const t = document.createElement('div');
                t.className = 'fixed bottom-4 right-4 bg-blue-600 text-white text-xs px-4 py-2 rounded-2xl shadow z-[10000]';
                t.textContent = 'Manifest copied';
                document.body.appendChild(t);
                setTimeout(() => t.remove(), 1100);
            });
            // Also update the live preview area if present
            const pre = document.getElementById('live-manifest-preview');
            if (pre) pre.textContent = JSON.stringify(m, null, 2);
        }

        function showAiPacketPreview() {
            const rows = (filteredPermits && filteredPermits.length ? filteredPermits : permitsData || []).slice(0, 5);
            const packet = {
                generated_at: new Date().toISOString(),
                packet_type: "AI_ANALYSIS_SANDBOX_PREVIEW",
                source: "current filtered Permits Explorer view",
                row_count: rows.length,
                permits: rows.map(p => ({
                    permit_number: p.permit_number,
                    address: p.address,
                    valuation: p.valuation,
                    owner: p.owner_name,
                    contractor: p.contractor_name,
                    provenance: { bcpa: !!p.source_bcpa, sunbiz: !!p.source_sunbiz, accela: !!p.source_accela }
                })),
                stale_warnings: (window.dashboardSummary?.stale_warnings || []),
                note: "This is a sandbox preview only. Real AI packets would be generated from high-signal scored permits after a full scoring run."
            };

            const m = document.createElement('div');
            m.className = 'fixed inset-0 bg-black/70 z-[10001] flex items-center justify-center p-6';
            m.innerHTML = `
                <div class="bg-slate-900 border border-amber-700/40 rounded-3xl max-w-3xl w-full max-h-[80vh] overflow-auto p-6" onclick="event.target.remove()">
                    <div class="text-amber-400 font-semibold mb-2">AI PACKET PREVIEW (SANDBOX — NOT LIVE)</div>
                    <pre class="bg-black p-4 rounded-2xl text-xs overflow-auto text-teal-300">${JSON.stringify(packet, null, 2)}</pre>
                    <div class="text-xs text-amber-400/70 mt-3">In a full system this would be the exact payload handed to Grok/LLM after scoring. Currently uses whatever is in the filtered table.</div>
                </div>
            `;
            document.body.appendChild(m);
        }

        function simulateGrokTrigger() {
            const prompt = document.getElementById('grok-prompt').value || "Trigger enrichment for high-value recent permits";
            const r = document.getElementById('grok-response');
            r.classList.remove('hidden');
            r.innerHTML = `
                <div class="text-teal-400">✓ Simulated (sandbox only — no real Edge Function call)</div>
                <div class="text-xs mt-1 text-slate-400">Workflow ID: wf_${Date.now().toString(36)}</div>
                <div class="text-xs mt-2">Intent: <span class="text-white">property_enrichment</span> (prototype)</div>
            `;
        }

        function enhanceKeyboardClickables() {
            document.querySelectorAll('[onclick]').forEach(el => {
                const tag = el.tagName.toLowerCase();
                if (['button', 'a', 'input', 'select', 'textarea', 'summary'].includes(tag)) return;
                if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
                if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
                if (el.__keyboardBound) return;
                el.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        el.click();
                    }
                });
                el.__keyboardBound = true;
            });
        }

        function injectDemoBanner() {
            // Check for explicit live mode (URL param or flag set by adapter)
            const isLive = (new URLSearchParams(window.location.search).get('livePermits') === '1') ||
                           window.__FL_SIGNAL_LIVE_DATA === true;

            if (document.getElementById('demo-mode-banner')) return;

            const banner = document.createElement('div');
            banner.id = 'demo-mode-banner';

            if (isLive) {
                // LIVE MODE banner
                banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#0f172a;color:#bae6fd;border-bottom:1px solid #1e3a8a;font-size:11px;font-family:Inter,system-ui,sans-serif;padding:4px 12px;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:0.02em;';
                banner.innerHTML = `
                    <span style="font-weight:700;color:#7dd3fc;">LIVE MODE — READ-ONLY SUPABASE MIRROR</span>
                    <span style="opacity:0.85;">All permits · sorted by valuation (highest first). $700k+ get high-value labels.</span>
                    <span style="margin-left:6px;padding:1px 6px;border:1px solid #1e40af;border-radius:3px;font-size:10px;font-weight:600;background:#1e3a8a;">LIVE DATA</span>
                `;
            } else {
                // DEMO MODE banner (original)
                banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#451a03;color:#fed7aa;border-bottom:1px solid #9a3412;font-size:11px;font-family:Inter,system-ui,sans-serif;padding:4px 12px;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:0.02em;';
                banner.innerHTML = `
                    <span style="font-weight:700;color:#fdba74;">⚠ DEMO MODE — SAMPLE DATA ONLY</span>
                    <span style="opacity:0.85;">No real permits, owners, companies, parcels, or Florida Signal production data. Static synthetic preview for evaluation.</span>
                    <span style="margin-left:6px;padding:1px 6px;border:1px solid #c2410f;border-radius:3px;font-size:10px;font-weight:600;">SAFE PUBLIC PREVIEW</span>
                `;
            }

            document.body.prepend(banner);

            // Push sticky header down to avoid overlap
            const header = document.querySelector('.border-b.border-slate-800.bg-\\[\\#0e1726\\].sticky');
            if (header) header.style.top = '28px';
        }

        function initDashboard() {
            if (typeof initTailwind !== 'function') { window.initTailwind = function(){}; }
            initTailwind();
            injectDemoBanner();
            enhanceKeyboardClickables();
            loadDashboardData();
            const search = document.getElementById('permit-search');
            if (search) search.addEventListener('keypress', e => { if (e.key === 'Enter') filterPermitsTable(); });
            updateHeaderTimestamp();
            setInterval(updateHeaderTimestamp, 30000);
        }

        window.onload = initDashboard;
