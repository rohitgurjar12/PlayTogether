// Helper for the free Audius API (full-length, free-to-stream songs).
// Optional but recommended: create a free key at https://api.audius.co/plans
// and add it in Vercel as AUDIUS_BEARER_TOKEN.
const KEY = process.env.AUDIUS_BEARER_TOKEN;
const HOSTS = ['https://api.audius.co/v1', 'https://discoveryprovider.audius.co/v1'];
exports.get = async (path, params = {}) => {
  let last = 'no response';
  for (const base of HOSTS) {
    try {
      const u = new URL(base + path);
      u.searchParams.set('app_name', 'ListenTogether');
      for (const k in params) u.searchParams.set(k, params[k]);
      const r = await fetch(u, { headers: KEY ? { Authorization: 'Bearer ' + KEY } : {} });
      if (r.ok) return await r.json();
      last = 'Audius ' + r.status + (r.status === 401 || r.status === 403 ? ' (add AUDIUS_BEARER_TOKEN)' : '');
    } catch (e) { last = String(e.message || e); }
  }
  throw new Error(last);
};
