'use strict';

// Monitor eksternal Hideo Wattpad.
//
// Server utama tidak bisa melaporkan dirinya sendiri saat prosesnya mati
// (crash, OOM, kill -9, atau host mati). Script ini berjalan sebagai proses
// terpisah dan memverifikasi /api/health secara berkala, lalu mengirim
// "🔴 Server Nonaktif" ke webhook Discord ketika server tidak merespons.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

try {
  const envRaw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const line of envRaw.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {}

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'monitor-state.json');
const HEARTBEAT_FILE = path.join(DATA_DIR, 'heartbeat.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOG_FILE = path.join(DATA_DIR, 'monitor.log');

const PORT = Number(process.env.PORT) || 3000;
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/health`;
const SITE_URL = 'https://wattpad.hideo.id';
const OWNER_NOTIFY_EMAIL = 'adinata79177@gmail.com';
const OWNER_CONTACT_NAME = String(process.env.OWNER_CONTACT_NAME || 'Hideosyifa').trim() || 'Hideosyifa';
const OWNER_CONTACT_ID = /^<?@?!?\d{15,25}>?$/.test(String(process.env.OWNER_CONTACT_ID || '').trim())
  ? String(process.env.OWNER_CONTACT_ID).trim().replace(/^<@!?>|>$/g, '')
  : '';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL || '';
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK_URL || '';
const ALERT_ROLE_ID = /^<?@?!?\d{15,25}>?$/.test(String(process.env.ALERT_ROLE_ID || '').trim())
  ? String(process.env.ALERT_ROLE_ID).trim().replace(/^<@!?>|>$/g, '')
  : '';
// Alert status server dimatikan secara default (hanya notifikasi update cerita).
const STATUS_ALERTS_ENABLED = String(process.env.STATUS_ALERTS_ENABLED || '').trim() === '1';

const INTERVAL_MS = Math.max(5, Number(process.env.MONITOR_INTERVAL_SEC || 15) || 15) * 1000;
const FAIL_THRESHOLD = Math.max(1, Number(process.env.MONITOR_FAIL_THRESHOLD || 3) || 3);
const PROBE_TIMEOUT_MS = Math.max(2000, Number(process.env.MONITOR_PROBE_TIMEOUT_MS || 5000) || 5000);
const REPEAT_NOTIFY_MS = Math.max(60, Number(process.env.MONITOR_REPEAT_MIN || 30) || 30) * 60_000;
const CRASH_WINDOW_MS = 15 * 60_000;
const CRASH_THRESHOLD = Math.max(2, Number(process.env.MONITOR_CRASH_THRESHOLD || 3) || 3);
const CRASH_RECOVER_UPTIME_MS = 5 * 60_000;
const LOG_MAX_BYTES = 512 * 1024;

const DOWN_REASON_DOWN = 'unreachable';
const DOWN_REASON_CRASH = 'crashloop';

let state = {
  checkedAt: 0,
  failStreak: 0,
  firstFailAt: 0,
  alertActive: false,
  alertReason: '',
  alertStartedAt: 0,
  notifiedAt: 0,
  lastUpNotifiedAt: 0,
  restarts: []
};

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(msg) {
  const line = `[${ts()}] ${msg}`;
  console.log(line);
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > LOG_MAX_BYTES) fs.truncateSync(LOG_FILE, 0);
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch {}
}

function isValidDiscordWebhook(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    if (u.port || u.username || u.password) return false;
    if (u.hostname !== 'discord.com' && u.hostname !== 'discordapp.com') return false;
    return /^\/api\/webhooks\/[\w-]+\/[\w-]+$/.test(u.pathname);
  } catch {
    return false;
  }
}

function ownerNotify() {
  if (isValidDiscordWebhook(ALERT_WEBHOOK)) {
    return { webhook: ALERT_WEBHOOK, roleId: ALERT_ROLE_ID };
  }
  try {
    const arr = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (Array.isArray(arr)) {
      const owner = arr.find((u) => u && typeof u === 'object' && u.email === OWNER_NOTIFY_EMAIL);
      const own = owner && typeof owner.discordWebhook === 'string' ? owner.discordWebhook : '';
      if (own && isValidDiscordWebhook(own)) {
        return { webhook: own, roleId: typeof owner.discordRoleId === 'string' ? owner.discordRoleId : '' };
      }
    }
  } catch {}
  if (isValidDiscordWebhook(DISCORD_WEBHOOK)) return { webhook: DISCORD_WEBHOOK, roleId: '' };
  return { webhook: '', roleId: '' };
}

function durationText(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return sec + ' detik';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + ' menit';
  const hour = Math.floor(min / 60);
  if (hour < 24) return hour + ' jam' + (min % 60 ? ' ' + (min % 60) + ' menit' : '');
  return Math.floor(hour / 24) + ' hari' + (hour % 24 ? ' ' + (hour % 24) + ' jam' : '');
}

function contactLine() {
  return OWNER_CONTACT_ID
    ? 'Silahkan Chat Ke <@' + OWNER_CONTACT_ID + '> (' + OWNER_CONTACT_NAME + ')'
    : 'Silahkan Chat Ke ' + OWNER_CONTACT_NAME;
}

function siteLink() {
  return '[🌐 Buka Hideo Wattpad](' + SITE_URL + ')';
}

function heartbeatInfo() {
  try {
    const raw = JSON.parse(fs.readFileSync(HEARTBEAT_FILE, 'utf8'));
    if (raw && Number.isFinite(raw.lastSeen)) {
      return { lastSeen: raw.lastSeen, reason: typeof raw.reason === 'string' ? raw.reason : '', cleaned: raw.cleaned === true };
    }
  } catch {}
  return null;
}

async function postEmbed(embed, ping) {
  if (!STATUS_ALERTS_ENABLED) return false;
  const { webhook, roleId } = ownerNotify();
  if (!webhook) {
    log('Webhook Discord tidak valid — notifikasi dilewati.');
    return false;
  }
  const content = ping && roleId ? '<@&' + roleId + '>' : '';
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 8000);
  try {
    const resp = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        username: 'Hideo Wattpad',
        avatar_url: SITE_URL + '/favicon.svg',
        content: content || undefined,
        embeds: [embed]
      })
    });
    if (!resp.ok) {
      log('Discord menolak notifikasi (HTTP ' + resp.status + ').');
      return false;
    }
    return true;
  } catch (err) {
    log('Gagal mengirim notifikasi: ' + (err && err.message ? err.message : err));
    return false;
  } finally {
    clearTimeout(to);
  }
}

function downEmbed(reason, downtimeMs) {
  const hb = heartbeatInfo();
  const lastSeenText = hb && hb.lastSeen ? new Date(hb.lastSeen).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'tidak diketahui';
  const description =
    (reason === DOWN_REASON_CRASH
      ? 'Server Hideo Wattpad sering mati / restart terus-menerus (crash loop).\n'
      : 'Server Hideo Wattpad sedang mati / berhenti.\n') +
    '**' + contactLine() + '**';
  return {
    title: '🔴 Server Nonaktif',
    description,
    color: 15548997,
    fields: [
      { name: 'Status', value: reason === DOWN_REASON_CRASH ? 'Mati / tidak stabil' : 'Mati / tidak bisa diakses', inline: true },
      { name: 'Downtime', value: durationText(downtimeMs) || 'baru saja mati', inline: true },
      { name: 'Terakhir aktif', value: lastSeenText, inline: true },
      { name: 'Situs', value: siteLink(), inline: true }
    ],
    footer: { text: 'Hideo Wattpad — Status Server' },
    timestamp: new Date().toISOString()
  };
}

function upEmbed(downtimeMs) {
  const dur = durationText(downtimeMs);
  return {
    title: '🟢 Server Aktif',
    description:
      'Server Hideo Wattpad aktif dan berjalan normal.' +
      (dur ? '\nDowntime sebelumnya: ' + dur + '.' : ''),
    color: 3066993,
    fields: [{ name: 'Situs', value: siteLink(), inline: true }],
    footer: { text: 'Hideo Wattpad — Status Server' },
    timestamp: new Date().toISOString()
  };
}

async function loadState() {
  try {
    const raw = JSON.parse(await fsp.readFile(STATE_FILE, 'utf8'));
    if (raw && typeof raw === 'object') {
      state = Object.assign(state, raw);
      if (!Array.isArray(state.restarts)) state.restarts = [];
    }
  } catch {}
  state.checkedAt = 0;
}

function saveState() {
  const tmp = `${STATE_FILE}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmp, STATE_FILE);
  } catch (err) {
    log('Gagal menyimpan state: ' + (err && err.message ? err.message : err));
  }
}

async function probe() {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const resp = await fetch(HEALTH_URL, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!resp.ok) return { ok: false, detail: 'HTTP ' + resp.status, startedAt: 0, uptimeSec: 0 };
    const data = await resp.json();
    return {
      ok: data && data.ok === true,
      detail: data && Number.isFinite(data.uptimeSec) ? 'uptime ' + data.uptimeSec + 's' : 'ok',
      startedAt: Number.isFinite(data && data.startedAt) ? data.startedAt : 0,
      uptimeSec: Number.isFinite(data && data.uptimeSec) ? data.uptimeSec : 0
    };
  } catch (err) {
    return { ok: false, detail: err && err.name === 'AbortError' ? 'timeout' : 'tidak merespons', startedAt: 0, uptimeSec: 0 };
  } finally {
    clearTimeout(to);
  }
}

function recordRestart(startedAt) {
  if (!startedAt) return;
  const now = Date.now();
  state.restarts = state.restarts.filter((r) => Number.isFinite(r.startedAt) && now - r.at < CRASH_WINDOW_MS);
  const last = state.restarts[state.restarts.length - 1];
  if (!last || last.startedAt !== startedAt) state.restarts.push({ startedAt, at: now });
}

function crashCount() {
  const now = Date.now();
  const seen = new Set();
  for (const r of state.restarts) {
    if (Number.isFinite(r.startedAt) && now - r.at < CRASH_WINDOW_MS) seen.add(r.startedAt);
  }
  return seen.size;
}

async function tick() {
  const now = Date.now();
  const res = await probe();
  state.checkedAt = now;

  if (res.ok) {
    recordRestart(res.startedAt);
    state.failStreak = 0;
    state.firstFailAt = 0;
    const crashes = crashCount();
    const unstable = crashes >= CRASH_THRESHOLD;

    if (state.alertActive) {
      const crashNotRecovered = state.alertReason === DOWN_REASON_CRASH && (unstable || res.uptimeSec * 1000 < CRASH_RECOVER_UPTIME_MS);
      if (!crashNotRecovered) {
        const downtimeMs = state.alertStartedAt ? now - state.alertStartedAt : 0;
        const sent = await postEmbed(upEmbed(downtimeMs), false);
        if (sent) {
          log('🟢 Server pulih — downtime ' + (durationText(downtimeMs) || 'sebentar') + '.');
          state.lastUpNotifiedAt = now;
        }
        const wasCrash = state.alertReason === DOWN_REASON_CRASH;
        state.alertActive = false;
        state.alertReason = '';
        state.alertStartedAt = 0;
        if (sent) state.notifiedAt = now;
        if (wasCrash) state.restarts = [];
      } else if (now - state.notifiedAt > REPEAT_NOTIFY_MS) {
        await postEmbed(downEmbed(state.alertReason, now - state.alertStartedAt), true);
        state.notifiedAt = now;
        log('🔁 Pengingat: server masih bermasalah (' + state.alertReason + ').');
      }
    } else if (unstable && now - state.lastUpNotifiedAt > REPEAT_NOTIFY_MS) {
      const sent = await postEmbed(downEmbed(DOWN_REASON_CRASH, 0), true);
      if (sent) {
        state.alertActive = true;
        state.alertReason = DOWN_REASON_CRASH;
        state.alertStartedAt = now;
        state.notifiedAt = now;
        log('🔴 Crash loop terdeteksi (' + crashes + ' restart dalam ' + Math.round(CRASH_WINDOW_MS / 60000) + ' menit).');
      }
    }
    saveState();
    return;
  }

  // Server tidak merespons.
  state.failStreak += 1;
  if (!state.firstFailAt) state.firstFailAt = now;

  if (!state.alertActive) {
    if (state.failStreak < FAIL_THRESHOLD) {
      log('⚠️ Cek gagal (' + state.failStreak + '/' + FAIL_THRESHOLD + '): ' + res.detail);
      saveState();
      return;
    }
    const sent = await postEmbed(downEmbed(DOWN_REASON_DOWN, now - state.firstFailAt), true);
    if (sent) {
      state.alertActive = true;
      state.alertReason = DOWN_REASON_DOWN;
      state.alertStartedAt = state.firstFailAt;
      state.notifiedAt = now;
      log('🔴 Server tidak merespons — notifikasi "Server Nonaktif" terkirim.');
    }
    saveState();
    return;
  }

  if (state.alertReason === DOWN_REASON_DOWN && now - state.notifiedAt > REPEAT_NOTIFY_MS) {
    const sent = await postEmbed(downEmbed(DOWN_REASON_DOWN, now - state.alertStartedAt), true);
    if (sent) state.notifiedAt = now;
    log('🔁 Pengingat: server masih mati (' + durationText(now - state.alertStartedAt) + ').');
  }
  saveState();
}

let running = false;
async function loop() {
  if (running) return;
  running = true;
  while (true) {
    try {
      await tick();
    } catch (err) {
      log('Error pada tick: ' + (err && err.message ? err.message : err));
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

async function main() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await loadState();
  log('Monitor Hideo Wattpad aktif — cek ' + HEALTH_URL + ' tiap ' + INTERVAL_MS / 1000 + ' detik.');
  if (process.argv.includes('--once')) {
    await tick();
    return;
  }
  await loop();
}

process.on('SIGINT', () => {
  log('Monitor dihentikan.');
  process.exit(0);
});
process.on('SIGTERM', () => {
  log('Monitor dihentikan.');
  process.exit(0);
});

main().catch((err) => {
  log('Monitor gagal dijalankan: ' + (err && err.message ? err.message : err));
  process.exit(1);
});
