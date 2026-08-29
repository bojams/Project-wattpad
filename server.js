'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

try {
  const envRaw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const line of envRaw.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {}

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DATA_FILE = path.join(DATA_DIR, 'stories.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ACCOUNTS_DIR = path.join(DATA_DIR, 'accounts');
const SECRET_FILE = path.join(DATA_DIR, 'session-secret');
const MIGRATE_FLAG = path.join(DATA_DIR, '.migrated');
const LEGACY_OWNER_EMAIL = 'adinata79177@gmail.com';
const SESSION_COOKIE = 'hw_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHOTO_DATA_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\s]+$/;
const PHOTO_MAX_CHARS = 200_000;

const MAX_BODY_BYTES = 64 * 1024;
const MAX_PROFILE_BODY_BYTES = 240 * 1024;
const MAX_STORIES = 5000;
const MAX_LISTS = 100;
const RATE_LIMIT_MAX = 60;
const RATE_WINDOW_MS = 60_000;
const BACKUP_KEEP = 15;

const STATUSES = new Set(['membaca', 'ongoing', 'selesai', 'ditunda', 'drop']);
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2'
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; " +
    "font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; " +
    "base-uri 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload'
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const WATTPAD_HOSTS = new Set(['wattpad.com', 'www.wattpad.com', 'm.wattpad.com']);
const WATTPAD_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 12_000;
const FETCH_MAX_BYTES = 3_000_000;
const FETCH_CACHE_TTL_MS = 10 * 60_000;
const PARTS_CACHE_TTL_MS = 10 * 60_000;
const TEXT_CACHE_TTL_MS = 30 * 60_000;
const fetchCache = new Map();
const partsCache = new Map();
const textCache = new Map();

let sessionSecret = '';
const users = [];
const accountCache = new Map();
const UPDATES_FILE = path.join(DATA_DIR, 'updates.json');
const DEFAULT_CHECK_MINUTES = Math.max(5, Number.parseInt(process.env.UPDATE_CHECK_MINUTES || '15', 10) || 30);
function checkIntervalOf(user) {
  return Math.max(5, Math.min(1440, Number.isInteger(user.checkIntervalMin) ? user.checkIntervalMin : DEFAULT_CHECK_MINUTES));
}
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL || '';
const SITE_URL = 'https://wattpad.hideo.id';
const OWNER_NOTIFY_EMAIL = 'adinata79177@gmail.com';
const HEARTBEAT_FILE = path.join(DATA_DIR, 'heartbeat.json');
const HEARTBEAT_INTERVAL_MS = 60_000;
const updatesByUser = new Map();
let updatesSaveQueued = false;
let nextCheckAtByUser = new Map();
let updatesReadyPromise = null;

async function loadUpdatesState() {
  try {
    const raw = JSON.parse(await fsp.readFile(UPDATES_FILE, 'utf8'));
    if (raw && typeof raw === 'object' && raw.byUser && typeof raw.byUser === 'object') {
      for (const [uid, map] of Object.entries(raw.byUser)) {
        if (map && typeof map === 'object') updatesByUser.set(uid, map);
      }
    }
  } catch {}
}

function ensureUpdatesLoaded() {
  if (!updatesReadyPromise) updatesReadyPromise = loadUpdatesState();
  return updatesReadyPromise;
}

function queueUpdatesSave() {
  if (updatesSaveQueued) return;
  updatesSaveQueued = true;
  setTimeout(async () => {
    updatesSaveQueued = false;
    try {
      await fsp.mkdir(DATA_DIR, { recursive: true });
      const obj = { version: 1, savedAt: new Date().toISOString(), byUser: Object.fromEntries(updatesByUser) };
      const tmp = `${UPDATES_FILE}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(obj));
      await fsp.rename(tmp, UPDATES_FILE);
    } catch (err) {
      console.error('[updates] gagal menyimpan:', err.message);
    }
  }, 400);
}

function updatesListOf(userId) {
  const map = updatesByUser.get(userId) || {};
  return Object.entries(map)
    .map(([storyId, e]) => ({
      storyId,
      known: e.known,
      latest: e.latest,
      isNew: !!e.isNew,
      title: e.title || '',
      url: e.url || '',
      lastCheck: e.lastCheck || null
    }))
    .sort((a, b) => Number(b.isNew) - Number(a.isNew) || String(b.lastCheck).localeCompare(String(a.lastCheck)));
}

async function checkUpdatesForUser(user) {
  const acct = await loadAccount(user.id);
  const tracked = (acct.stories || []).filter((s) => s.url && Array.isArray(s.listIds) && s.listIds.length > 0);
  let map = updatesByUser.get(user.id);
  if (!map) {
    map = {};
    updatesByUser.set(user.id, map);
  }
  const newUpdates = [];
  let checked = 0;
  for (const s of tracked) {
    let sid = '';
    try {
      sid = assertWattpadStoryUrl(s.url);
    } catch {
      continue;
    }
    try {
      const data = await fetchWattpadStory(sid);
      const latest = Math.max(0, toInt(data.parts));
      if (!latest) continue;
      checked += 1;
      const newRating = data.rating > 0 ? data.rating : s.rating;
      const prev = map[s.id];
      const known = Math.max(0, toInt(s.chaptersTotal));
      if (!prev) {
        const base = known || latest;
        map[s.id] = { known: base, latest, isNew: latest > base, title: s.title, url: s.url, lastCheck: new Date().toISOString() };
        if (latest > base) newUpdates.push({ title: s.title, old: base, latest, url: s.url });
      } else {
        if (latest > prev.latest) {
          const oldVal = prev.latest;
          prev.latest = latest;
          prev.isNew = true;
          prev.title = s.title;
          prev.url = s.url;
          newUpdates.push({ title: s.title, old: oldVal, latest, url: s.url });
        } else if (latest < prev.latest) {
          prev.latest = latest;
        }
        prev.lastCheck = new Date().toISOString();
      }
      if (newRating !== s.rating || (s.votes !== data.votes && data.votes > 0) || (s.reads !== data.reads && data.reads > 0) || s.chaptersTotal !== latest) {
        const target = (acct.stories || []).find((st) => st.id === s.id);
        if (target) {
          target.rating = newRating;
          if (data.votes > 0) target.votes = data.votes;
          if (data.reads > 0) target.reads = data.reads;
          target.chaptersTotal = latest;
          await saveAccount(user.id);
        }
      }
      queueUpdatesSave();
      await new Promise((r) => setTimeout(r, 350));
    } catch {}
  }
  sendDiscordUpdates(user, newUpdates, checked);
  return { checked };
}

async function sendDiscordUpdates(user, updates, checked) {
  if (!updates.length) return;
  const webhookUrl = user.discordWebhook || DISCORD_WEBHOOK;
  if (!webhookUrl) return;
  if (user.discordWebhook && !isValidDiscordWebhook(user.discordWebhook)) return;
  const roleId = user.discordRoleId || '';
  const ping = roleId ? '<@&' + roleId + '>' : '';
  const lines = updates.map((u) => {
    const name = u.title || 'Cerita';
    const progress = u.old + ' → ' + u.latest + ' bab';
    if (u.url) return '• [📖 ' + name + '](' + u.url + ') — ' + progress;
    return '• **' + name + '** — ' + progress;
  });
  const embed = {
    title: '📖 ' + updates.length + ' Cerita Diperbarui!',
    url: SITE_URL,
    description: lines.join('\n'),
    color: 16743040,
    fields: [
      { name: '\u200b', value: '[🌐 Buka Hideo Wattpad](' + SITE_URL + ')', inline: true }
    ],
    footer: { text: 'Hideo Wattpad — ' + (user.email || '') },
    timestamp: new Date().toISOString()
  };
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Hideo Wattpad', avatar_url: SITE_URL + '/favicon.svg', content: ping || undefined, embeds: [embed] })
    });
  } catch {}
}

function ownerNotifyWebhook() {
  const owner = users.find((u) => u.email === OWNER_NOTIFY_EMAIL);
  const own = owner && owner.discordWebhook ? owner.discordWebhook : '';
  if (own && isValidDiscordWebhook(own)) return own;
  if (DISCORD_WEBHOOK && isValidDiscordWebhook(DISCORD_WEBHOOK)) return DISCORD_WEBHOOK;
  return '';
}

async function sendOwnerStatusMessage(kind) {
  const webhookUrl = ownerNotifyWebhook();
  if (!webhookUrl) return;
  const embed =
    kind === 'down'
      ? {
          title: '🔴 Server Nonaktif',
          url: SITE_URL,
          description: 'Server Hideo Wattpad sedang mati / berhenti.',
          color: 15548997,
          footer: { text: 'Hideo Wattpad — Status Server' },
          timestamp: new Date().toISOString()
        }
      : {
          title: '🟢 Server Aktif',
          url: SITE_URL,
          description: 'Server Hideo Wattpad aktif dan berjalan normal.',
          color: 3066993,
          footer: { text: 'Hideo Wattpad — Status Server' },
          timestamp: new Date().toISOString()
        };
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Hideo Wattpad', avatar_url: SITE_URL + '/favicon.svg', embeds: [embed] })
    });
  } catch {}
}

async function readHeartbeat() {
  try {
    const raw = JSON.parse(await fsp.readFile(HEARTBEAT_FILE, 'utf8'));
    if (raw && Number.isFinite(raw.lastSeen)) return { lastSeen: raw.lastSeen, cleaned: raw.cleaned === true };
  } catch {}
  return null;
}

async function writeHeartbeat(extra) {
  const payload = JSON.stringify(Object.assign({ lastSeen: Date.now() }, extra || {}));
  const tmp = `${HEARTBEAT_FILE}.tmp`;
  try {
    await fsp.writeFile(tmp, payload, 'utf8');
    await fsp.rename(tmp, HEARTBEAT_FILE);
  } catch {}
}

async function runUpdateChecks() {
  const now = Date.now();
  for (const u of users.slice()) {
    const due = now >= (nextCheckAtByUser.get(u.id) || 0);
    if (!due) continue;
    nextCheckAtByUser.set(u.id, now + checkIntervalOf(u) * 60_000);
    try {
      await checkUpdatesForUser(u);
    } catch {}
  }
}

setInterval(() => {
  if (users.length) runUpdateChecks().catch(() => {});
}, 60_000);
setTimeout(() => {
  runUpdateChecks().catch(() => {});
}, 15_000);

let saveChain = Promise.resolve();
let registerChain = Promise.resolve();

function cleanStr(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

function toInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(99999, Math.max(0, Math.trunc(n)));
}

function isValidUrlString(value) {
  return typeof value === 'string' && (value === '' || /^https?:\/\/\S+$/i.test(value));
}

function normalizeList(raw, { keepId = false, keepTimestamps = false } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new HttpError(400, 'Data list tidak valid.');
  }
  const name = cleanStr(raw.name, 60);
  if (!name) throw new HttpError(400, 'Nama list wajib diisi.');
  const id = keepId && typeof raw.id === 'string' && ID_RE.test(raw.id)
    ? raw.id
    : crypto.randomUUID();
  const createdAtRaw = Number(raw.createdAt);
  const updatedAtRaw = Number(raw.updatedAt);
  const now = Date.now();
  return {
    id,
    name,
    createdAt: keepTimestamps && Number.isFinite(createdAtRaw) ? createdAtRaw : now,
    updatedAt: keepTimestamps && Number.isFinite(updatedAtRaw) ? updatedAtRaw : now
  };
}

function sanitizeListIds(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (typeof item === 'string' && ID_RE.test(item) && !out.includes(item.toLowerCase())) {
      out.push(item.toLowerCase());
    }
    if (out.length >= MAX_LISTS) break;
  }
  return out;
}

function normalizeStory(raw, { keepId = false, keepTimestamps = false } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new HttpError(400, 'Data cerita tidak valid.');
  }
  const title = cleanStr(raw.title, 200);
  if (!title) throw new HttpError(400, 'Judul cerita wajib diisi.');
  for (const key of ['url', 'cover']) {
    if (!isValidUrlString(raw[key] ?? '')) {
      throw new HttpError(400, `${key === 'url' ? 'Tautan cerita' : 'Cover'} harus dimulai dengan http:// atau https://`);
    }
  }
  const id = keepId && typeof raw.id === 'string' && ID_RE.test(raw.id)
    ? raw.id
    : crypto.randomUUID();
  const createdAtRaw = Number(raw.createdAt);
  const updatedAtRaw = Number(raw.updatedAt);
  const now = Date.now();
  return {
    id,
    title,
    author: cleanStr(raw.author, 100),
    genre: cleanStr(raw.genre, 50),
    status: STATUSES.has(raw.status) ? raw.status : 'membaca',
    rating: Math.min(5, toInt(raw.rating)),
    votes: toInt(raw.votes),
    reads: toInt(raw.reads),
    chaptersRead: toInt(raw.chaptersRead),
    chaptersTotal: toInt(raw.chaptersTotal),
    url: cleanStr(raw.url, 500),
    cover: cleanStr(raw.cover, 1000),
    notes: cleanStr(raw.notes, 2000),
    listIds: sanitizeListIds(raw.listIds),
    createdAt: keepTimestamps && Number.isFinite(createdAtRaw) ? createdAtRaw : now,
    updatedAt: keepTimestamps && Number.isFinite(updatedAtRaw) ? updatedAtRaw : now
  };
}

function parseAccountDoc(parsed) {
  const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.stories) ? parsed.stories : null);
  if (arr === null) throw new Error('Format data tidak dikenal.');
  const listsOut = Array.isArray(parsed?.lists)
    ? parsed.lists
        .slice(0, MAX_LISTS)
        .map((item) => {
          try {
            return normalizeList(item, { keepId: true, keepTimestamps: true });
          } catch {
            return null;
          }
        })
        .filter(Boolean)
    : [];
  const storiesOut = [];
  for (const item of arr.slice(0, MAX_STORIES)) {
    try {
      storiesOut.push(normalizeStory(item, { keepId: true, keepTimestamps: true }));
    } catch {}
  }
  return { stories: storiesOut, lists: listsOut };
}

async function loadAccount(id) {
  if (accountCache.has(id)) return accountCache.get(id);
  let doc = { stories: [], lists: [] };
  try {
    const raw = await fsp.readFile(path.join(ACCOUNTS_DIR, `${id}.json`), 'utf8');
    doc = parseAccountDoc(JSON.parse(raw));
  } catch {}
  accountCache.set(id, doc);
  return doc;
}

async function saveAccount(id) {
  const acct = accountCache.get(id);
  if (!acct) return;
  saveChain = saveChain
    .then(async () => {
      await fsp.mkdir(ACCOUNTS_DIR, { recursive: true });
      const payload = JSON.stringify(
        { version: 2, savedAt: new Date().toISOString(), stories: acct.stories, lists: acct.lists },
        null,
        2
      );
      const file = path.join(ACCOUNTS_DIR, `${id}.json`);
      await fsp.writeFile(file + '.tmp', payload, 'utf8');
      await fsp.rename(file + '.tmp', file);
    })
    .catch((err) => console.error('[data] gagal menyimpan akun:', err.message));
  return saveChain;
}

async function loadUsers() {
  try {
    const raw = await fsp.readFile(USERS_FILE, 'utf8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      for (const u of arr) {
        if (
          u && typeof u === 'object' &&
          typeof u.id === 'string' && ID_RE.test(u.id) &&
          typeof u.email === 'string' && EMAIL_RE.test(u.email) &&
          typeof u.salt === 'string' && typeof u.hash === 'string'
        ) {
          users.push({
            id: u.id,
            email: u.email.toLowerCase(),
            salt: u.salt,
            hash: u.hash,
            name: typeof u.name === 'string' ? cleanStr(u.name, 60) : '',
            photo: typeof u.photo === 'string' && u.photo.length <= PHOTO_MAX_CHARS && PHOTO_DATA_RE.test(u.photo) ? u.photo : '',
            discordWebhook: typeof u.discordWebhook === 'string' ? u.discordWebhook : '',
            discordRoleId: typeof u.discordRoleId === 'string' ? u.discordRoleId : '',
            checkIntervalMin: Number.isInteger(u.checkIntervalMin) ? Math.max(5, Math.min(1440, u.checkIntervalMin)) : DEFAULT_CHECK_MINUTES,
            tokenVersion: Number.isInteger(u.tokenVersion) && u.tokenVersion >= 0 ? u.tokenVersion : 0,
            createdAt: Number(u.createdAt) || Date.now()
          });
        }
      }
    }
  } catch {}
  for (const u of users) {
    if (!nextCheckAtByUser.has(u.id)) nextCheckAtByUser.set(u.id, 0);
  }
  console.log(`[auth] ${users.length} akun terdaftar`);
}

async function writeUsers() {
  const payload = JSON.stringify(users, null, 2);
  await fsp.writeFile(USERS_FILE + '.tmp', payload, 'utf8');
  await fsp.rename(USERS_FILE + '.tmp', USERS_FILE);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function isValidDiscordWebhook(url) {
  if (!url) return true;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return u.hostname === 'discord.com' || u.hostname === 'discordapp.com';
  } catch {
    return false;
  }
}

function validatePasswordStrength(pw) {
  if (pw.length < 8) return 'Kata sandi minimal 8 karakter.';
  if (pw.length > 200) return 'Kata sandi terlalu panjang.';
  if (!/[a-z]/.test(pw)) return 'Kata sandi harus mengandung huruf kecil.';
  if (!/[A-Z]/.test(pw)) return 'Kata sandi harus mengandung huruf besar.';
  if (!/[0-9]/.test(pw)) return 'Kata sandi harus mengandung angka.';
  return null;
}

async function createUserAccount(email, password) {
  const id = crypto.randomUUID();
  const salt = crypto.randomBytes(16).toString('hex');
  const user = { id, email: email.toLowerCase(), salt, hash: hashPassword(password, salt), tokenVersion: 0, createdAt: Date.now() };
  users.push(user);
  nextCheckAtByUser.set(id, 0);
  await writeUsers();
  accountCache.set(id, { stories: [], lists: [] });
  await saveAccount(id);
  return user;
}

async function migrateLegacyIfNeeded(userId, email) {
  try {
    if (email.toLowerCase() !== LEGACY_OWNER_EMAIL) return;
    if (await fsp.access(MIGRATE_FLAG).then(() => true, () => false)) return;
    let doc = null;
    try {
      doc = parseAccountDoc(JSON.parse(await fsp.readFile(DATA_FILE, 'utf8')));
    } catch {}
    const acct = accountCache.get(userId);
    if (doc && acct && acct.stories.length === 0) {
      acct.stories = doc.stories;
      acct.lists = doc.lists;
      await saveAccount(userId);
      console.log(`[migrasi] ${doc.stories.length} cerita & ${doc.lists.length} list dipindah ke akun ${email}`);
    }
    await fsp.writeFile(MIGRATE_FLAG, new Date().toISOString(), 'utf8');
  } catch (err) {
    console.error('[migrasi] gagal:', err.message);
  }
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function signPayload(payload) {
  return crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
}

function issueToken(userId, tokenVersion) {
  const payload = `${userId}|${Date.now() + SESSION_TTL_MS}|${tokenVersion || 0}`;
  return `${b64url(payload)}.${signPayload(payload)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const p64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload;
  try {
    payload = Buffer.from(p64, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expected = signPayload(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const parts = payload.split('|');
  if (parts.length < 3) return null;
  const userId = parts[0];
  const exp = Number(parts[1]);
  const tokenVersion = Number(parts[2]);
  if (!ID_RE.test(userId) || !Number.isFinite(exp) || Date.now() > exp) return null;
  const user = users.find((u) => u.id === userId);
  if (!user) return null;
  if ((user.tokenVersion || 0) !== tokenVersion) return null;
  return userId;
}

function publicUser(user) {
  return { email: user.email, name: user.name || '', photo: user.photo || '', discordWebhook: user.discordWebhook || '', discordRoleId: user.discordRoleId || '', checkIntervalMin: checkIntervalOf(user) };
}

async function applyPhotoUpdate(user, raw) {
  if (raw === undefined) return;
  if (raw === '' || raw === null) {
    user.photo = '';
    return;
  }
  if (typeof raw !== 'string' || raw.length > PHOTO_MAX_CHARS) {
    throw new HttpError(400, 'Foto terlalu besar. Maksimal sekitar 150 KB.');
  }
  const normalized = raw.replace(/\s/g, '');
  if (!PHOTO_DATA_RE.test(normalized)) {
    throw new HttpError(400, 'Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.');
  }
  user.photo = normalized;
}

function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function getSessionUser(req) {
  const userId = verifyToken(getCookie(req, SESSION_COOKIE));
  if (!userId) return null;
  return users.find((u) => u.id === userId) || null;
}

function requireUser(req) {
  const user = getSessionUser(req);
  if (!user) throw new HttpError(401, 'Silakan login terlebih dahulu.');
  return user;
}

function isSecureRequest(req) {
  if (req.socket.encrypted === true) return true;
  if (!isTrustedProxySocket(req)) return false;
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

function setSessionCookie(req, res, token) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

async function backup(reason) {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(BACKUP_DIR, `backup-${stamp}-${reason}`);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.copyFile(USERS_FILE, path.join(dir, 'users.json')).catch(() => {});
    if (fs.existsSync(ACCOUNTS_DIR)) {
      const accts = await fsp.readdir(ACCOUNTS_DIR).catch(() => []);
      for (const f of accts) {
        await fsp.copyFile(path.join(ACCOUNTS_DIR, f), path.join(dir, f)).catch(() => {});
      }
    }
    await fsp.copyFile(UPDATES_FILE, path.join(dir, 'updates.json')).catch(() => {});
    const entries = (await fsp.readdir(BACKUP_DIR)).filter((f) => f.startsWith('backup-')).sort();
    while (entries.length > BACKUP_KEEP) {
      const old = path.join(BACKUP_DIR, entries.shift());
      await fsp.rm(old, { recursive: true, force: true }).catch(() => {});
    }
  } catch (err) {
    console.error(`[backup] ${err.message}`);
  }
}

const rateHits = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateHits) {
    if (now > entry.reset) rateHits.delete(key);
  }
}, RATE_WINDOW_MS).unref();

function isTrustedProxySocket(req) {
  const addr = req.socket.remoteAddress || '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1' || addr === 'localhost';
}

function clientIp(req) {
  const trusted = isTrustedProxySocket(req);
  const cf = req.headers['cf-connecting-ip'];
  if (trusted && cf) {
    const parts = String(cf).split(',')[0].trim();
    if (/^[\d.a-fA-F:]+$/.test(parts)) return parts;
  }
  return req.socket.remoteAddress || '?';
}

function rateLimit(req, max = RATE_LIMIT_MAX) {
  const ip = clientIp(req);
  const now = Date.now();
  const bucket = `${ip}:${max}`;
  let entry = rateHits.get(bucket);
  if (!entry || now > entry.reset) {
    entry = { count: 0, reset: now + RATE_WINDOW_MS, limit: max };
    rateHits.set(bucket, entry);
  }
  if (rateHits.size > 10_000) {
    const oldest = [...rateHits.entries()].sort((a, b) => a[1].reset - b[1].reset).slice(0, 2000);
    for (const [k] of oldest) rateHits.delete(k);
  }
  entry.count += 1;
  if (entry.count > entry.limit) {
    throw new HttpError(429, 'Terlalu banyak permintaan. Coba lagi beberapa saat lagi.');
  }
}

function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (origin !== undefined) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new HttpError(403, 'Origin tidak valid.');
    }
    if (!req.headers.host || parsed.host !== req.headers.host) {
      throw new HttpError(403, 'Permintaan dari origin lain tidak diizinkan.');
    }
  }
  const site = req.headers['sec-fetch-site'];
  if (site !== undefined && !['same-origin', 'same-site', 'none'].includes(site)) {
    throw new HttpError(403, 'Permintaan lintas situs diblokir.');
  }
}

function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    let settled = false;
    const chunks = [];
    const fail = (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
      } else if (!tooLarge) {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      if (tooLarge) {
        reject(new HttpError(413, 'Ukuran permintaan terlalu besar.'));
        return;
      }
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (text === '') {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new HttpError(400, 'Isi permintaan harus berupa objek JSON.'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new HttpError(400, 'JSON tidak valid.'));
      }
    });
    req.on('error', () => fail(new HttpError(400, 'Koneksi terputus.')));
  });
}

function send(res, status, body, contentType = 'application/json; charset=utf-8') {
  if (res.writableEnded || res.destroyed) return;
  const isJson = contentType.startsWith('application/json');
  const payload = body === null || isJson ? JSON.stringify(body ?? null) : body;
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, { error: 'Metode tidak diizinkan.' });
  }
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return send(res, 400, { error: 'URL tidak valid.' });
  }
  if (decoded.includes('\0') || decoded.includes('\\')) {
    return send(res, 400, { error: 'URL tidak valid.' });
  }
  let target = path.resolve(PUBLIC_DIR, '.' + decoded.replace(/\/+/g, '/'));
  if (target !== PUBLIC_DIR && !target.startsWith(PUBLIC_DIR + path.sep)) {
    return send(res, 403, { error: 'Akses ditolak.' });
  }
  let stat = await fsp.stat(target).catch(() => null);
  if (stat?.isDirectory()) {
    target = path.join(target, 'index.html');
    stat = await fsp.stat(target).catch(() => null);
  }
  if (!stat?.isFile()) {
    return send(res, 404, { error: 'Berkas tidak ditemukan.' });
  }
  const ext = path.extname(target).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return send(res, 404, { error: 'Berkas tidak ditemukan.' });
  let bodyStream = fs.createReadStream(target);
  if (ext === '.html') {
    const html = await fsp.readFile(target, 'utf8');
    const [cssSig, jsSig] = await Promise.all([
      assetSignature(path.join(PUBLIC_DIR, 'css', 'style.css')),
      assetSignature(path.join(PUBLIC_DIR, 'js', 'app.js'))
    ]);
    const out = html
      .replace(/style\.css\?v=[^"']+/g, `style.css?v=${cssSig}`)
      .replace(/app\.js\?v=[^"']+/g, `app.js?v=${jsSig}`);
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': mime,
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(out)
    });
    res.end(req.method === 'HEAD' ? undefined : out);
    return;
  }
  const noCache = ext === '.js' || ext === '.css';
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': mime,
    'Content-Length': stat.size,
    'Cache-Control': noCache ? 'no-cache' : 'public, max-age=86400',
    'Last-Modified': stat.mtime.toUTCString()
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  bodyStream.on('error', () => res.destroy());
  bodyStream.pipe(res);
}

async function assetSignature(file) {
  try {
    const buf = await fsp.readFile(file);
    return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
  } catch {
    return 'none';
  }
}

async function handleApi(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, SECURITY_HEADERS);
    res.end();
    return;
  }
  return await routeApi(req, res, pathname);
}

function assertWattpadStoryUrl(rawUrl) {
  let u;
  try {
    u = new URL(String(rawUrl));
  } catch {
    throw new HttpError(400, 'Tautan tidak valid.');
  }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.port || u.username || u.password) {
    throw new HttpError(400, 'Tautan tidak valid.');
  }
  if (!WATTPAD_HOSTS.has(u.hostname.toLowerCase())) {
    throw new HttpError(400, 'Hanya tautan dari wattpad.com yang didukung.');
  }
  const m = u.pathname.match(/^\/story\/([A-Za-z0-9]+)/);
  if (!m) {
    throw new HttpError(400, 'Gunakan tautan halaman cerita: wattpad.com/story/…');
  }
  return m[1];
}

async function limitedFetch(url, { timeoutMs = FETCH_TIMEOUT_MS, maxBytes = FETCH_MAX_BYTES } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let current = url;
    for (let hop = 0; hop < 5; hop++) {
      assertWattpadHostOnly(current);
      const res = await fetch(current, {
        signal: ctrl.signal,
        redirect: 'manual',
        headers: { 'User-Agent': WATTPAD_UA, 'Accept-Language': 'en,id;q=0.9' }
      });
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get('location');
        res.body?.cancel().catch(() => {});
        if (!loc) throw new HttpError(502, 'Pengalihan tidak valid dari Wattpad.');
        current = new URL(loc, current).href;
        continue;
      }
      if (res.status === 404 || res.status === 410) {
        throw new HttpError(404, 'Cerita tidak ditemukan di Wattpad.');
      }
      if (!res.ok) {
        throw new HttpError(502, `Wattpad merespons dengan status ${res.status}.`);
      }
      const declared = Number(res.headers.get('content-length') || 0);
      if (declared > maxBytes) {
        throw new HttpError(502, 'Respons Wattpad terlalu besar.');
      }
      const chunks = [];
      let total = 0;
      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > maxBytes) {
          reader.cancel().catch(() => {});
          throw new HttpError(502, 'Respons Wattpad terlalu besar.');
        }
        chunks.push(value);
      }
      return Buffer.concat(chunks).toString('utf8');
    }
    throw new HttpError(502, 'Terlalu banyak pengalihan dari Wattpad.');
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      throw new HttpError(504, 'Wattpad tidak merespons tepat waktu. Coba lagi.');
    }
    throw new HttpError(502, 'Gagal menghubungi Wattpad. Periksa koneksi internet.');
  } finally {
    clearTimeout(timer);
  }
}

function assertWattpadHostOnly(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new HttpError(502, 'URL pengalihan tidak valid.');
  }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.port || u.username || u.password ||
      !WATTPAD_HOSTS.has(u.hostname.toLowerCase())) {
    throw new HttpError(502, 'Pengalihan ke domain lain diblokir.');
  }
}

function normalizeFetchedStory(j) {
  if (!j || typeof j !== 'object') return null;
  const title = cleanStr(j.title ?? j.headline ?? '', 200);
  if (!title) return null;
  let authorRaw = '';
  if (typeof j.user === 'object' && j.user) {
    authorRaw = j.user.username ?? j.user.name ?? '';
  } else if (typeof j.author === 'object' && j.author) {
    authorRaw = j.author.name ?? '';
  } else {
    authorRaw = j.author ?? '';
  }
  const coverRaw = typeof j.cover === 'string' && /^https:\/\/img\.wattpad\.com\//i.test(j.cover)
    ? j.cover
    : '';
  const parts = Array.isArray(j.parts) ? Math.min(99999, j.parts.length) : toInt(j.partCount);
  return {
    title,
    author: cleanStr(authorRaw, 100),
    cover: cleanStr(coverRaw.replace('-256-', '-512-'), 1000),
    description: cleanStr(j.description ?? '', 2000),
    parts,
    completed: j.completed === true,
    rating: wattpadRatingOf(toInt(j.voteCount), toInt(j.readCount)),
    votes: toInt(j.voteCount),
    reads: toInt(j.readCount)
  };
}

function wattpadRatingOf(votes, reads) {
  if (votes <= 0 || reads <= 0) return 0;
  const ratio = votes / reads;
  if (ratio >= 0.1) return 5;
  if (ratio >= 0.06) return 4;
  if (ratio >= 0.03) return 3;
  if (ratio >= 0.015) return 2;
  return 1;
}

const HTML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

function decodeEntities(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code) => {
    if (code[0] === '#') {
      const num = code[1] === 'x' || code[1] === 'X'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(num) && num > 0 && num < 0x110000
        ? String.fromCodePoint(num)
        : m;
    }
    return HTML_ENTITIES[code.toLowerCase()] ?? m;
  });
}

function extractJsonLd(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null && out.length < 10) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {}
  }
  return out;
}

function metaContent(html, key) {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const re of [
    new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${esc}["']`, 'i')
  ]) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1]);
  }
  return '';
}

function parseHtmlStory(html) {
  let title = '';
  let author = '';
  let image = '';
  let description = '';
  for (const obj of extractJsonLd(html)) {
    const arr = Array.isArray(obj) ? obj : [obj];
    for (const o of arr) {
      if (!o || typeof o !== 'object') continue;
      title = title || cleanStr(o.headline || o.name || '', 200);
      author = author || cleanStr(typeof o.author === 'object' && o.author ? o.author.name : o.author, 100);
      const img = typeof o.image === 'string' ? o.image
        : Array.isArray(o.image) && typeof o.image[0] === 'string' ? o.image[0]
        : o.image && typeof o.image === 'object' ? o.image.url : '';
      image = image || cleanStr(img, 1000);
      description = description || cleanStr(o.description ?? '', 2000);
    }
  }
  title = title || metaContent(html, 'og:title').replace(/\s*[|·-]\s*Wattpad\s*$/i, '');
  image = image || metaContent(html, 'og:image');
  description = description || metaContent(html, 'og:description');
  if (!author) {
    const um = html.match(/wattpad\.com\/user\/([A-Za-z0-9_.\-]+)/i);
    author = cleanStr(um ? decodeURIComponent(um[1]) : '', 100);
  }
  let parts = 0;
  let votes = 0;
  let reads = 0;
  for (const obj of extractJsonLd(html)) {
    const arr = Array.isArray(obj) ? obj : [obj];
    for (const o of arr) {
      if (!o || typeof o !== 'object') continue;
      const v = Number(o.voteCount);
      const r = Number(o.readCount);
      if (Number.isFinite(v) && v > 0) votes = Math.min(99999, v);
      if (Number.isFinite(r) && r > 0) reads = Math.min(99999, r);
    }
  }
  const vm = html.match(/"voteCount"\s*:\s*(\d+)/);
  if (vm) {
    const n = Number(vm[1]);
    if (Number.isFinite(n) && n > 0) votes = Math.min(99999, n);
  }
  const rm = html.match(/"readCount"\s*:\s*(\d+)/);
  if (rm) {
    const n = Number(rm[1]);
    if (Number.isFinite(n) && n > 0) reads = Math.min(99999, n);
  }
  const pm =
    html.match(/"partCount"\s*:\s*(\d+)/) ||
    html.match(/data-testid="stats-value">\s*([\d.,]+)\s*parts?/i) ||
    html.match(/>\s*([\d.,]+)\s+parts?\b/i);
  if (pm) {
    const n = Number(String(pm[1]).replace(/[.,]/g, ''));
    parts = Number.isFinite(n) ? Math.min(99999, n) : 0;
  }
  if (!title) return null;
  return { title, author, cover: image, description, parts, completed: false, rating: wattpadRatingOf(votes, reads), votes, reads };
}

async function fetchWattpadStory(storyId) {
  const cached = fetchCache.get(storyId);
  if (cached && Date.now() < cached.expires) return cached.data;

  let apiError = null;
  try {
    const text = await limitedFetch(
      `https://www.wattpad.com/api/v3/stories/${encodeURIComponent(storyId)}`,
      { maxBytes: 1_500_000 }
    );
    const norm = normalizeFetchedStory(JSON.parse(text));
    if (norm) {
      fetchCache.set(storyId, { data: norm, expires: Date.now() + FETCH_CACHE_TTL_MS });
      trimFetchCache();
      return norm;
    }
  } catch (err) {
    apiError = err;
    if (err instanceof HttpError && err.status === 404) throw err;
  }

  try {
    const html = await limitedFetch(`https://www.wattpad.com/story/${encodeURIComponent(storyId)}`);
    const parsed = parseHtmlStory(html);
    if (parsed) {
      fetchCache.set(storyId, { data: parsed, expires: Date.now() + FETCH_CACHE_TTL_MS });
      trimFetchCache();
      return parsed;
    }
  } catch {}

  if (apiError instanceof HttpError) throw apiError;
  throw new HttpError(502, 'Tidak dapat membaca data cerita dari Wattpad.');
}

function trimFetchCache() {
  while (fetchCache.size > 300) {
    fetchCache.delete(fetchCache.keys().next().value);
  }
}

function parsePartParagraphs(html) {
  const paras = [];
  const images = [];
  const blocks = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html)) !== null && (paras.length < 2000 || images.length < 200 || blocks.length < 2100)) {
    const inner = String(m[1]);
    const srcs = [];
    for (const im of inner.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
      const src = decodeEntities(im[1]).trim();
      if (/^https?:\/\/img\.wattpad\.com\//i.test(src) && srcs.length < 50) srcs.push(src);
    }
    const text = decodeEntities(
      inner.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
    ).trim();
    if (text) {
      paras.push(text);
      blocks.push({ kind: 'p', text });
    }
    if (srcs.length) {
      const wm = inner.match(/data-original-width=["'](\d{1,6})["']/);
      const hm = inner.match(/data-original-height=["'](\d{1,6})["']/);
      const w = wm ? Math.min(4000, Number(wm[1])) : 0;
      const h = hm ? Math.min(4000, Number(hm[1])) : 0;
      for (const src of srcs) {
        if (images.length < 200) {
          images.push({ src, width: w, height: h });
          blocks.push({ kind: 'img' });
        }
      }
    }
  }
  return { paragraphs: paras, images, blocks };
}

async function fetchWattpadParts(storyId) {
  if (!/^\d{1,20}$/.test(storyId)) throw new HttpError(400, 'ID cerita tidak valid.');
  const cached = partsCache.get(storyId);
  if (cached && Date.now() < cached.expires) return cached.data;
  let j;
  try {
    j = JSON.parse(
      await limitedFetch(`https://www.wattpad.com/api/v3/stories/${encodeURIComponent(storyId)}`, {
        maxBytes: FETCH_MAX_BYTES
      })
    );
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, 'Gagal mengambil daftar bab.');
  }
  if (!Array.isArray(j.parts)) throw new HttpError(502, 'Struktur bab tidak dikenali.');
  const data = {
    title: cleanStr(j.title ?? '', 200),
    parts: j.parts.slice(0, 1000).map((p) => ({
      id: String(p?.id ?? ''),
      title: cleanStr(p?.title ?? '', 200) || 'Tanpa judul',
      url: isValidUrlString(p?.url ?? '') ? cleanStr(p.url, 500) : '',
      dateCreated: new Date(p?.createDate || 0).getTime() || 0,
      dateUpdated: new Date(p?.modifyDate || 0).getTime() || 0
    })).filter((p) => /^\d{1,20}$/.test(p.id))
  };
  partsCache.set(storyId, { data, expires: Date.now() + PARTS_CACHE_TTL_MS });
  trimMap(partsCache, 300);
  return data;
}

async function fetchWattpadPartText(partId) {
  if (!/^\d{1,20}$/.test(partId)) throw new HttpError(400, 'ID bab tidak valid.');
  const cached = textCache.get(partId);
  if (cached && Date.now() < cached.expires) return cached.data;
  const html = await limitedFetch(`https://www.wattpad.com/apiv2/storytext?id=${partId}`);
  const parsed = parsePartParagraphs(html);
  if (!parsed.paragraphs.length && !parsed.images.length) throw new HttpError(502, 'Isi bab kosong atau gagal dibaca.');
  const data = parsed;
  textCache.set(partId, { data, expires: Date.now() + TEXT_CACHE_TTL_MS });
  trimMap(textCache, 600);
  return data;
}

function trimMap(map, max) {
  while (map.size > max) {
    map.delete(map.keys().next().value);
  }
}

async function routeApi(req, res, pathname) {
  const partsMatch = pathname.match(/^\/api\/wattpad\/(\d{1,20})\/parts$/);
  if (partsMatch) {
    if (req.method !== 'GET') return send(res, 405, { error: 'Metode tidak diizinkan.' });
    requireUser(req);
    rateLimit(req, 60);
    return send(res, 200, await fetchWattpadParts(partsMatch[1]));
  }

  const partTextMatch = pathname.match(/^\/api\/wattpad\/part\/(\d{1,20})$/);
  if (partTextMatch) {
    if (req.method !== 'GET') return send(res, 405, { error: 'Metode tidak diizinkan.' });
    requireUser(req);
    rateLimit(req, 120);
    return send(res, 200, await fetchWattpadPartText(partTextMatch[1]));
  }

  if (pathname === '/api/wattpad') {
    if (req.method !== 'POST') {
      return send(res, 405, { error: 'Metode tidak diizinkan.' });
    }
    requireUser(req);
    rateLimit(req, 30);
    const body = await readJsonBody(req);
    const storyId = assertWattpadStoryUrl(body.url ?? '');
    const data = await fetchWattpadStory(storyId);
    return send(res, 200, { story: data });
  }

  if (pathname === '/api/auth/register') {
    if (req.method !== 'POST') return send(res, 405, { error: 'Metode tidak diizinkan.' });
    rateLimit(req, 5);
    const body = await readJsonBody(req);
    const email = cleanStr(body.email, 120).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Format email tidak valid.');
    const pwErr = validatePasswordStrength(password);
    if (pwErr) throw new HttpError(400, pwErr);
    const prev = registerChain;
    let doRegister;
    registerChain = new Promise((r) => { doRegister = r; });
    await prev;
    try {
      if (users.some((u) => u.email === email)) {
        throw new HttpError(409, 'Email sudah terdaftar. Silakan masuk.');
      }
      const user = await createUserAccount(email, password);
      await migrateLegacyIfNeeded(user.id, email);
      setSessionCookie(req, res, issueToken(user.id, user.tokenVersion || 0));
      return send(res, 201, { user: publicUser(user) });
    } finally {
      doRegister();
    }
  }

  if (pathname === '/api/auth/login') {
    if (req.method !== 'POST') return send(res, 405, { error: 'Metode tidak diizinkan.' });
    rateLimit(req, 5);
    const body = await readJsonBody(req);
    const email = cleanStr(body.email, 120).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const user = users.find((u) => u.email === email);
    const attempt = Buffer.from(hashPassword(password, user?.salt || '00000000000000000000000000000000'), 'hex');
    const real = Buffer.from(user?.hash || '00'.repeat(64), 'hex');
    const ok = user !== undefined && attempt.length === real.length && crypto.timingSafeEqual(attempt, real);
    if (!ok) throw new HttpError(401, 'Email atau kata sandi salah.');
    setSessionCookie(req, res, issueToken(user.id, user.tokenVersion || 0));
    return send(res, 200, { user: publicUser(user) });
  }

  if (pathname === '/api/auth/logout') {
    if (req.method !== 'POST') return send(res, 405, { error: 'Metode tidak diizinkan.' });
    const user = getSessionUser(req);
    if (user) {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await writeUsers();
    }
    clearSessionCookie(res);
    return send(res, 200, { ok: true });
  }

  if (pathname === '/api/auth/me') {
    if (req.method !== 'GET') return send(res, 405, { error: 'Metode tidak diizinkan.' });
    const user = getSessionUser(req);
    return send(res, 200, { user: user ? publicUser(user) : null });
  }

  if (pathname === '/api/auth/profile') {
    const user = requireUser(req);
    if (req.method !== 'PUT') return send(res, 405, { error: 'Metode tidak diizinkan.' });
    rateLimit(req, 30);
    const body = await readJsonBody(req, MAX_PROFILE_BODY_BYTES);
    user.name = cleanStr(body.name, 60);
    if (typeof body.discordWebhook === 'string') {
      const wh = cleanStr(body.discordWebhook, 500);
      if (wh && !isValidDiscordWebhook(wh)) throw new HttpError(400, 'URL webhook harus dari Discord (discord.com).');
      user.discordWebhook = wh;
    }
    if (typeof body.discordRoleId === 'string') user.discordRoleId = cleanStr(body.discordRoleId, 30);
    if (typeof body.checkIntervalMin === 'number') {
      user.checkIntervalMin = Math.max(5, Math.min(1440, Math.trunc(body.checkIntervalMin)));
      nextCheckAtByUser.delete(user.id);
    }
    await applyPhotoUpdate(user, body.photo);
    await writeUsers();
    return send(res, 200, { user: publicUser(user) });
  }

  if (pathname === '/api/auth/test-webhook') {
    const user = requireUser(req);
    if (req.method !== 'POST') return send(res, 405, { error: 'Metode tidak diizinkan.' });
    rateLimit(req, 10);
    const body = await readJsonBody(req);
    const webhook = cleanStr(typeof body.webhook === 'string' ? body.webhook : user.discordWebhook, 500);
    if (!webhook) throw new HttpError(400, 'Webhook URL belum diisi.');
    if (!isValidDiscordWebhook(webhook)) throw new HttpError(400, 'URL webhook harus dari Discord (discord.com).');
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const resp = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          username: 'Hideo Wattpad',
          avatar_url: SITE_URL + '/favicon.svg',
          content: '',
          embeds: [
            {
              title: '🧪 Uji Webhook',
              description: 'Webhook kamu berfungsi! Notifikasi update cerita akan terkirim ke sini.',
              color: 3066993,
              footer: { text: 'Hideo Wattpad — ' + (user.email || '') },
              timestamp: new Date().toISOString()
            }
          ]
        })
      });
      clearTimeout(timer);
      if (!resp.ok) {
        const msg = resp.status === 401 || resp.status === 403 || resp.status === 404
          ? 'Webhook tidak valid atau telah dihapus (HTTP ' + resp.status + ').'
          : 'Discord menolak pengiriman (HTTP ' + resp.status + ').';
        throw new HttpError(400, msg);
      }
      return send(res, 200, { ok: true });
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(400, 'Gagal terhubung ke Discord. Periksa kembali URL webhook.');
    }
  }

  if (pathname === '/api/auth/check-webhook') {
    const user = requireUser(req);
    if (req.method !== 'POST') return send(res, 405, { error: 'Metode tidak diizinkan.' });
    rateLimit(req, 10);
    const body = await readJsonBody(req);
    const webhook = cleanStr(typeof body.webhook === 'string' ? body.webhook : user.discordWebhook, 500);
    if (!webhook) throw new HttpError(400, 'Webhook URL belum diisi.');
    if (!isValidDiscordWebhook(webhook)) throw new HttpError(400, 'URL webhook harus dari Discord (discord.com).');
    let reason = '';
    let ok = false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const resp = await fetch(webhook, { method: 'GET', signal: ctrl.signal });
      clearTimeout(timer);
      if (resp.ok) {
        ok = true;
      } else if (resp.status === 401 || resp.status === 404) {
        reason = 'Webhook tidak ditemukan — webhook telah dihapus atau tautan salah.';
      } else if (resp.status === 403) {
        reason = 'Akses ditolak Discord (403) — webhook kehilangan izin.';
      } else if (resp.status === 429) {
        reason = 'Terkena rate limit Discord (429) — terlalu banyak pesan. Tunggu sebentar lalu uji lagi.';
      } else {
        reason = 'Discord merespons tidak normal (HTTP ' + resp.status + ').';
      }
    } catch (err) {
      reason = err && err.name === 'AbortError'
        ? 'Waktu koneksi habis (8 detik) — Discord tidak merespons.'
        : 'Gagal terhubung ke Discord. Periksa koneksi atau URL webhook.';
    }
    return send(res, 200, { ok, reason });
  }

  if (pathname === '/api/auth/password') {
    const user = requireUser(req);
    if (req.method !== 'POST') return send(res, 405, { error: 'Metode tidak diizinkan.' });
    rateLimit(req, 10);
    const body = await readJsonBody(req);
    const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const next = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (!current) throw new HttpError(400, 'Kata sandi saat ini wajib diisi.');
    const pwErr = validatePasswordStrength(next);
    if (pwErr) throw new HttpError(400, pwErr);
    const attempt = Buffer.from(hashPassword(current, user.salt), 'hex');
    const real = Buffer.from(user.hash, 'hex');
    if (attempt.length !== real.length || !crypto.timingSafeEqual(attempt, real)) {
      throw new HttpError(400, 'Kata sandi saat ini salah.');
    }
    user.salt = crypto.randomBytes(16).toString('hex');
    user.hash = hashPassword(next, user.salt);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await writeUsers();
    return send(res, 200, { ok: true });
  }

  if (pathname === '/api/lists') {
    const user = requireUser(req);
    const acct = await loadAccount(user.id);
    if (req.method === 'GET') {
      return send(res, 200, { lists: acct.lists });
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      if (acct.lists.length >= MAX_LISTS) {
        throw new HttpError(409, `Maksimal ${MAX_LISTS} list.`);
      }
      const list = normalizeList(body);
      acct.lists.push(list);
      await saveAccount(user.id);
      return send(res, 201, { list });
    }
    return send(res, 405, { error: 'Metode tidak diizinkan.' });
  }

  const listMatch = pathname.match(/^\/api\/lists\/([0-9a-f-]{36})$/i);
  if (listMatch) {
    const user = requireUser(req);
    const acct = await loadAccount(user.id);
    const lid = listMatch[1].toLowerCase();
    const listIndex = acct.lists.findIndex((l) => l.id.toLowerCase() === lid);
    if (listIndex === -1) {
      return send(res, 404, { error: 'List tidak ditemukan.' });
    }
    if (req.method === 'PUT') {
      const body = await readJsonBody(req);
      const updated = normalizeList({ ...acct.lists[listIndex], ...body }, { keepId: true, keepTimestamps: true });
      acct.lists[listIndex] = updated;
      await saveAccount(user.id);
      return send(res, 200, { list: updated });
    }
    if (req.method === 'DELETE') {
      acct.lists.splice(listIndex, 1);
      for (const s of acct.stories) {
        if (Array.isArray(s.listIds) && s.listIds.length) {
          s.listIds = s.listIds.filter((x) => x !== lid);
        }
      }
      await saveAccount(user.id);
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: 'Metode tidak diizinkan.' });
  }

  if (pathname === '/api/stories') {
    const user = requireUser(req);
    const acct = await loadAccount(user.id);
    if (req.method === 'GET') {
      return send(res, 200, { stories: acct.stories });
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const story = normalizeStory(body);
      if (acct.stories.length >= MAX_STORIES) {
        throw new HttpError(409, `Maksimal ${MAX_STORIES} cerita.`);
      }
      acct.stories.push(story);
      await saveAccount(user.id);
      return send(res, 201, { story });
    }
    return send(res, 405, { error: 'Metode tidak diizinkan.' });
  }

  if (pathname === '/api/updates') {
    if (req.method !== 'GET') return send(res, 405, { error: 'Metode tidak diizinkan.' });
    const user = requireUser(req);
    await ensureUpdatesLoaded();
    const items = updatesListOf(user.id);
    return send(res, 200, { items, unread: items.filter((i) => i.isNew).length, nextCheckAt: nextCheckAtByUser.get(user.id) || null, interval: checkIntervalOf(user) });
  }

  if (pathname === '/api/updates/check') {
    if (req.method !== 'POST') return send(res, 405, { error: 'Metode tidak diizinkan.' });
    rateLimit(req, 12);
    const user = requireUser(req);
    await ensureUpdatesLoaded();
    const { checked } = await checkUpdatesForUser(user);
    nextCheckAtByUser.set(user.id, Date.now() + checkIntervalOf(user) * 60_000);
    const items = updatesListOf(user.id);
    return send(res, 200, { checked, items, unread: items.filter((i) => i.isNew).length, nextCheckAt: nextCheckAtByUser.get(user.id) || null, interval: checkIntervalOf(user) });
  }

  if (pathname === '/api/updates/seen') {
    if (req.method !== 'POST') return send(res, 405, { error: 'Metode tidak diizinkan.' });
    rateLimit(req, 60);
    const user = requireUser(req);
    await ensureUpdatesLoaded();
    const body = await readJsonBody(req);
    const sid = cleanStr(body.storyId, 40).toLowerCase();
    const map = updatesByUser.get(user.id) || {};
    const entry = map[sid];
    if (!entry) throw new HttpError(404, 'Notifikasi tidak ditemukan.');
    entry.known = entry.latest;
    entry.isNew = false;
    queueUpdatesSave();
    const acct = await loadAccount(user.id);
    const st = acct.stories.find((s) => s.id.toLowerCase() === sid);
    if (st && entry.latest > 0) {
      st.chaptersTotal = entry.latest;
      st.updatedAt = Date.now();
      await saveAccount(user.id);
    }
    return send(res, 200, { ok: true, item: { storyId: sid, known: entry.known, latest: entry.latest, isNew: false } });
  }

  const match = pathname.match(/^\/api\/stories\/([0-9a-f-]{36})$/i);
  if (match) {
    const user = requireUser(req);
    const acct = await loadAccount(user.id);
    const id = match[1].toLowerCase();
    const index = acct.stories.findIndex((s) => s.id.toLowerCase() === id);
    if (index === -1) {
      return send(res, 404, { error: 'Cerita tidak ditemukan.' });
    }
    if (req.method === 'PUT') {
      const body = await readJsonBody(req);
      const updated = normalizeStory({ ...acct.stories[index], ...body }, { keepId: true, keepTimestamps: true });
      acct.stories[index] = updated;
      await saveAccount(user.id);
      return send(res, 200, { story: updated });
    }
    if (req.method === 'DELETE') {
      acct.stories.splice(index, 1);
      await saveAccount(user.id);
      const updatesMap = updatesByUser.get(user.id);
      if (updatesMap && updatesMap[id]) {
        delete updatesMap[id];
        queueUpdatesSave();
      }
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: 'Metode tidak diizinkan.' });
  }

  return send(res, 404, { error: 'Endpoint tidak ditemukan.' });
}

const server = http.createServer(async (req, res) => {
  try {
    let url;
    try {
      url = new URL(req.url || '/', 'http://internal.local');
    } catch {
      return send(res, 400, { error: 'URL tidak valid.' });
    }
    const pathname = url.pathname;
    if (pathname.length > 2048) {
      return send(res, 414, { error: 'URL terlalu panjang.' });
    }
    if (pathname.startsWith('/api/')) {
      rateLimit(req, 300);
      if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        assertSameOrigin(req);
      }
      return await handleApi(req, res, pathname);
    }
    return await serveStatic(req, res, pathname);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error('[server]', err);
    if (!res.headersSent) {
      return send(res, status, { error: status === 500 ? 'Terjadi kesalahan internal.' : err.message });
    }
    res.destroy();
  }
});

process.on('unhandledRejection', (err) => console.error('[unhandled]', err));

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nMenyimpan data sebelum keluar...');
  const timeout = new Promise((r) => setTimeout(r, 2500).unref());
  await Promise.race([
    Promise.all([saveChain, writeHeartbeat({ cleaned: true }), sendOwnerStatusMessage('down')]),
    timeout
  ]);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

(async () => {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(ACCOUNTS_DIR, { recursive: true });
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  try {
    sessionSecret = (await fsp.readFile(SECRET_FILE, 'utf8')).trim();
    if (sessionSecret.length < 32) throw new Error('secret lemah');
  } catch {
    sessionSecret = crypto.randomBytes(48).toString('hex');
    await fsp.writeFile(SECRET_FILE, sessionSecret, { mode: 0o600 });
  }
  await loadUsers();
  await backup('boot');
  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  Hideo Wattpad siap!');
    console.log(`  Buka: http://localhost:${PORT}`);
    console.log(`  Data akun tersimpan di: ${ACCOUNTS_DIR}`);
    console.log('');
    (async () => {
      const prev = await readHeartbeat();
      const stale = prev && Date.now() - prev.lastSeen > HEARTBEAT_INTERVAL_MS * 2;
      await writeHeartbeat({ cleaned: false });
      if (stale && !prev.cleaned) {
        await sendOwnerStatusMessage('down');
      }
      sendOwnerStatusMessage('up').catch(() => {});
    })();
  });
  setInterval(() => writeHeartbeat({ cleaned: false }).catch(() => {}), HEARTBEAT_INTERVAL_MS).unref();
})();
