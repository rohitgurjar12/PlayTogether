// Sync backend. State lives in Upstash Redis (free) because serverless
// functions can't keep memory between requests.
const fs = require('fs');
const path = require('path');
const localEnvPath = path.join(__dirname, '..', '.env.local');
const localEnv = {};
if (fs.existsSync(localEnvPath)) {
  for (const line of fs.readFileSync(localEnvPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const value = match[2];
    localEnv[match[1]] = value.replace(/^(['"])(.*)\1$/, '$2');
  }
}
const env = name => process.env[name] || localEnv[name];
let URL_ = env('UPSTASH_REDIS_REST_URL') || env('REST_API_URL') || env('REST_URL');
const TOKEN = env('UPSTASH_REDIS_REST_TOKEN') || env('REST_API_TOKEN') || env('REST_TOKEN');
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
      if (b.kind === 'edit' || b.kind === 'delete') {
        const owner = str(b.id, 20), messageId = str(b.messageId, 80);
        if (!owner || !messageId) return res.status(400).json({ error: 'Message ID and sender ID are required' });
        const chatKey = 'lt:c:' + clean(b.room);
        const messages = await redis([['LRANGE', chatKey, 0, 49]]);
        const raw = messages[0].find(value => {
          try {
            const message = JSON.parse(value);
            return message.id === messageId && message.from === owner && message.kind === 'chat';
          } catch (_) {
            return false;
          }
        });
        if (!raw) return res.status(404).json({ error: 'Message not found or cannot be changed' });
        if (b.kind === 'delete') {
          await redis([['LREM', chatKey, 1, raw]]);
          return res.status(200).json({ ok: true, deletedId: messageId });
        }
        const text = str(b.text, 280).trim();
        if (!text) return res.status(400).json({ error: 'Message cannot be empty' });
        const message = { ...JSON.parse(raw), text, edited: true, editedTs: now };
        await redis([
          ['LREM', chatKey, 1, raw],
          ['LPUSH', chatKey, JSON.stringify(message)],
          ['LTRIM', chatKey, 0, 49],
          ['EXPIRE', chatKey, 86400],
        ]);
        return res.status(200).json({ ok: true, message });
      }
      if (b.kind === 'chat' || b.kind === 'reaction') {
        const text = str(b.text, 280).trim();
        const reactions = ['❤️', '😂', '😍', '👏', '🔥', '😮'];
        if (!text || (b.kind === 'reaction' && !reactions.includes(text)))
          return res.status(400).json({ error: 'Invalid chat message or reaction' });
        const message = {
          id: now + ':' + Math.random().toString(36).slice(2),
          from: str(b.id, 20), kind: b.kind, text, ts: now,
        };
        const chatKey = 'lt:c:' + clean(b.room);
        await redis([
          ['LPUSH', chatKey, JSON.stringify(message)],
          ['LTRIM', chatKey, 0, 49],
          ['EXPIRE', chatKey, 86400],
        ]);
        return res.status(200).json({ ok: true, message });
      }
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
      ['LRANGE', 'lt:c:' + room, 0, 49],
    ]);
    let st = out[4] ? JSON.parse(out[4]) : null;
    if (st) st = { type: st.type, vid: st.vid, meta: st.meta, from: st.from, v: st.v, playing: st.playing,
      pos: st.pos + (st.playing ? (now - st.ts) / 1000 : 0) };
    res.status(200).json({ peers: out[2], state: st, chat: (out[5] || []).map(JSON.parse).reverse() });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
