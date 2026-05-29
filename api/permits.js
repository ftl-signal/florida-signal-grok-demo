// api/permits.js — returns permit rows from Supabase (live) or sample JSON (demo)
// Auth: requires HttpOnly cookie fl_session set by /api/auth
// Query: no region filter, no Prefer:count=exact, simplified order (uses idx_permits_last_seen_at)

import { readFileSync } from 'fs';
import { join } from 'path';

const COOKIE_NAME = 'fl_session';

const SAFE_FIELDS = [
  'permit_number', 'permit_type', 'status', 'applied_date', 'issued_date',
  'address', 'address_normalized', 'valuation', 'valuation_usd_clean',
  'permit_category', 'report_source', 'region', 'is_commercial',
  'source_accela', 'source_bcpa', 'source_sunbiz', 'last_enriched_at',
  'first_seen_at', 'last_seen_at',
  'description', 'work_type', 'basic_status', 'applicant_name', 'opened_date', 'finalized_date'
].join(',');

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    cookies[k.trim()] = decodeURIComponent(rest.join('=').trim());
  }
  return cookies;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  const expected = process.env.FL_SIGNAL_DASHBOARD_PASSWORD;
  if (!expected) return false;
  return token === Buffer.from(expected).toString('base64');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const requestedLimit = Math.min(parseInt(req.query.limit ?? '50', 10) || 50, 200);
  const liveMode = req.query.livePermits === '1';

  // ── Demo mode ────────────────────────────────────────────────────────────────
  if (!liveMode) {
    try {
      const filePath = join(process.cwd(), 'data', 'permits_sample.json');
      const raw = readFileSync(filePath, 'utf8');
      const all = JSON.parse(raw);
      const rows = all.slice(0, requestedLimit);
      return res.status(200).json({ mode: 'demo_static', count: rows.length, hasMore: all.length > requestedLimit, rows });
    } catch (err) {
      console.error('[permits] demo read error', err.message);
      return res.status(500).json({ error: 'demo data unavailable' });
    }
  }

  // ── Live mode — require auth cookie ──────────────────────────────────────────
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('[permits] SUPABASE_URL or SUPABASE_ANON_KEY not set');
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    // Support custom order from client (e.g. valuation_usd_clean.desc.nullslast)
    // Fall back to a safe indexed-ish order if not provided.
    const requestedOrder = req.query.order || 'last_seen_at.desc.nullslast';
    // Basic safety: only allow certain columns in order
    const safeOrder = requestedOrder.includes('valuation_usd_clean') || requestedOrder.includes('last_seen_at')
      ? requestedOrder
      : 'last_seen_at.desc.nullslast';

    const params = new URLSearchParams({
      select: SAFE_FIELDS,
      order: safeOrder,
      limit: String(requestedLimit + 1),
    });

    const minValuation = parseInt(req.query.minValuation || '0', 10);

    const url = `${supabaseUrl}/rest/v1/permits?${params}`;
    const response = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[permits] Supabase error', response.status, errText);
      return res.status(502).json({ error: 'upstream error', detail: errText });
    }

    let rows = await response.json();
    const hasMore = rows.length > requestedLimit;
    if (hasMore) rows.pop();

    // Optional post-filter for high-value only (when the "Major Valuation" filter is active)
    if (minValuation > 0) {
      rows = rows.filter(r => (r.valuation_usd_clean || r.valuation || 0) >= minValuation);
    }

    return res.status(200).json({ mode: 'live', count: rows.length, hasMore, rows });
  } catch (err) {
    console.error('[permits] fetch error', err.message);
    return res.status(500).json({ error: 'fetch failed', detail: err.message });
  }
}
