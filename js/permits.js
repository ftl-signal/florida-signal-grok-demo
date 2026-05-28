        function renderPermitsTable(data) {
            const tbody = document.getElementById('permits-tbody');
            const empty = document.getElementById('permits-empty');
            if (!tbody) return;
            tbody.innerHTML = '';
            if (empty) empty.classList.add('hidden');

            if (!data || data.length === 0) {
                if (empty) empty.classList.remove('hidden');
                updatePermitsCount(0, permitsData.length);
                return;
            }

            data.forEach((p, index) => {
                const tr = document.createElement('tr');
                tr.className = `permit-row border-b border-slate-800 hover:bg-slate-800 cursor-pointer ${index % 2 === 0 ? 'bg-slate-900' : ''}`;
                tr.tabIndex = 0;
                tr.setAttribute('role', 'button');
                tr.setAttribute('aria-label', `Open permit ${p.permit_number || 'details'}`);
                const prov = [];
                if (p.source_accela) prov.push('<span class="px-1.5 py-px bg-blue-500/10 text-blue-400 rounded text-[10px]">A</span>');
                if (p.source_bcpa) prov.push('<span class="px-1.5 py-px bg-teal-500/10 text-teal-400 rounded text-[10px]">B</span>');
                if (p.source_sunbiz) prov.push('<span class="px-1.5 py-px bg-amber-500/10 text-amber-400 rounded text-[10px]">S</span>');
                tr.innerHTML = `
                    <td class="px-6 py-3 font-mono text-teal-300">${p.permit_number}</td>
                    <td class="px-6 py-3 text-slate-300">${p.address || p.parcel_id || '—'}</td>
                    <td class="px-6 py-3"><span class="status-badge ${getStatusColor(p.status)}">${p.status || '—'}</span></td>
                    <td class="px-6 py-3">${prov.join(' ') || '<span class="text-slate-600">—</span>'}</td>
                    <td class="px-6 py-3 text-slate-400">${p.applied_date || p.issued_date || '—'}</td>
                    <td class="px-6 py-3 text-right font-medium">${p.valuation ? '$' + Math.round(p.valuation).toLocaleString() : '—'}${(() => { const t = getValuationTier(p.valuation); return (t.label !== 'MISSING' && t.label !== 'Below watch') ? ` <span class="text-[10px] ${t.cls}">${t.label.split(' ')[0]}</span>` : ''; })()}</td>
                `;
                tr.onclick = () => showPermitModal(p);
                tr.onkeydown = (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        showPermitModal(p);
                    }
                };
                tbody.appendChild(tr);
            });
            updatePermitsCount(data.length, permitsData.length);
            // Minor smoke check wiring (surgical)
            const smoke = document.getElementById('smoke-permits-rows');
            if (smoke) smoke.textContent = data && data.length ? `${data.length} rows` : '—';
        }

        function updatePermitsCount(visible, total) {
            const v = document.getElementById('permits-visible-count');
            const t = document.getElementById('permits-total-count');
            if (v) v.textContent = visible;
            if (t) t.textContent = total;
        }

        function filterPermitsTable() {
            const q = (document.getElementById('permit-search')?.value || '').toLowerCase().trim();
            const statusF = (document.getElementById('permit-status-filter')?.value || '').toLowerCase();
            let out = permitsData;

            // Text + status (existing)
            if (q) {
                out = out.filter(p =>
                    (p.permit_number || '').toLowerCase().includes(q) ||
                    (p.address || '').toLowerCase().includes(q) ||
                    (p.owner_name || '').toLowerCase().includes(q) ||
                    (p.contractor_name || '').toLowerCase().includes(q) ||
                    (p.parcel_id || '').toLowerCase().includes(q)
                );
            }
            if (statusF) {
                out = out.filter(p => {
                    const s = (p.status || '').toLowerCase();
                    if (statusF === 'open') return s.includes('open') || s.includes('process');
                    if (statusF === 'issued') return s.includes('issue') || s.includes('final');
                    if (statusF === 'plan') return s.includes('plan') || s.includes('submit');
                    return true;
                });
            }

            // Quick filter chips (new executive UX)
            if (activeQuickFilters.size > 0) {
                out = out.filter(p => {
                    const hasAddr = !!(p.address && p.address.trim());
                    const hasBcpa = !!p.source_bcpa;
                    const hasSunbiz = !!p.source_sunbiz;
                    const val = Number(p.valuation || 0);
                    const lastPullish = (p.applied_date || '').startsWith('2026-05-25') || (p.applied_date || '').startsWith('2026-05-26'); // rough Last Pull proxy
                    const incomplete = !hasAddr || !hasBcpa || !hasSunbiz || !p.last_enriched_at;

                    let pass = true;
                    if (activeQuickFilters.has('lastpull')) pass = pass && lastPullish;
                    if (activeQuickFilters.has('missingaddr')) pass = pass && !hasAddr;
                    if (activeQuickFilters.has('bcpa')) pass = pass && hasBcpa;
                    if (activeQuickFilters.has('sunbizmiss')) pass = pass && !hasSunbiz;
                    if (activeQuickFilters.has('highval')) pass = pass && val > 100000;
                    if (activeQuickFilters.has('majorval')) pass = pass && val > 750000;
                    if (activeQuickFilters.has('stale')) pass = pass && incomplete;
                    return pass;
                });
            }

            filteredPermits = out;
            renderPermitsTable(out);
            renderExportPreviewTable(); // keep Reports preview in sync

            // Update active filter summary for clarity
            const summaryEl = document.getElementById('active-filter-summary');
            if (summaryEl) {
                const labels = [];
                if (activeQuickFilters.has('lastpull')) labels.push('Last Pull');
                if (activeQuickFilters.has('bcpa')) labels.push('BCPA Matched');
                if (activeQuickFilters.has('sunbizmiss')) labels.push('Sunbiz Missing');
                if (activeQuickFilters.has('highval')) labels.push('Watch Valuation');
                if (activeQuickFilters.has('majorval')) labels.push('Major Valuation');
                if (activeQuickFilters.has('stale')) labels.push('Stale/Incomplete');
                if (activeQuickFilters.has('missingaddr')) labels.push('Missing Address');
                summaryEl.textContent = labels.length ? 'Active: ' + labels.join(' + ') : '';
            }
        }

        const activeQuickFilters = window.activeQuickFilters || (window.activeQuickFilters = new Set());

        function toggleQuickFilter(el, key) {
            if (activeQuickFilters.has(key)) {
                activeQuickFilters.delete(key);
                el.classList.remove('active');
            } else {
                activeQuickFilters.add(key);
                el.classList.add('active');
            }
            filterPermitsTable();
        }

        function clearAllPermitFilters() {
            activeQuickFilters.clear();
            document.querySelectorAll('#quick-filters .quick-filter-chip').forEach(c => c.classList.remove('active'));
            const s = document.getElementById('permit-search');
            const f = document.getElementById('permit-status-filter');
            if (s) s.value = '';
            if (f) f.value = '';
            filteredPermits = [...permitsData];
            renderPermitsTable(permitsData);
        }

        function clearPermitFilters() { // legacy single
            clearAllPermitFilters();
        }

        function getStatusColor(status) {
            if (!status) return 'bg-slate-700 text-slate-300';
            const s = status.toLowerCase();
            if (s.includes('issue') || s.includes('final')) return 'bg-teal-500/20 text-teal-400';
            if (s.includes('plan') || s.includes('submit')) return 'bg-blue-500/20 text-blue-400';
            return 'bg-amber-500/20 text-amber-400';
        }

        function sortTable(tableId, colIndex) {
            const table = document.getElementById(tableId);
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            const rows = Array.from(tbody.querySelectorAll('tr'));
            rows.sort((a, b) => {
                const aVal = (a.children[colIndex]?.textContent || '').trim();
                const bVal = (b.children[colIndex]?.textContent || '').trim();
                return aVal.localeCompare(bVal) * (currentSort.asc ? 1 : -1);
            });
            currentSort.asc = !currentSort.asc;
            tbody.innerHTML = '';
            rows.forEach(r => tbody.appendChild(r));
        }
