        // ===== FULL CASE FILE (rich depth from old Claude spec) =====
        let currentFullCasePermit = null;
        let currentFullCaseTab = 'snapshot';

        function openFullCaseFile(permit) {
            currentFullCasePermit = permit || currentDrawerPermit;
            if (!currentFullCasePermit) return;

            const modal = document.getElementById('full-case-file-modal');
            document.getElementById('full-case-permit-number').textContent = currentFullCasePermit.permit_number;
            document.getElementById('full-case-address').textContent = currentFullCasePermit.address || currentFullCasePermit.parcel_id || '—';

            modal.classList.remove('hidden');
            modal.style.display = 'flex';

            // Close quick drawer if open
            closePermitModal();

            switchFullCaseTab('snapshot');
        }

        function closeFullCaseFile() {
            const modal = document.getElementById('full-case-file-modal');
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }

        function switchFullCaseTab(tab) {
            currentFullCaseTab = tab;
            document.querySelectorAll('#full-case-tabs .full-case-tab').forEach(el => {
                el.classList.toggle('active', el.dataset.tab === tab);
            });
            try {
                renderFullCaseTabContent(tab);
            } catch (err) {
                console.error('Full Case File tab render error:', err);
                const c = document.getElementById('full-case-content');
                if (c) c.innerHTML = `<div class="p-8 text-red-400">This tab failed to render: ${err.message || err}. Other tabs may still work.</div>`;
            }
        }

        function renderFullCaseTabContent(tab) {
            const container = document.getElementById('full-case-content');
            const p = currentFullCasePermit;
            if (!container || !p) return;

            const badge = (src) => `<span class="ml-2 px-1.5 py-px text-[9px] rounded bg-slate-700 text-slate-300">${src}</span>`;
            const status = (s) => {
                const map = {
                    MISSING: 'text-red-400',
                    'MISSING IN CURRENT ROW': 'text-red-400',
                    'NOT IN SAMPLE': 'text-amber-400',
                    'NOT HOOKED UP': 'text-orange-400',
                    PLANNED: 'text-sky-400',
                    'PLANNED SOURCE': 'text-sky-400',
                    STUB: 'text-amber-400',
                    STALE: 'text-orange-400',
                    UNKNOWN: 'text-slate-400'
                };
                const label = s || 'UNKNOWN';
                if (label === 'PRESENT') return ''; // reduce repetitive noise on visible values (source chips remain)
                return `<span class="ml-2 text-xs font-bold ${map[label] || ''}">[${label}]</span>`;
            };

            // Google Maps helper (external link only — no embed, no API, no key)
            // Surgical disambiguation fix: always bias to Fort Lauderdale / Broward FL
            const mapsLink = (addr) => {
                if (!addr) return `<span class="text-xs text-slate-500 ml-2">(Map unavailable — missing address)</span>`;
                let q = String(addr || '').trim();
                if (q) {
                    const hasFL = /\bFL\b/i.test(q) || /Florida/i.test(q);
                    if (!hasFL) {
                        const region = (p && p.region) ? String(p.region).toUpperCase() : '';
                        if (region.includes('FTL') || region.includes('FORT LAUDERDALE') || region.includes('LAUDERDALE')) {
                            q = q + ', Fort Lauderdale, FL';
                        } else {
                            q = q + ', Broward County, FL';
                        }
                    }
                }
                const enc = encodeURIComponent(q);
                return `<a href="https://www.google.com/maps/search/?api=1&query=${enc}" target="_blank" title="Searches address in Fort Lauderdale, FL" class="ml-2 text-xs px-2 py-0.5 bg-teal-500/10 text-teal-400 rounded hover:bg-teal-500/20">Open in Google Maps</a>`;
            };

            let html = `<div class="max-w-5xl">`;

            if (tab === 'snapshot') {
                html += `
                    <div class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div class="clean-card">
                                <div class="text-teal-400 text-xs font-semibold tracking-widest">WHAT IS THIS PERMIT?</div>
                                <div class="mt-1 text-sm">
                                    ${p.permit_number} <span class="ml-1 px-1 py-px text-[9px] rounded bg-blue-500/10 text-blue-400">Accela / Local</span> <span class="text-teal-400 text-xs">${decodePermitCode(p.permit_number).display} [${decodePermitCode(p.permit_number).confidence}]</span><br>
                                    ${p.status || 'Unknown status'} at ${p.address || 'unknown address'} ${mapsLink(p.address)} <span class="ml-1 px-1 py-px text-[9px] rounded bg-blue-500/10 text-blue-400">Accela / Local</span>
                                </div>
                            </div>
                            <div class="clean-card">
                                <div class="text-teal-400 text-xs font-semibold tracking-widest">WHY DOES IT MATTER?</div>
                                <div class="mt-1 text-sm">Valuation ${p.valuation ? '$' + Math.round(p.valuation).toLocaleString() : 'unknown'}. Region ${p.region || '—'}. Owner ${p.owner_name ? 'known' : 'missing'}.</div>
                            </div>
                        </div>

                        <div class="clean-card">
                            <div class="text-amber-400 text-xs font-semibold tracking-widest mb-1">WHAT IS MISSING?</div>
                            <div class="flex flex-wrap gap-1.5 text-xs">
                                ${!p.valuation ? '<span class="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded">Valuation (MISSING IN CURRENT ROW)</span>' : ''}
                                ${!p.address ? '<span class="px-2 py-0.5 bg-red-500/10 text-red-400 rounded">Address (MISSING IN CURRENT ROW)</span>' : ''}
                                ${!p.source_bcpa ? '<span class="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded">BCPA (MISSING IN CURRENT ROW)</span>' : ''}
                                ${!p.source_sunbiz ? '<span class="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded">Sunbiz (MISSING IN CURRENT ROW)</span>' : ''}
                                ${(!p.lat || !p.lon) ? '<span class="px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded">Geocode (STALE — 23+ days)</span>' : ''}
                                ${!p.owner_name ? '<span class="px-2 py-0.5 bg-red-500/10 text-red-400 rounded">Owner (MISSING IN CURRENT ROW)</span>' : ''}
                            </div>
                            <div class="mt-2 text-[10px] text-slate-400">Provenance sources: <span class="text-blue-400">Accela</span> (permit) • <span class="text-teal-400">BCPA</span> (parcel/owner) • <span class="text-amber-400">Sunbiz</span> (contractor)</div>
                        </div>

                        <div class="clean-card">
                            <div class="text-orange-400 text-xs font-semibold tracking-widest mb-1">WHAT IS STALE?</div>
                            <div class="text-xs text-slate-300">Geocode cache known to be 23+ days old in this snapshot. Other sources may be fresher (see Provenance tab).</div>
                        </div>

                        <div class="clean-card border border-teal-700/40">
                            <div class="text-teal-400 text-xs font-semibold tracking-widest mb-1">WHY SO MANY MISSING FIELDS?</div>
                            <div class="text-xs text-slate-300">
                                Some fields are truly missing from this permit row in the source data. Others are known fields from old specs, BCPA property cards, full Accela detail, or future sources (Broward Clerk, expanded BCPA) but are not included in the current 19-column sandbox sample (see data/missing_field_matrix.json for the full audit). Labels now distinguish <span class="text-red-400">MISSING IN CURRENT ROW</span> from <span class="text-amber-400">NOT IN SAMPLE</span>, <span class="text-sky-400">PLANNED SOURCE</span>, <span class="text-orange-400">NOT HOOKED UP</span>, and <span class="text-amber-400">STUB</span>.
                            </div>
                        </div>

                        <div class="clean-card">
                            <div class="text-teal-400 text-xs font-semibold tracking-widest mb-1">RECOMMENDED NEXT ACTION</div>
                            <div class="text-sm">Open BCPA / Provenance tabs to assess enrichment gaps. Re-run geocoding + owner resolution before using for scoring or spatial work.</div>
                        </div>
                    </div>`;
            } else if (tab === 'permit') {
                html += `
                    <div class="field-group">
                        <div class="font-semibold mb-2">Permit Core Fields</div>
                        <div class="field-row"><span class="field-label">Permit Category</span><span class="field-value">${p.permit_category || '—'} ${status('PRESENT')} ${badge('permits')}</span></div>
                        <div class="field-row"><span class="field-label">Permit Code (decoded)</span><span class="field-value">${decodePermitCode(p.permit_number).display} <span class="text-[10px]">[${decodePermitCode(p.permit_number).confidence}]</span> ${status('PRESENT')} ${badge('local decoder')}</span></div>
                        <div class="field-row"><span class="field-label">Region</span><span class="field-value">${p.region || '—'} ${status('PRESENT')} ${badge('permits')}</span></div>
                        <div class="field-row"><span class="field-label">Work Description</span><span class="field-value">${p.address ? 'Work performed at listed address' : '<span class="text-red-400">—</span>'} ${preciseStatusPill('work_description', p.address, p)} ${badge('accela_details')}</span></div>
                    </div>`;
            } else if (tab === 'owner-parcel') {
                html += `
                    <div class="field-group">
                        <div class="font-semibold mb-2">Owner &amp; Parcel (BCPA + Resolution)</div>
                        <div class="field-row"><span class="field-label">Owner Name</span><span class="field-value">${p.owner_name || '<span class="text-red-400">—</span>'} ${preciseStatusPill('owner_name', p.owner_name, p)} ${badge('owner_resolution / bcpa')}</span></div>
                        <div class="field-row"><span class="field-label">Parcel / Folio</span><span class="field-value">${p.parcel_id || '<span class="text-red-400">—</span>'} ${preciseStatusPill('parcel_id', p.parcel_id, p)} ${badge('bcpa_property_card')}</span></div>
                        <div class="field-row"><span class="field-label">Just Value</span><span class="field-value">— (rich BCPA data in full spec; not in current sample row) ${status('NOT IN SAMPLE')} ${badge('bcpa_property_card')}</span></div>
                        <div class="field-row"><span class="field-label">Maps &amp; Copy</span><span class="field-value">${mapsLink(p.address)} ${p.parcel_id ? `<button onclick="navigator.clipboard.writeText('${p.parcel_id}');alert('Folio copied');" class="ml-2 text-xs px-2 py-0.5 bg-slate-700 rounded">Copy Folio</button>` : ''} ${p.address ? `<button onclick="navigator.clipboard.writeText('${p.address}');alert('Address copied');" class="ml-1 text-xs px-2 py-0.5 bg-slate-700 rounded">Copy Address</button>` : ''}</span></div>
                    </div>`;
            } else if (tab === 'contractor-sunbiz') {
                html += `
                    <div class="field-group">
                        <div class="font-semibold mb-2">Contractor &amp; Sunbiz</div>
                        <div class="field-row"><span class="field-label">Contractor Name</span><span class="field-value">${p.contractor_name || '<span class="text-red-400">—</span>'} ${preciseStatusPill('contractor_name', p.contractor_name, p)} ${badge('accela_details')}</span></div>
                        <div class="field-row"><span class="field-label">Sunbiz Match</span><span class="field-value">${p.source_sunbiz ? 'Matched on ' + p.source_sunbiz : '<span class="text-amber-400">NOT YET MATCHED</span>'} ${preciseStatusPill('sunbiz_match', p.source_sunbiz, p)} ${badge('Sunbiz')}</span></div>
                        <div class="field-row"><span class="field-label">License #</span><span class="field-value">— (available in full Accela contractor_license per old spec) ${status('NOT HOOKED UP')} ${badge('Accela')}</span></div>
                    </div>`;
            } else if (tab === 'bcpa') {
                html += `
                    <div class="field-group">
                        <div class="font-semibold mb-2">BCPA Property Card (from old Claude spec)</div>
                        <div class="field-row"><span class="field-label">Folio</span><span class="field-value">${p.parcel_id || '—'} ${status('PRESENT')} ${badge('BCPA')}</span></div>
                        <div class="field-row"><span class="field-label">Use Code</span><span class="field-value">— (e.g. 00-01 Vacant Residential in spec examples) ${status('NOT IN SAMPLE')} ${badge('BCPA')}</span></div>
                        <div class="field-row"><span class="field-label">Just Value</span><span class="field-value">— (rich numeric + display fields in bcpa_property_card) ${status('NOT IN SAMPLE')} ${badge('BCPA')}</span></div>
                        <div class="field-row"><span class="field-label">Homestead Flag</span><span class="field-value">— ${status('NOT IN SAMPLE')} ${badge('BCPA')}</span></div>
                        <div class="text-xs text-slate-400 mt-2">Old spec also pulls sales history and tax fields here.</div>
                    </div>`;
            } else if (tab === 'broward') {
                html += `
                    <div class="field-group">
                        <div class="font-semibold mb-2">Broward Clerk / BCRM</div>
                        <div class="text-xs text-amber-400">This tab is intentionally STUB in the current sandbox snapshot.</div>
                        <div class="mt-2 text-xs">From old Claude spec: liens, NOC recordings, code enforcement, ownership history from Broward Clerk feed. No dedicated table exists in the local READONLY sample yet.</div>
                        <div class="mt-3 text-xs">Status: ${status('PLANNED SOURCE')} ${badge('Broward Clerk')}</div>
                    </div>`;
            } else if (tab === 'accela') {
                html += `
                    <div class="field-group">
                        <div class="font-semibold mb-2">Accela Detail</div>
                        <div class="field-row"><span class="field-label">Application Info (key/value)</span><span class="field-value">See rich parsed fields in old spec (Contract Value, HCD/CRA/City project flags, etc.) ${status('NOT IN SAMPLE')} ${badge('Accela')}</span></div>
                        <div class="field-row"><span class="field-label">Inspections</span><span class="field-value">Normalized from accela_inspections table (never raw_json per spec) ${status('NOT IN SAMPLE')} ${badge('Accela')}</span></div>
                        <div class="field-row"><span class="field-label">Workflow Timeline</span><span class="field-value">Often empty in current snapshot — shows "not yet captured" warning in old spec ${status('STALE')} ${badge('Accela')}</span></div>
                    </div>`;
            } else if (tab === 'provenance') {
                html += `
                    <div class="field-group">
                        <div class="font-semibold mb-2">Provenance &amp; Freshness</div>

                        <div class="clean-card mb-3">
                            <div class="text-teal-400 text-xs font-semibold tracking-widest mb-1">WHAT DOES PROVENANCE MEAN?</div>
                            <div class="text-xs text-slate-300">
                                Provenance means <strong>where each field came from</strong>, when it was fetched, and how much we trust it. It is the receipt for the data.
                            </div>
                            <div class="mt-2 text-[10px] text-slate-400">
                                Examples: <span class="text-blue-400">Accela</span> = permit source • <span class="text-teal-400">BCPA</span> = property/owner source • <span class="text-amber-400">Sunbiz</span> = company source • <span class="text-orange-400">Broward Clerk</span> = recordings/NOC/liens • <span class="text-sky-400">Owner Resolution</span> = derived owner match • <span class="text-slate-400">Local Snapshot</span> = current sandbox JSON
                            </div>
                        </div>

                        <div class="field-row"><span class="field-label">Accela</span><span class="field-value">${p.source_accela || '—'} ${preciseStatusPill('source_accela', p.source_accela, p)} ${badge('Accela')}</span></div>
                        <div class="field-row"><span class="field-label">BCPA</span><span class="field-value">${p.source_bcpa || '—'} ${preciseStatusPill('source_bcpa', p.source_bcpa, p)} ${badge('BCPA')}</span></div>
                        <div class="field-row"><span class="field-label">Sunbiz</span><span class="field-value">${p.source_sunbiz || '—'} ${preciseStatusPill('source_sunbiz', p.source_sunbiz, p)} ${badge('Sunbiz')}</span></div>
                        <div class="field-row"><span class="field-label">Last Enriched</span><span class="field-value">${p.last_enriched_at || '—'} ${status('PRESENT')} ${badge('Local Snapshot')}</span></div>
                    </div>`;
            } else if (tab === 'case-tree') {
                // FIXED: never blank. STUB + basic tree built from current row (sandbox limitation noted).
                const dec = decodePermitCode(p.permit_number);
                const tier = getValuationTier(p.valuation);
                const valStr = p.valuation ? '$' + Math.round(p.valuation).toLocaleString() + ' <span class="' + tier.cls + ' text-xs">(' + tier.label + ')</span>' : '<span class="text-red-400">—</span>';
                html += `
                    <div class="space-y-4">
                        <div>
                            <div class="text-teal-400 text-xs font-semibold tracking-widest">CASE TREE</div>
                            <div class="text-amber-400 text-sm mt-1 font-semibold">[STUB] Case Tree is waiting for related-record data in this sandbox sample.</div>
                            <div class="text-xs text-slate-400 mt-2">This tree will connect the permit to property, owner, contractor, Accela details, BCPA, Sunbiz, Broward Clerk/NOC/liens, inspections, and data-quality warnings as those sources are added.</div>
                        </div>

                        <div class="clean-card">
                            <div class="font-semibold mb-1.5 text-teal-300">Property / Folio</div>
                            <div class="pl-3 text-sm space-y-0.5">
                                <div>Address: ${p.address || '<span class="text-red-400">—</span>'} ${mapsLink(p.address)} ${preciseStatusPill('address', p.address, p)}</div>
                                <div>Parcel / Folio: ${p.parcel_id || '<span class="text-red-400">—</span>'} ${preciseStatusPill('parcel_id', p.parcel_id, p)}</div>
                                <div>Owner: ${p.owner_name || '<span class="text-red-400">—</span>'} ${preciseStatusPill('owner_name', p.owner_name, p)}</div>
                            </div>
                        </div>

                        <div class="clean-card">
                            <div class="font-semibold mb-1.5 text-teal-300">Permit</div>
                            <div class="pl-3 text-sm space-y-0.5">
                                <div>Number: <span class="font-mono">${p.permit_number}</span></div>
                                <div>Decoded: ${dec.display} <span class="text-[10px] px-1 py-px rounded ${dec.confidence === 'KNOWN' ? 'bg-teal-500/10 text-teal-400' : dec.confidence === 'LIKELY' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}">[${dec.confidence}]</span></div>
                                <div>Status: ${p.status || '—'}</div>
                                <div>Valuation: ${valStr} ${preciseStatusPill('valuation', p.valuation, p)}</div>
                            </div>
                        </div>

                        <div class="clean-card">
                            <div class="font-semibold mb-1.5 text-teal-300">Contractor</div>
                            <div class="pl-3 text-sm space-y-0.5">
                                <div>Name: ${p.contractor_name || '<span class="text-red-400">—</span>'} ${preciseStatusPill('contractor_name', p.contractor_name, p)}</div>
                                <div>Sunbiz: ${p.source_sunbiz ? 'Matched (' + p.source_sunbiz + ')' : '<span class="text-amber-400">NOT YET MATCHED</span>'} ${preciseStatusPill('sunbiz_match', p.source_sunbiz, p)}</div>
                            </div>
                        </div>

                        <div class="clean-card">
                            <div class="font-semibold mb-1.5 text-teal-300">Data Quality (from current row)</div>
                            <div class="pl-3 text-sm space-y-0.5">
                                <div>Missing valuation: ${!p.valuation ? '<span class="text-red-400">YES</span>' : '<span class="text-teal-400">no</span>'}</div>
                                <div>Stale geocode: ${(!p.lat || !p.lon) ? '<span class="text-amber-400">LIKELY (cache 23+ days)</span>' : '<span class="text-teal-400">present</span>'}</div>
                                <div>Missing BCPA: ${!p.source_bcpa ? '<span class="text-red-400">YES</span>' : '<span class="text-teal-400">no</span>'}</div>
                                <div>Missing Sunbiz: ${!p.source_sunbiz ? '<span class="text-red-400">YES</span>' : '<span class="text-teal-400">no</span>'}</div>
                                <div>Missing Clerk / liens: <span class="text-sky-400">PLANNED SOURCE (no Broward Clerk table in any sandbox JSON)</span></div>
                            </div>
                            <div class="mt-2 text-[10px] text-slate-500 pl-3">All items above are derived only from the local permits_sample row. Full tree requires future joins (BCPA, Sunbiz, Clerk, Accela inspections, etc.).</div>
                        </div>
                    </div>`;
            } else if (tab === 'raw') {
                html += `
                    <div>
                        <div class="mb-2 text-xs text-slate-400">Raw permit row from current sandbox sample (collapsed by design).</div>
                        <details class="bg-slate-950 border border-slate-700 rounded-xl p-4">
                            <summary class="cursor-pointer text-teal-400">Show Raw JSON Row</summary>
                            <pre class="mt-3 text-xs overflow-auto">${JSON.stringify(p, null, 2)}</pre>
                        </details>
                    </div>`;
            }

            html += `</div>`;
            container.innerHTML = html;
        }

