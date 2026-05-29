        // === Global time formatting helpers (12-hour ET) ===
        function formatTimeET(date) {
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).replace(' ', '') + ' ET';
        }

        function formatRelativeTime(baseDate) {
            const now = new Date();
            const diffMs = now - baseDate;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHr = Math.floor(diffMin / 60);
            const diffDays = Math.floor(diffHr / 24);

            if (diffSec < 60) return 'just now';
            if (diffMin < 60) return `${diffMin} min ago`;
            if (diffHr < 24) return `${diffHr} hr ago`;
            if (diffDays < 7) return `${diffDays} days ago`;
            return baseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
        }

        function getTimestampColor(deltaMin) {
            if (deltaMin < 15) return '#5cb8b5';
            if (deltaMin < 60) return '#e6edf7';
            if (deltaMin < 1440) return '#fbbf24';
            return '#fbbf24';
        }

        function updateHeaderTimestamp() {
            const mainEl = document.getElementById('last-updated-main');
            if (!mainEl) return;

            const isLive = (new URLSearchParams(window.location.search).get('livePermits') === '1') ||
                           window.__FL_SIGNAL_LIVE_DATA === true;

            if (isLive) {
                // Live mode: prefer real max last_seen_at from loaded permits
                const liveTs = window.__FL_LIVE_LAST_SEEN_AT;
                if (liveTs) {
                    try {
                        const d = new Date(liveTs);
                        const rel = formatRelativeTime(d);
                        const abs = formatTimeET(d);
                        mainEl.innerHTML = `<span style="color:#7dd3fc;">Last live permit seen: ${rel}</span> <span style="color:#8ea3c7;">· ${abs}</span>`;
                        return;
                    } catch (e) {}
                }
                mainEl.innerHTML = `<span style="color:#7dd3fc;">Live freshness pending</span>`;
                return;
            }

            // Demo / fallback (unchanged behavior)
            const LAST_PULL_BASE = new Date('2026-05-28T13:50:00');
            const now = new Date();
            const diffMin = Math.floor((now - LAST_PULL_BASE) / 60000);

            const rel = formatRelativeTime(LAST_PULL_BASE);
            const abs = formatTimeET(LAST_PULL_BASE);

            let color = getTimestampColor(diffMin);
            let icon = (diffMin >= 1440) ? '⚠ ' : '';

            mainEl.innerHTML = `<span style="color:${color};">${icon}${rel}</span>  <span style="color:#8ea3c7;">·  ${abs}</span>`;
        }

        // Called by live data loader after permits arrive so header can show real freshness
        window.setLiveLastSeenAt = function(isoString) {
            if (isoString) {
                window.__FL_LIVE_LAST_SEEN_AT = isoString;
                // Re-render immediately if function exists
                if (typeof updateHeaderTimestamp === 'function') updateHeaderTimestamp();
            }
        };

