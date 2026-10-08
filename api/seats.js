const crypto = require('crypto');
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const eq = (a, b) => { if (!a || !b) return false; const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
async function redis(cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN }, body: JSON.stringify(cmd) });
  const j = await r.json(); if (j.error) throw new Error(j.error); return j.result;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.EDIT_KEY || !process.env.VIEW_KEY || !URL_ || !TOKEN) return res.status(500).json({ error: 'missing_env' });
  const key = String(req.headers['x-access-key'] || '').trim().toUpperCase();
  const role = eq(key, process.env.EDIT_KEY.trim().toUpperCase()) ? 'edit' : eq(key, process.env.VIEW_KEY.trim().toUpperCase()) ? 'view' : null;
  if (!role) return res.status(401).json({ error: 'bad_key' });
  try {
    if (req.method === 'GET') {
      const v = await redis(['GET', 'seating:main']); const d = v ? JSON.parse(v) : {};
      return res.status(200).json({ role, seats: d.seats || null, at: d.at || 0 });
    }
    if (req.method === 'POST') {
      if (role !== 'edit') return res.status(403).json({ error: 'read_only' });
      const seats = req.body && req.body.seats;
      const ok = Array.isArray(seats) && seats.length === 234 && seats.every(s => s && Number.isInteger(s.c) && Number.isInteger(s.r) && typeof s.n === 'string' && s.n.length < 80);
      if (!ok) return res.status(400).json({ error: 'bad_data' });
      const at = Date.now(); await redis(['SET', 'seating:main', JSON.stringify({ seats, at })]);
      return res.status(200).json({ ok: true, at });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) { return res.status(500).json({ error: 'server' }); }
};
