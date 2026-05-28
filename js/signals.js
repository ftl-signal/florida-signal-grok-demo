        function renderSignals(data) {
            const container = document.getElementById('signals-list');
            if (!container) return;
            container.innerHTML = data.slice(0, 8).map(s => `
                <div class="flex justify-between items-center bg-slate-800/60 px-4 py-2.5 rounded-2xl text-sm opacity-75">
                    <div class="font-mono">${s.permit_number}</div>
                    <div class="flex items-center gap-x-4 text-xs">
                        <span class="font-semibold text-teal-400">${s.final_score?.toFixed(1) || '—'}</span>
                        <span class="text-slate-400">Rank ${s.top_20_rank || '—'} • ${s.rules_fired || ''}</span>
                    </div>
                </div>
            `).join('');
        }

