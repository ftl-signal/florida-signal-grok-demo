/**
 * Phase 2D — Permits Data Adapter
 *
 * Provides a unified interface for loading permit list data.
 * - Demo mode (default): uses local synthetic JSON + client-side filtering
 * - Live mode: calls /api/permits (server handles Supabase)
 *
 * Demo mode remains the default.
 * Live mode can be enabled locally via:
 *   - window.__FL_SIGNAL_LIVE_DATA = true before load, or
 *   - URL param ?livePermits=1
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Load permits with optional filters.
 * @param {Object} params
 * @param {string} [params.search]
 * @param {string} [params.status]
 * @param {number} [params.limit]
 * @returns {Promise<{data: any[], meta: any}>}
 */
async function getPermits(params = {}) {
  const { search = '', status = '', limit = DEFAULT_LIMIT } = params;
  const effectiveLimit = Math.min(limit, MAX_LIMIT);

  // Simple heuristic for live mode:
  // If the page is served from a context that has the API route available
  // and we explicitly want live (future: could be a URL param or localStorage flag).
  const useLive = window.__FL_SIGNAL_LIVE_DATA === true;

  if (!useLive) {
    // DEMO MODE (default)
    return getDemoPermits(search, status, effectiveLimit);
  }

  // LIVE MODE — call the server endpoint
  try {
    const query = new URLSearchParams({
      search,
      status,
      limit: String(effectiveLimit),
      region: 'FTL',
    });

    const res = await fetch(`/api/permits?${query.toString()}`);
    if (!res.ok) throw new Error('API request failed');

    return await res.json();
  } catch (err) {
    console.warn('[permits-adapter] Live fetch failed, falling back to demo:', err);
    return getDemoPermits(search, status, effectiveLimit);
  }
}

async function getDemoPermits(search, status, limit) {
  try {
    const res = await fetch('data/permits_sample.json');
    let data = await res.json();

    // Client-side filtering to match previous behavior
    if (search && search.length >= 2) {
      const q = search.toLowerCase();
      data = data.filter(p =>
        (p.permit_number && p.permit_number.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.owner_name && p.owner_name.toLowerCase().includes(q))
      );
    }

    if (status) {
      data = data.filter(p => (p.status || '').toLowerCase() === status.toLowerCase());
    }

    const sliced = data.slice(0, limit);

    return {
      data: sliced,
      meta: {
        source: 'demo_static',
        count: sliced.length,
        limit,
        has_more: data.length > limit,
      }
    };
  } catch (e) {
    console.error('Failed to load demo permits data', e);
    return { data: [], meta: { source: 'demo_static', count: 0, limit, has_more: false } };
  }
}

// Optional: future hook to enable live mode (for testing only)
window.enableLivePermitsData = () => {
  window.__FL_SIGNAL_LIVE_DATA = true;
  console.warn('[permits-adapter] Live data mode enabled (for testing). Reload to see effect.');
};

// Enable live mode via URL param for easy local testing: ?livePermits=1
(function enableLiveFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('livePermits') === '1' || params.get('live') === 'permits') {
      window.__FL_SIGNAL_LIVE_DATA = true;
      console.log('[permits-adapter] Live mode enabled via URL param');
    }
  } catch (e) {}
})();

// Global compatibility for the current non-module dashboard
window.getPermits = getPermits;