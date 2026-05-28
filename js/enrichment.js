        function renderEnrichmentTab(timeWindows, enrichmentStats, coverage) {
            const timeContainer = document.getElementById('enrichment-time-windows');
            if (timeContainer && timeWindows && timeWindows.length) {
                timeContainer.innerHTML = timeWindows.map(w => `
                    <div class="time-window-card bg-slate-900 border border-slate-700 rounded-3xl p-5">
                        <div class="font-semibold text-base mb-3">${w.window}</div>
                        <div class="space-y-1.5 text-sm">
                            <div class="flex justify-between"><span class="text-slate-400">AI cleaned</span> <span class="font-medium">${w.ai_cleaned_pct || 0}%</span></div>
                            <div class="flex justify-between"><span class="text-slate-400">BCPA matched</span> <span class="font-medium">${w.bcpa_matched_pct || 0}%</span></div>
                            <div class="flex justify-between"><span class="text-slate-400">Sunbiz / Geocoded / Accela</span> <span class="font-medium">${w.sunbiz_matched_pct||0}% / ${w.geocoded_pct||0}% / ${w.accela_detail_pct||0}%</span></div>
                        </div>
                    </div>
                `).join('');
            }

            const cardsContainer = document.getElementById('source-matching-cards');
            if (cardsContainer && enrichmentStats) {
                const total = enrichmentStats.total_permits || 115862;
                const bcpa = enrichmentStats.bcpa_matched || 19804;
                const sunbiz = enrichmentStats.sunbiz_matched || 55910;
                const accela = enrichmentStats.accela_detail || total;
                const geo = enrichmentStats.geocoded || 50185;

                cardsContainer.innerHTML = `
                    <div class="bg-slate-900 border border-slate-700 rounded-3xl p-6">
                        <div class="flex justify-between items-start mb-3">
                            <div><div class="font-semibold">BCPA Matching</div><div class="text-3xl font-semibold mt-1">${((bcpa/total)*100).toFixed(1)}%</div></div>
                            <i class="fa-solid fa-building text-2xl text-teal-400"></i>
                        </div>
                        <div class="text-sm text-slate-400">${bcpa.toLocaleString()} / ${total.toLocaleString()} permits <span class="text-teal-500/70">PROVEN</span></div>
                        <div class="progress-bar mt-3"><div class="progress-fill" style="width:${(bcpa/total)*100}%"></div></div>
                    </div>
                    <div class="bg-slate-900 border border-slate-700 rounded-3xl p-6">
                        <div class="flex justify-between items-start mb-3">
                            <div><div class="font-semibold">Sunbiz Matching</div><div class="text-3xl font-semibold mt-1">${((sunbiz/total)*100).toFixed(1)}%</div></div>
                            <i class="fa-solid fa-building text-2xl text-amber-400"></i>
                        </div>
                        <div class="text-sm text-slate-400">${sunbiz.toLocaleString()} / ${total.toLocaleString()} <span class="text-teal-500/70">PROVEN</span></div>
                        <div class="progress-bar mt-3"><div class="progress-fill" style="width:${(sunbiz/total)*100}%"></div></div>
                    </div>
                    <div class="bg-slate-900 border border-amber-700/30 rounded-3xl p-6">
                        <div class="flex justify-between items-start mb-3">
                            <div><div class="font-semibold">Geocoding (STALE)</div><div class="text-3xl font-semibold mt-1">${((geo/total)*100).toFixed(1)}%</div></div>
                            <i class="fa-solid fa-globe text-2xl text-amber-400"></i>
                        </div>
                        <div class="text-sm text-amber-400">Last pull 2026-05-05 — flagged in dashboard_summary</div>
                        <div class="progress-bar mt-3"><div class="progress-fill" style="width:${(geo/total)*100}%"></div></div>
                    </div>
                `;
            }

            // New clean bar cards for coverage (replaces problematic canvas)
            const bars = document.getElementById('coverage-bars');
            if (bars && enrichmentStats) {
                const total = enrichmentStats.total_permits || 115862;
                const vals = [
                    {label:'BCPA', v: enrichmentStats.bcpa_matched||19804, cls:'teal'},
                    {label:'Sunbiz', v: enrichmentStats.sunbiz_matched||55910, cls:'amber'},
                    {label:'Accela', v: enrichmentStats.accela_detail||total, cls:'blue'},
                    {label:'Geocoded', v: enrichmentStats.geocoded||50185, cls:'amber'}
                ];
                bars.innerHTML = vals.map(x => {
                    const pct = ((x.v / total) * 100).toFixed(1);
                    return `
                        <div class="bg-slate-950 border border-slate-700 rounded-2xl p-4">
                            <div class="flex justify-between text-xs"><span>${x.label}</span><span class="font-semibold">${pct}%</span></div>
                            <div class="h-2 bg-slate-800 rounded mt-2 overflow-hidden"><div class="h-2 bg-${x.cls}-500" style="width:${pct}%"></div></div>
                            <div class="text-[10px] text-slate-400 mt-1">${x.v.toLocaleString()} / ${total.toLocaleString()}</div>
                        </div>`;
                }).join('');
            }
        }

        // renderCharts + Chart.js fully removed (containment cleanup sprint).
        // Coverage visualization now uses pure local CSS bars in #coverage-bars.

