const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const localEnvPath = path.join(__dirname, '..', '.env.local');
const localEnv = {};
if (fs.existsSync(localEnvPath)) {
  for (const line of fs.readFileSync(localEnvPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (match) localEnv[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const env = name => process.env[name] || localEnv[name];
let redisUrl = env('UPSTASH_REDIS_REST_URL') || env('REST_API_URL') || env('REST_URL');
const redisToken = env('UPSTASH_REDIS_REST_TOKEN') || env('REST_API_TOKEN') || env('REST_TOKEN');
if (redisUrl && !/^https?:\/\//.test(redisUrl)) redisUrl = 'https://' + redisUrl;

const SESSION_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_ITERATIONS = 310000;
const DUMMY_SALT = '8f912cda0a84b92e4f43f2e861a3c0bc';
const DUMMY_HASH = Buffer.alloc(32).toString('hex');
const reserveAccountScript = `
  if redis.call('EXISTS', KEYS[1]) == 1 then return 1 end
  if redis.call('EXISTS', KEYS[2]) == 1 then return 2 end
  redis.call('SET', KEYS[1], ARGV[1])
  redis.call('SET', KEYS[2], ARGV[1])
  redis.call('SET', KEYS[3], ARGV[2])
  return 0
`;

async function redis(commands) {
  const response = await fetch(redisUrl + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + redisToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!response.ok) throw new Error('Account store returned HTTP ' + response.status);
  const results = await response.json();
  if (results.some(result => result.error)) throw new Error('Account store request failed');
  return results.map(result => result.result);
}

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, PASSWORD_ITERATIONS, 32, 'sha256', (error, hash) => {
      if (error) reject(error);
      else resolve(hash.toString('hex'));
    });
  });
}

function publicUser(user) {
  return { username: user.username, displayName: user.displayName, email: user.email };
}

function cookieOptions(req) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
    || req.headers['x-forwarded-proto'] === 'https';
  return 'Path=/; HttpOnly; SameSite=Lax; Max-Age=' + SESSION_SECONDS + (secure ? '; Secure' : '');
}

function readSession(req) {
  const cookies = String(req.headers.cookie || '').split(';');
  const entry = cookies.find(cookie => cookie.trim().startsWith('pt_session='));
  return entry ? entry.trim().slice('pt_session='.length) : '';
}

function clearSessionCookie(res, req) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
    || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', 'pt_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' + (secure ? '; Secure' : ''));
}

function sessionCookie(res, req, token) {
  res.setHeader('Set-Cookie', 'pt_session=' + token + '; ' + cookieOptions(req));
}

function normalizedEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

async function createSession(userId, res, req) {
  const token = crypto.randomBytes(32).toString('base64url');
  const key = crypto.createHash('sha256').update(token).digest('hex');
  await redis([['SET', 'pt:session:' + key, userId, 'EX', SESSION_SECONDS]]);
  sessionCookie(res, req, token);
}

async function getCurrentUser(req) {
  const token = readSession(req);
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const key = crypto.createHash('sha256').update(token).digest('hex');
  const [userId] = await redis([['GET', 'pt:session:' + key]]);
  if (!userId) return null;
  const [rawUser] = await redis([['GET', 'pt:user:' + userId]]);
  if (!rawUser) return null;
  return JSON.parse(rawUser);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');
  if (!redisUrl || !redisToken) return res.status(500).json({ error: 'Account storage is not configured.' });
  if (req.method !== 'GET' && req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed.' });

  try {
    if (req.method === 'GET') {
      const user = await getCurrentUser(req);
      return res.status(200).json({ user: user ? publicUser(user) : null });
    }

    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {
        return res.status(400).json({ error: 'Invalid request.' });
      }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return res.status(400).json({ error: 'Invalid request.' });

    if (body.action === 'logout') {
      const token = readSession(req);
      if (/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
        const key = crypto.createHash('sha256').update(token).digest('hex');
        await redis([['DEL', 'pt:session:' + key]]);
      }
      clearSessionCookie(res, req);
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'signup') {
      if (typeof body.username !== 'string' || typeof body.displayName !== 'string'
        || typeof body.email !== 'string' || typeof body.password !== 'string')
        return res.status(400).json({ error: 'Enter a username, display name, email address, and password.' });
      const username = body.username.trim().toLowerCase();
      const displayName = body.displayName.trim();
      const email = normalizedEmail(body.email);
      const password = body.password;
      if (!/^[a-z0-9_-]{3,24}$/.test(username))
        return res.status(400).json({ error: 'Username must be 3–24 letters, numbers, underscores, or hyphens.' });
      if (!displayName || displayName.length > 50)
        return res.status(400).json({ error: 'Display name must be between 1 and 50 characters.' });
      if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
      if (password.length < 8 || password.length > 128)
        return res.status(400).json({ error: 'Password must be 8–128 characters long.' });

      const id = crypto.randomUUID();
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = await hashPassword(password, salt);
      const user = { id, username, displayName, email, salt, passwordHash, createdAt: Date.now() };
      const [reservation] = await redis([[
        'EVAL', reserveAccountScript, '3',
        'pt:username:' + username, 'pt:email:' + email, 'pt:user:' + id,
        id, JSON.stringify(user),
      ]]);
      if (Number(reservation) === 1)
        return res.status(409).json({ error: 'That username or email is already in use.' });
      if (Number(reservation) === 2)
        return res.status(409).json({ error: 'That username or email is already in use.' });
      if (Number(reservation) !== 0) throw new Error('Account reservation failed.');

      await createSession(id, res, req);
      return res.status(201).json({ user: publicUser(user) });
    }

    if (body.action === 'login') {
      if (typeof body.identifier !== 'string' || typeof body.password !== 'string')
        return res.status(400).json({ error: 'Enter your username or email and password.' });
      const identifier = body.identifier.trim();
      const password = body.password;
      if (!identifier || identifier.length > 254 || !password || password.length > 128)
        return res.status(400).json({ error: 'Enter your username or email and password.' });

      const byEmail = identifier.includes('@');
      const lookup = byEmail ? normalizedEmail(identifier) : identifier.toLowerCase();
      const [userId] = await redis([['GET', (byEmail ? 'pt:email:' : 'pt:username:') + lookup]]);
      const [rawUser] = userId ? await redis([['GET', 'pt:user:' + userId]]) : [null];
      const user = rawUser ? JSON.parse(rawUser) : null;
      const actualHash = await hashPassword(password, user ? user.salt : DUMMY_SALT);
      const expectedHash = user ? user.passwordHash : DUMMY_HASH;
      const matches = crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'));
      if (!user || !matches)
        return res.status(401).json({ error: 'Username/email or password is incorrect.' });

      await createSession(user.id, res, req);
      return res.status(200).json({ user: publicUser(user) });
    }

    return res.status(400).json({ error: 'Unknown authentication action.' });
  } catch (error) {
    console.error('Authentication endpoint failed:', error);
    return res.status(500).json({ error: 'Authentication is temporarily unavailable. Please try again.' });
  }
};
