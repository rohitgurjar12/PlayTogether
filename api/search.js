const au = require('./_jamendo'), jm = require('./_jamendo');
const ok = r => (r.status === 'fulfilled' ? r.value : []);
const why = (n, r) => (r.status === 'rejected' ? n + ': ' + (r.reason && r.reason.message) : '');
module.exports = async (req, res) => {
  const q = String(req.query.q || '').slice(0, 80).trim();
  if (!q) return res.status(200).json({ tracks: [] });
  const [a, j] = await Promise.allSettled([
    au.get('/tracks/search', { query: q, limit: 8 }).then(d => (d.data || []).map(t => ({
      id: 'au:' + t.id, title: t.title, artist: t.user && t.user.name, from: 'Audius',
      art: t.artwork && (t.artwork['150x150'] || t.artwork['480x480']) }))),
    jm.get({ search: q, limit: 8, imagesize: 200 }).then(r => r.map(t => ({
      id: 'jm:' + t.id, title: t.name, artist: t.artist_name, from: 'Jamendo', art: t.image }))),
  ]);
  const tracks = [...ok(a), ...ok(j)];
  if (!tracks.length && (a.status === 'rejected' || j.status === 'rejected') &&
      (a.status === 'rejected' && j.status === 'rejected'))
    return res.status(502).json({ error: [why('Audius', a), why('Jamendo', j)].join(' | ') });
  res.status(200).json({ tracks });
};

