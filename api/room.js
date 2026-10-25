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
const leaveRoomScript = `
  redis.call('ZREM', KEYS[1], ARGV[1])
  redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[2])
  local remaining = redis.call('ZCARD', KEYS[1])
  if remaining == 0 then
    redis.call('DEL', KEYS[1], KEYS[2], KEYS[3])
  else
    redis.call('EXPIRE', KEYS[1], 3600)
  end
  return remaining
`;
const joinRoomScript = `
  redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[2])
  local previous = redis.call('ZCARD', KEYS[1])
  if previous == 0 then
    redis.call('DEL', KEYS[2], KEYS[3])
  end
  redis.call('ZADD', KEYS[1], ARGV[1], ARGV[3])
  redis.call('EXPIRE', KEYS[1], 3600)
  return redis.call('ZCARD', KEYS[1])
`;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(500).json({ error: 'Redis env vars missing' });
  try {
    const now = Date.now();
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (b.kind === 'leave') {
        const id = str(b.id, 20);
        if (!id) return res.status(400).json({ error: 'Participant ID is required' });
        const room = clean(b.room);
        const out = await redis([[
          'EVAL', leaveRoomScript, '3', 'lt:p:' + room, 'lt:c:' + room, 'lt:s:' + room,
          id, now - 6000,
        ]]);
        return res.status(200).json({ ok: true, peers: out[0] });
      }
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
        const chatKey = 'lt:c:' + clean(b.room);
        let replyTo;
        const replyToId = str(b.replyToId, 80);
        if (b.kind === 'chat' && replyToId) {
          const recent = await redis([['LRANGE', chatKey, 0, 49]]);
          const original = recent[0].map(value => {
            try {
              return JSON.parse(value);
            } catch (_) {
              return null;
            }
          }).find(message => message && message.id === replyToId && message.kind === 'chat');
          if (!original) return res.status(404).json({ error: 'Message to reply to was not found' });
          replyTo = { id: original.id, from: original.from, text: str(original.text, 140) };
        }
        const message = {
          id: now + ':' + Math.random().toString(36).slice(2),
          from: str(b.id, 20), kind: b.kind, text, ts: now,
          ...(replyTo ? { replyTo } : {}),
        };
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
      ['EVAL', joinRoomScript, '3', pk, 'lt:c:' + room, 'lt:s:' + room,
        now, now - 6000, id],
      ['GET', 'lt:s:' + room],
      ['LRANGE', 'lt:c:' + room, 0, 49],
    ]);
    let st = out[1] ? JSON.parse(out[1]) : null;
    if (st) st = { type: st.type, vid: st.vid, meta: st.meta, from: st.from, v: st.v, playing: st.playing,
      pos: st.pos + (st.playing ? (now - st.ts) / 1000 : 0) };
    res.status(200).json({ peers: out[0], state: st, chat: (out[2] || []).map(JSON.parse).reverse() });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
