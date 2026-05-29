// api/permit-detail.js — returns safe detail for one permit (live Supabase or demo)
// Auth: requires HttpOnly cookie fl_session for live mode
// Query: permit_number (required)

import { readFileSync } from 'fs';
import { join } from 'path';

const COOKIE_NAME = 'fl_session';

const SAFE_DETAIL_FIELDS = [
  'permit_number', 'permit_type', 'status', 'applied_date', 'issued_date',
  'address', 'address_normalized', 'valuation', 'valuation_usd_clean',
  'permit_category', 'report_source', 'region', 'is_commercial',
  'source_accela', 'source_bcpa', 'source_sunbiz',
  'last_enriched_at', 'first_seen_at', 'last_seen_at', 'last_updated_at',
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

  const permitNumber = req.query.permit_number;
  if (!permitNumber) {
    return res.status(400).json({ error: 'permit_number is required' });
  }

  const liveMode = req.query.livePermits === '1' || req.query.live === '1';

  // Demo mode
  if (!liveMode) {
    try {
      const filePath = join(process.cwd(), 'data', 'permits_sample.json');
      const raw = readFileSync(filePath, 'utf8');
      const all = JSON.parse(raw);
      const match = all.find(p => p.permit_number === permitNumber);
      if (!match) return res.status(404).json({ error: 'Not found in demo data' });
      return res.status(200).json({ mode: 'demo_static', permit: match });
    } catch (err) {
      return res.status(500).json({ error: 'demo data unavailable' });
    }
  }

  // Live mode — require auth
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    const params = new URLSearchParams({
      select: SAFE_DETAIL_FIELDS,
      permit_number: `eq.${permitNumber}`,
      limit: '1'
    });

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
      return res.status(502).json({ error: 'upstream error', detail: errText });
    }

    const rows = await response.json();
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Permit not found in live mirror' });
    }

    const permit = rows[0];

    // Fetch safe owner_resolution summary if present (Phase 3D)
    let owner_resolution = null;
    try {
      const orParams = new URLSearchParams({
        select: 'resolved_owner_name,confidence,resolved_owner_source,resolved_at',
        permit_number: `eq.${permitNumber}`,
        limit: '1'
      });
      const orUrl = `${supabaseUrl}/rest/v1/owner_resolution?${orParams}`;
      const orResp = await fetch(orUrl, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (orResp.ok) {
        const orRows = await orResp.json();
        if (orRows && orRows.length > 0) {
          const o = orRows[0];
          owner_resolution = {
            resolved_owner_name: o.resolved_owner_name || null,
            confidence: o.confidence || null,
            resolved_owner_source: o.resolved_owner_source || null,
            resolved_at: o.resolved_at || null,
          };
        }
      }
    } catch (e) {
      // ignore, owner_resolution will remain null
    }

    // Return only safe shape + honest missing labels
    return res.status(200).json({
      mode: 'live',
      permit: {
        ...permit,
        // Explicitly mark fields we intentionally do not expose
        owner_name: null,
        contractor_name: null,
        parcel_id: null,
        // Safe owner resolution summary (Phase 3D) - only when reviewed row exists
        owner_resolution: owner_resolution,
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'fetch failed', detail: err.message });
  }
}
