/**
 * Vercel Serverless Function: GET /api/permits
 *
 * Phase 2B integration — First real-data permit list endpoint.
 *
 * IMPORTANT:
 * - This file lives in the dashboard deployment root.
 * - Demo mode is DEFAULT. No env vars = synthetic data.
 * - Live mode only when SUPABASE_URL and SUPABASE_ANON_KEY are set.
 * - Server-side only Supabase access (never in browser).
 * - Narrow field list only (no PII).
 * - Hard row limit.
 */

const DEMO_DATA_PATH = '../data/permits_sample.json'; // relative to api/ when served

// Safe narrow fields confirmed available in live permits table (Phase 2A inspection)
const SAFE_FIELDS = [
  'permit_number',
  'permit_type',
  'status',
  'applied_date',
  'issued_date',
  'address',
  'address_normalized',
  'valuation',
  'valuation_usd_clean',
  'permit_category',
  'report_source',
  'region',
  'is_commercial',
  'source_accela',
  'source_bcpa',
  'source_sunbiz',
  'last_enriched_at',
  'first_seen_at',
  'last_seen_at'
].join(',');

module.exports = async (req, res) => {
  // CORS for local dev if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { search = '', status = '', limit = '50', region = 'FTL' } = req.query;

  const requestedLimit = Math.min(parseInt(limit, 10) || 50, 100); // Hard cap

  // ============================================
  // DEMO MODE (DEFAULT)
  // ============================================
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    try {
      // Serve from local synthetic data (Phase 1 sample)
      // In production build this path resolves relative to the function
      const fs = require('fs');
      const path = require('path');
      const demoPath = path.join(__dirname, '..', 'data', 'permits_sample.json');
      let demoData = [];

      if (fs.existsSync(demoPath)) {
        demoData = JSON.parse(fs.readFileSync(demoPath, 'utf8'));
      }

      // Client-side style filtering for demo parity (simple)
      let filtered = demoData;

      if (search && search.length >= 2) {
        const q = search.toLowerCase();
        filtered = filtered.filter(p =>
          (p.permit_number && p.permit_number.toLowerCase().includes(q)) ||
          (p.address && p.address.toLowerCase().includes(q))
        );
      }

      if (status) {
        filtered = filtered.filter(p => p.status === status);
      }

      // Region default filter for demo
      filtered = filtered.filter(p => !p.region || p.region === region || p.region === 'BROWARD');

      const sliced = filtered.slice(0, requestedLimit);

      return res.status(200).json({
        data: sliced,
        meta: {
          source: 'demo_static',
          count: sliced.length,
          limit: requestedLimit,
          has_more: filtered.length > requestedLimit,
        }
      });
    } catch (e) {
      console.error('Demo fallback error:', e);
      return res.status(200).json({
        data: [],
        meta: { source: 'demo_static', count: 0, limit: requestedLimit, has_more: false }
      });
    }
  }

  // ============================================
  // LIVE MODE (Supabase — server side only)
  // ============================================
  try {
    const params = new URLSearchParams({
      select: SAFE_FIELDS,
      order: 'last_seen_at.desc.nullslast,permit_number.desc',
      limit: String(requestedLimit + 1), // one extra for has_more
    });

    // Bounded filters (safe)
    params.append('region', `eq.${region}`);
    params.append('invalid', 'eq.false');
    params.append('permit_number', 'not.is.null');

    if (search && search.length >= 2) {
      // Bounded ILIKE on safe columns only
      const q = `%${search}%`;
      params.append('or', `(permit_number.ilike.${q},address_normalized.ilike.${q})`);
    }

    if (status) {
      params.append('status', `eq.${status}`);
    }

    const supabaseRestUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/permits?${params.toString()}`;

    const response = await fetch(supabaseRestUrl, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact', // for has_more detection if needed
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`);
    }

    let data = await response.json();

    const hasMore = data.length > requestedLimit;
    data = data.slice(0, requestedLimit);

    return res.status(200).json({
      data,
      meta: {
        source: 'supabase_readonly',
        count: data.length,
        limit: requestedLimit,
        has_more: hasMore,
      }
    });

  } catch (error) {
    console.error('Live /api/permits error (falling back to demo):', error.message);

    // Safe fallback to demo
    try {
      const fs = require('fs');
      const path = require('path');
      const demoPath = path.join(__dirname, '..', 'data', 'permits_sample.json');
      const demoData = JSON.parse(fs.readFileSync(demoPath, 'utf8')).slice(0, requestedLimit);

      return res.status(200).json({
        data: demoData,
        meta: {
          source: 'demo_static',
          count: demoData.length,
          limit: requestedLimit,
          has_more: false,
          note: 'Live query failed — using demo data',
        }
      });
    } catch (fallbackErr) {
      return res.status(200).json({
        data: [],
        meta: { source: 'demo_static', count: 0, limit: requestedLimit, has_more: false }
      });
    }
  }
};