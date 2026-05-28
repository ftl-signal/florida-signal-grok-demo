        function renderSourcesPage() {
            const roadmap = window.sourceRoadmap || {};
            const sources = roadmap.sources || [];
            if (sources.length === 0) {
                const containers = ['sources-live-grid','sources-partial-grid','sources-planned-grid','sources-future-grid','sources-frozen-grid'];
                containers.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerHTML = '<div class="text-xs text-slate-400 p-3">source_roadmap.json not loaded.</div>';
                });
                return;
            }

            const groups = {
                live: [],
                partial: [],
                planned: [],
                future: [],
                frozen: []
            };

            sources.forEach(s => {
                const st = (s.current_status || '').toLowerCase();
                if (st === 'implemented') groups.live.push(s);
                else if (st === 'partial') groups.partial.push(s);
                else if (st === 'planned') groups.planned.push(s);
                else if (st === 'blocked' || st === 'frozen') groups.frozen.push(s);
                else groups.future.push(s); // stub, future, etc.
            });

            function renderCard(s) {
                const statusColor = s.current_status === 'implemented' ? 'teal' : s.current_status === 'partial' ? 'amber' : s.current_status === 'planned' ? 'sky' : 'slate';
                const signalColor = s.signal_value === 'very_high' ? 'teal' : s.signal_value === 'high' ? 'teal' : s.signal_value === 'medium' ? 'amber' : 'slate';
                const adapterBadge = s.adapter_type || 'future';
                const refs = (s.reference_docs || []).slice(0,3).join(', ');
                const gapsShort = (s.known_gaps || '').slice(0, 110) + ((s.known_gaps || '').length > 110 ? '…' : '');
                const hardShort = (s.hard_boundaries || '').slice(0, 95) + ((s.hard_boundaries || '').length > 95 ? '…' : '');
                return `
                    <div class="clean-card border-l-4 border-${statusColor}-500 text-xs">
                        <div class="flex justify-between items-start mb-1">
                            <div class="font-semibold">${s.source_name}</div>
                            <div class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-${statusColor}-400">${s.current_status}</div>
                        </div>
                        <div class="text-[10px] text-slate-400 mb-1">${s.category} • <span class="text-${signalColor}-400">${s.signal_value}</span> signal • ${s.build_cost} cost</div>
                        <div class="mb-1"><span class="text-slate-400">Adapter:</span> <span class="px-1 rounded bg-slate-800">${adapterBadge}</span></div>
                        <div class="text-[10px] mb-0.5"><span class="text-slate-400">Fields avail:</span> ${(s.fields_available || []).slice(0,4).join(', ') || '—'}</div>
                        <div class="text-[10px] mb-0.5"><span class="text-slate-400">Captured:</span> ${(s.fields_captured || []).slice(0,4).join(', ') || 'none'}</div>
                        <div class="text-amber-300 text-[10px] mb-0.5">Gaps: ${gapsShort || '—'}</div>
                        <div class="text-[10px]"><span class="text-slate-400">First safe test:</span> ${s.first_safe_test || '—'}</div>
                        <div class="text-red-300 text-[10px] mt-0.5">Boundary: ${hardShort}</div>
                        <div class="text-[9px] text-slate-500 mt-1">Refs: ${refs}</div>
                    </div>
                `;
            }

            // Render each group
            const map = [
                ['sources-live-grid', groups.live],
                ['sources-partial-grid', groups.partial],
                ['sources-planned-grid', groups.planned],
                ['sources-future-grid', groups.future],
                ['sources-frozen-grid', groups.frozen]
            ];
            map.forEach(([id, list]) => {
                const el = document.getElementById(id);
                if (!el) return;
                if (list.length === 0) {
                    el.innerHTML = '<div class="text-[10px] text-slate-500 p-2">— none in this category —</div>';
                } else {
                    el.innerHTML = list.map(renderCard).join('');
                }
            });
        }

