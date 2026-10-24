// Sync backend. State lives in Upstash Redis (free) because serverless
// functions can't keep memory between requests.
const pick = re => { const k = Object.keys(process.env).find(k => re.test(k)); return k ? process.env[k] : undefined; };
let URL_ = pick(/(REST_API_URL|REST_URL)$/);
const TOKEN = pick(/(REST_API_TOKEN|REST_TOKEN)$/);
if (URL_ && !/^https?:\/\//.test(URL_)) URL_ = 'https://' + URL_;

async function redis(cmds) {
  const r = await fetch(URL_ + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).map(x => x.result);
}
const clean = s => String(s || 'main').replace(/[^\w-]/g, '').toLowerCase().slice(0, 24) || 'main';
const str = (s, n) => String(s || '').slice(0, n);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(500).json({ error: 'Redis env vars missing' });
  try {
    const now = Date.now();
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const m = b.meta || {};
      const s = {
        type: b.type === 'au' ? 'au' : 'yt', vid: str(b.vid, 24), playing: !!b.playing, pos: +b.pos || 0,
        meta: { title: str(m.title, 120), artist: str(m.artist, 80), art: str(m.art, 300) },
        ts: now, from: str(b.id, 20), v: now,
      };
      await redis([['SET', 'lt:s:' + clean(b.room), JSON.stringify(s), 'EX', 86400]]);
      return res.status(200).json({ ok: true });
    }
    const room = clean(req.query.room), id = str(req.query.id || 'x', 20), pk = 'lt:p:' + room;
    const out = await redis([
      ['ZADD', pk, now, id],
      ['ZREMRANGEBYSCORE', pk, 0, now - 6000],
      ['ZCARD', pk],
      ['EXPIRE', pk, 3600],
      ['GET', 'lt:s:' + room],
    ]);
    let st = out[4] ? JSON.parse(out[4]) : null;
    if (st) st = { type: st.type, vid: st.vid, meta: st.meta, from: st.from, v: st.v, playing: st.playing,
      pos: st.pos + (st.playing ? (now - st.ts) / 1000 : 0) };
    res.status(200).json({ peers: out[2], state: st });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
