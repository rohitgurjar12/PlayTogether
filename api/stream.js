const au = require('./_jamendo'), jm = require('./_jamendo');
module.exports = async (req, res) => {
  const m = /^(?:(au|jm):)?(\w{1,24})$/.exec(String(req.query.id || ''));
  if (!m) return res.status(400).json({ error: 'bad id' });
  const [, src = 'au', id] = m;
  try {
    let url = null;
    if (src === 'jm') { const r = await jm.get({ id }); url = r[0] && r[0].audio; }
    else { const d = await au.get('/tracks/' + id + '/stream', { no_redirect: 'true' }); url = typeof d.data === 'string' ? d.data : null; }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ url: url || null });
  } catch (e) { res.status(502).json({ error: String(e.message) }); }
};