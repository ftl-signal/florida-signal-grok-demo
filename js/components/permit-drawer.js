        // ===== PERMIT DETAIL DRAWER (full case file with tabs) =====
        let currentDrawerPermit = null;
        let currentDrawerTab = 'overview';

        function isLiveModeForDrawer() {
            try {
                return (new URLSearchParams(window.location.search).get('livePermits') === '1') ||
                       window.__FL_SIGNAL_LIVE_DATA === true;
            } catch (e) { return false; }
        }

        function switchDrawerTab(tab) {
            currentDrawerTab = tab;
            document.querySelectorAll('#drawer-tabs .drawer-tab').forEach(el => {
                el.classList.toggle('active', el.dataset.tab === tab);
            });
            renderDrawerTabContent();
        }

        function renderDrawerTabContent() {
            const content = document.getElementById('permit-modal-content');
            if (!content || !currentDrawerPermit) return;
            const p = currentDrawerPermit;

            const val = p.valuation ? '$' + Math.round(p.valuation).toLocaleString() : '—';
            const provBadges = [];
            if (p.source_accela) provBadges.push(`Accela ${formatDate(p.source_accela)}`);
            if (p.source_bcpa) provBadges.push(`BCPA ${formatDate(p.source_bcpa)}`);
            if (p.source_sunbiz) provBadges.push(`Sunbiz ${formatDate(p.source_sunbiz)}`);

            let html = '';

            if (currentDrawerTab === 'overview') {
                html = `
                    <div class="space-y-5">
                        ${isLiveModeForDrawer() ? `
                            <div class="text-[10px] bg-blue-950 border border-blue-800 text-blue-300 px-3 py-1 rounded text-center">
                                Read-only Supabase mirror • Not the full Mac source-of-truth case file yet
                            </div>
                        ` : ''}
                        <div>
                            <div class="text-teal-400 text-xs tracking-widest">PERMIT</div>
                            <div class="font-mono text-3xl font-semibold tracking-[-1.5px] mt-0.5">${p.permit_number}</div>
                            <div class="text-xs text-teal-400 mt-0.5">${(() => { const d=decodePermitCode(p.permit_number); return d.display + ' <span class="text-[10px] opacity-70">['+d.confidence+']</span>'; })()}</div>
                            <div class="flex gap-2 mt-1 items-center">
                                <span class="status-badge ${getStatusColor(p.status)}">${p.status || (isLiveModeForDrawer() ? 'Not available' : 'UNKNOWN')}</span>
                                <span class="text-xs text-slate-400">Applied ${p.applied_date || '—'} • Issued ${p.issued_date || '—'}</span>
                            </div>
                            <div class="text-lg mt-2">${p.address || '<span class="text-amber-400">—</span>'} ${preciseStatusPill('address', p.address, p)}</div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-slate-950 border border-slate-700 rounded-2xl p-4">
                                <div class="text-xs text-slate-400">VALUATION</div>
                                <div class="text-2xl font-semibold">${val}</div>
                                ${(() => { 
                                    const t = getValuationTier(p.valuation); 
                                    if (t.label !== 'MISSING') return `<div class="text-xs ${t.cls} mt-0.5">${t.label}</div>`;
                                    const live = isLiveModeForDrawer();
                                    return live 
                                        ? '<div class="text-xs text-amber-400 mt-0.5">Not yet mirrored</div>' 
                                        : '<div class="text-xs text-red-400 mt-0.5">MISSING IN CURRENT ROW — no valuation in row</div>'; 
                                })()}
                            </div>
                            <div class="bg-slate-950 border border-slate-700 rounded-2xl p-4">
                                <div class="text-xs text-slate-400">PARCEL</div>
                                <div class="font-medium">${p.parcel_id || '<span class="text-amber-400">—</span>'} ${preciseStatusPill('parcel_id', p.parcel_id, p)}</div>
                            </div>
                        </div>

                        <div>
                            <div class="text-xs text-slate-400 mb-1">OWNER</div>
                            ${isLiveModeForDrawer() && p.owner_resolution && p.owner_resolution.resolved_owner_name ? `
                                <div class="font-medium">${p.owner_resolution.resolved_owner_name} 
                                    <span class="text-[10px] text-teal-400">[Reviewed owner resolution]</span>
                                </div>
                                <div class="text-[10px] text-slate-400 mt-0.5">
                                    Source: ${p.owner_resolution.resolved_owner_source || '—'} 
                                    • Confidence: ${p.owner_resolution.confidence || '—'}
                                    ${p.owner_resolution.resolved_at ? ' • ' + formatDate(p.owner_resolution.resolved_at) : ''}
                                </div>
                            ` : `
                                <div class="font-medium">${p.owner_name || '<span class="text-amber-400">—</span>'} ${preciseStatusPill('owner_name', p.owner_name, p)}</div>
                                ${isLiveModeForDrawer() ? '<div class="text-[10px] text-amber-400 mt-0.5">Not included in current live contract (owner resolution pending in mirror)</div>' : ''}
                            `}
                        </div>
                        <div>
                            <div class="text-xs text-slate-400 mb-1">CONTRACTOR</div>
                            <div class="font-medium">${p.contractor_name || '<span class="text-amber-400">—</span>'} ${preciseStatusPill('contractor_name', p.contractor_name, p)}</div>
                            <div class="text-xs text-slate-400">${p.applicant_name || ''}</div>
                            ${isLiveModeForDrawer() && !p.contractor_name ? '<div class="text-[10px] text-amber-400 mt-0.5">Not included in current live contract</div>' : ''}
                        </div>

                        <!-- PRIMARY CTA: Open Full Case File (prominent, top half) -->
                        <div class="pt-1">
                            <button onclick="openFullCaseFile()" 
                                    class="w-full px-5 py-2.5 text-sm bg-teal-500 hover:bg-teal-600 text-black font-bold rounded-2xl flex items-center justify-center gap-2">
                                <i class="fa-solid fa-file-lines"></i>
                                Open Full Case File
                            </button>
                            <div class="text-center text-[10px] text-teal-400/90 mt-1 leading-tight">
                                Full source detail: Accela, BCPA, Sunbiz, Broward Clerk, owner resolution, provenance
                            </div>
                        </div>

                        <div class="bg-slate-950 border border-slate-700 rounded-2xl p-4 text-xs">
                            <div class="text-teal-400 mb-1">
                                ${isLiveModeForDrawer() ? 'MIRROR GAPS' : 'GAPS (see precise labels in Full Case File)'}
                            </div>
                            ${isLiveModeForDrawer() ? `
                                ${!p.address ? '• Address — Not yet mirrored<br>' : ''}
                                ${!p.parcel_id ? '• Parcel ID — Not included in current live contract<br>' : ''}
                                ${!p.owner_name ? '• Owner — Not included in current live contract<br>' : ''}
                                ${!p.source_bcpa ? '• BCPA enrichment — Not yet mirrored<br>' : ''}
                                ${!p.source_sunbiz ? '• Sunbiz enrichment — Not yet mirrored<br>' : ''}
                                ${(!p.lat || !p.lon) ? '• Geocode (lat/lon) — Not yet mirrored<br>' : ''}
                            ` : `
                                ${!p.address ? '• Address (MISSING IN CURRENT ROW)<br>' : ''}
                                ${!p.parcel_id ? '• Parcel ID<br>' : ''}
                                ${!p.owner_name ? '• Owner (MISSING IN CURRENT ROW)<br>' : ''}
                                ${!p.source_bcpa ? '• BCPA enrichment (MISSING IN CURRENT ROW)<br>' : ''}
                                ${!p.source_sunbiz ? '• Sunbiz enrichment (MISSING IN CURRENT ROW)<br>' : ''}
                                ${(!p.lat || !p.lon) ? '• Geocode (lat/lon) — STALE per dashboard_summary<br>' : ''}
                            `}
                            ${p.last_enriched_at ? '' : '• Last enriched timestamp'}
                        </div>

                        <div class="text-[10px] text-slate-400 border-l-2 border-slate-700 pl-2">
                            Permit codes are local Accela/category codes. Decoder translates known prefixes (e.g. BLD = Building, COC = Certificate/completion [LIKELY]) and marks uncertain codes UNKNOWN. See Full Case File → Permit tab for more.
                        </div>
                    </div>
                `;
            } else if (currentDrawerTab === 'sources') {
                html = `
                    <div class="space-y-4">
                        <div>
                            <div class="text-xs text-slate-400 mb-2">PROVENANCE TIMESTAMPS (from READONLY snapshot)</div>
                            <div class="flex flex-wrap gap-2">${provBadges.length ? provBadges.map(b => `<span class="px-3 py-1 bg-slate-800 rounded-2xl text-xs">${b}</span>`).join('') : '<span class="text-slate-500">No source timestamps present for this record</span>'}</div>
                        </div>
                        <div class="text-xs bg-slate-950 border border-slate-700 rounded-2xl p-4">
                            <div>Last enriched: <span class="font-mono">${p.last_enriched_at || (isLiveModeForDrawer() ? 'Not yet mirrored' : 'UNKNOWN')}</span></div>
                            <div class="mt-2 text-amber-400">
                                ${isLiveModeForDrawer() 
                                    ? 'Note: Timestamps from the live Supabase read-only mirror. Some enrichment data may still be pending.'
                                    : 'Note: These are the enrichment fetch times recorded in the snapshot. Geocode cache is known STALE (2026-05-05).'}
                            </div>
                        </div>
                        <div>
                            <div class="text-xs text-slate-400">Source confidence (heuristic for this sandbox sample)</div>
                            <div class="text-xs mt-1">Accela: High (primary source) • BCPA/Sunbiz: Medium when present • Geocode: Low (stale)</div>
                        </div>
                    </div>
                `;
            } else if (currentDrawerTab === 'export') {
                html = `
                    <div class="space-y-4">
                        <div class="text-xs text-slate-400">Generate clean, copyable artifacts for this permit (all client-side, sandbox only).</div>
                        <div class="flex flex-wrap gap-3">
                            <button onclick="copyPermitMarkdownSummary()" class="px-5 py-2 bg-blue-600 text-white font-semibold rounded-2xl text-sm">Copy Markdown Summary</button>
                            <button onclick="showJsonPacketPreview()" class="px-5 py-2 bg-slate-800 border border-slate-600 rounded-2xl text-sm">Preview JSON Packet</button>
                            <button onclick="exportSinglePermit('${p.permit_number}')" class="px-5 py-2 bg-teal-600 text-black rounded-2xl text-sm">Download JSON (live)</button>
                            <button onclick="stubExport('Permit PDF ${p.permit_number}')" class="px-5 py-2 bg-amber-900/40 border border-amber-700/50 rounded-2xl text-sm">PDF (STUB)</button>
                        </div>
                        <div class="mt-4 pt-4 border-t border-slate-700">
                            <button onclick="openFullCaseFile()" 
                                    class="w-full px-5 py-2.5 text-sm bg-teal-500 hover:bg-teal-600 text-black font-bold rounded-2xl flex items-center justify-center gap-2">
                                <i class="fa-solid fa-file-lines"></i>
                                Open Full Case File
                            </button>
                            <div class="text-center text-[10px] text-teal-400/80 mt-1.5">Rich source depth • 9 tabs • old Claude field inventory</div>
                        </div>
                        <div class="text-[10px] text-amber-400/80">
                            ${isLiveModeForDrawer() 
                                ? 'Exports use live mirror data where available. Some fields remain limited in the current Supabase contract.'
                                : 'All exports include the manifest fields defined in the Reports tab. No production systems are called.'}
                        </div>
                    </div>
                `;
            } else if (currentDrawerTab === 'notes') {
                html = `
                    <div class="space-y-4 text-sm">
                        <div class="bg-slate-950 border border-slate-700 rounded-2xl p-4">
                            <div class="text-teal-400 text-xs mb-2">
                                ${isLiveModeForDrawer() ? 'AI / OPERATOR NOTES (live mirror)' : 'AI / OPERATOR NOTES (sandbox scaffolding)'}
                            </div>
                            <div class="text-slate-300">This permit ${p.address ? 'has a usable address' : 'is missing address — high priority for cleanup'} and ${p.source_bcpa ? 'has BCPA match' : 'lacks BCPA match'}.</div>
                            <div class="mt-3 text-xs text-slate-400">
                                ${isLiveModeForDrawer() 
                                    ? 'Note: This is a read-only Supabase mirror. Full case file depth is limited until more enrichment is mirrored.'
                                    : 'Future: This area will hold Grok-generated risk notes or operator annotations once the packet export + scoring workflow is live.'}
                            </div>
                        </div>
                        <div class="text-[10px]">Packet-ready fields are complete in the JSON preview. Use the Export tab to generate the exact packet the future scoring run will consume.</div>
                    </div>
                `;
            }

            content.innerHTML = html;
        }

        function showPermitModal(permit) {
            const modal = document.getElementById('permit-modal');
            const drawer = document.getElementById('permit-drawer');
            const content = document.getElementById('permit-modal-content');
            if (!modal || !content) return;

            currentDrawerPermit = permit;
            currentDrawerTab = 'overview';

            // Phase 3A: If in live mode, fetch richer detail from server
            const isLive = (new URLSearchParams(window.location.search).get('livePermits') === '1') ||
                           window.__FL_SIGNAL_LIVE_DATA === true;

            if (isLive && permit && permit.permit_number) {
                fetchLivePermitDetail(permit.permit_number).then(detail => {
                    if (detail && detail.permit) {
                        // Merge live detail over the list row (list row has limited fields)
                        currentDrawerPermit = { ...permit, ...detail.permit };
                        renderDrawerTabContent();
                    }
                }).catch(() => {
                    // Silently keep the list row data + honest labels in render
                });
            }

            // Tiny smoke check
            const smokeDrawer = document.getElementById('smoke-drawer-permit');
            if (smokeDrawer) smokeDrawer.textContent = permit ? permit.permit_number : '—';

            // Update header
            const header = document.getElementById('drawer-header');
            if (header) {
                const val = permit.valuation ? '$' + Math.round(permit.valuation).toLocaleString() : '';
                header.innerHTML = `<span class="font-mono">${permit.permit_number}</span> <span class="text-xs text-teal-400/70 ml-2">${permit.status || ''} ${val}</span>`;
            }

            // Activate first tab
            document.querySelectorAll('#drawer-tabs .drawer-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === 'overview'));

            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(() => drawer && drawer.classList.add('open'), 10);

            // Render initial tab (immediate + delayed for animation safety)
            renderDrawerTabContent();
            setTimeout(renderDrawerTabContent, 30);

            // Trust fix: if Full Case File is open when a new row is clicked, close it to prevent stale content on the old permit
            const fcf = document.getElementById('full-case-file-modal');
            if (fcf && (fcf.style.display === 'flex' || !fcf.classList.contains('hidden'))) {
                if (typeof closeFullCaseFile === 'function') closeFullCaseFile();
            }
        }

        function showPermitModalByNumber(num) {
            const p = (permitsData || []).find(x => x.permit_number === num);
            if (p) showPermitModal(p);
        }

        async function fetchLivePermitDetail(permitNumber) {
            try {
                const res = await fetch(`/api/permit-detail?permit_number=${encodeURIComponent(permitNumber)}&livePermits=1`);
                if (!res.ok) return null;
                return await res.json();
            } catch (e) {
                return null;
            }
        }

        function closePermitModal() {
            const m = document.getElementById('permit-modal');
            const d = document.getElementById('permit-drawer');
            if (d) d.classList.remove('open');
            setTimeout(() => {
                if (m) { m.classList.remove('flex'); m.classList.add('hidden'); }
                const smokeDrawer = document.getElementById('smoke-drawer-permit');
                if (smokeDrawer) smokeDrawer.textContent = '— (closed)';
            }, 260);
        }

        // Legacy thin wrapper kept for safety; real work is in the two functions below
        function copyPermitSummary(summary) {
            navigator.clipboard.writeText(summary + '\n\nSource: florida-signal-grok-lab sandbox • dashboard_summary.json driven').then(() => {
                const t = document.createElement('div');
                t.className = 'fixed bottom-4 right-4 bg-blue-600 text-white text-xs px-4 py-2 rounded-2xl shadow z-[10000]';
                t.textContent = 'Summary copied';
                document.body.appendChild(t);
                setTimeout(() => t.remove(), 1200);
            });
        }

        // New full implementations (used by the drawer Export tab)
        function copyPermitMarkdownSummary() {
            const p = currentDrawerPermit;
            if (!p) return;

            const val = p.valuation ? '$' + Math.round(p.valuation).toLocaleString() : 'MISSING';
            const lines = [
                `## Permit ${p.permit_number}`,
                '',
                `**Status:** ${p.status || (isLiveModeForDrawer() ? 'Not available' : 'UNKNOWN')}`,
                `**Address:** ${p.address || 'MISSING / UNKNOWN'}`,
                `**Applied / Issued:** ${p.applied_date || '—'} / ${p.issued_date || '—'}`,
                `**Valuation:** ${val}`,
                '',
                `**Parcel:** ${p.parcel_id || (isLiveModeForDrawer() ? 'Not included in current live contract' : 'MISSING / UNKNOWN')}`,
                `**Owner:** ${p.owner_name || (isLiveModeForDrawer() ? 'Not included in current live contract' : 'MISSING / UNKNOWN')}`,
                `**Contractor:** ${p.contractor_name || (isLiveModeForDrawer() ? 'Not included in current live contract' : 'MISSING / UNKNOWN')}${p.applicant_name ? ' (Applicant: ' + p.applicant_name + ')' : ''}`,
                '',
                '### Provenance',
                `- Accela: ${p.source_accela ? formatDate(p.source_accela) : 'MISSING'}`,
                `- BCPA: ${p.source_bcpa ? formatDate(p.source_bcpa) : 'MISSING'}`,
                `- Sunbiz: ${p.source_sunbiz ? formatDate(p.source_sunbiz) : 'MISSING'}`,
                `- Last enriched: ${p.last_enriched_at || 'UNKNOWN'}`,
                '',
                '### Warnings / Gaps',
                p.address ? '' : '- Address missing (heuristic)',
                p.parcel_id ? '' : '- Parcel missing',
                p.source_bcpa ? '' : '- No BCPA match',
                p.source_sunbiz ? '' : '- No Sunbiz match',
                (p.lat && p.lon) ? '' : '- No geocode (or stale)',
                '',
                isLiveModeForDrawer() 
                    ? '_Generated from live read-only Supabase mirror. Not the full source-of-truth case file._'
                    : '_Generated from sandbox READONLY snapshot via florida-signal-grok-lab cockpit. Not live intelligence._'
            ].filter(Boolean).join('\n');

            navigator.clipboard.writeText(lines).then(() => {
                const t = document.createElement('div');
                t.className = 'fixed bottom-4 right-4 bg-blue-600 text-white text-xs px-4 py-2 rounded-2xl shadow z-[10000]';
                t.textContent = 'Markdown summary copied';
                document.body.appendChild(t);
                setTimeout(() => t.remove(), 1400);
            });
        }

        function showJsonPacketPreview() {
            const p = currentDrawerPermit;
            if (!p) return;

            const packet = {
                generated_at: new Date().toISOString(),
                source_snapshot: "dashboard_summary.json + permits_sample.json (READONLY.sqlite)",
                permit: {
                    permit_number: p.permit_number,
                    status: p.status || null,
                    address: p.address || null,
                    applied_date: p.applied_date || null,
                    issued_date: p.issued_date || null,
                    valuation: p.valuation || null,
                    parcel_id: p.parcel_id || null,
                    region: p.region || null
                },
                owner: { name: p.owner_name || null },
                contractor: { name: p.contractor_name || null, applicant: p.applicant_name || null },
                provenance: {
                    source_accela: p.source_accela || null,
                    source_bcpa: p.source_bcpa || null,
                    source_sunbiz: p.source_sunbiz || null,
                    last_enriched_at: p.last_enriched_at || null
                },
                geocode: { lat: p.lat || null, lon: p.lon || null },
                warnings: {
                    stale_geocode: "last pull 2026-05-05 (23+ days)",
                    missing_fields: [!p.address && 'address', !p.parcel_id && 'parcel', !p.owner_name && 'owner', !p.source_bcpa && 'bcpa', !p.source_sunbiz && 'sunbiz'].filter(Boolean)
                }
            };

            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black/70 z-[10001] flex items-center justify-center p-6';
            modal.innerHTML = `
                <div class="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-auto p-6 text-xs font-mono" onclick="event.target.remove()">
                    <div class="flex justify-between mb-3">
                        <div class="text-teal-400 font-sans text-sm font-semibold">SANDBOX READONLY JSON PACKET — NOT LIVE INTELLIGENCE</div>
                        <button class="text-slate-400">CLOSE</button>
                    </div>
                    <pre class="bg-black p-4 rounded-2xl overflow-auto text-teal-300">${JSON.stringify(packet, null, 2)}</pre>
                    <div class="text-[10px] text-amber-400 mt-3">This is the exact structure a future scoring / AI packet would consume. Generated 100% client-side from current sandbox data.</div>
                </div>
            `;
            document.body.appendChild(modal);
        }

