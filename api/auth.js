// api/auth.js — app-level password gate
// POST /api/auth  { password: "..." }  → sets HttpOnly session cookie
// DELETE /api/auth                      → clears session cookie (logout)

const COOKIE_NAME = 'fl_session';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

export default function handler(req, res) {
  // Logout
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`);
    return res.status(200).json({ ok: true });
  }

  // Login
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.FL_SIGNAL_DASHBOARD_PASSWORD;
  if (!expected) {
    console.error('[auth] FL_SIGNAL_DASHBOARD_PASSWORD env var not set');
    return res.status(500).json({ error: 'Auth not configured' });
  }

  const { password } = req.body || {};
  if (!password || password !== expected) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = Buffer.from(expected).toString('base64');
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Strict`
  );
  return res.status(200).json({ ok: true });
}
