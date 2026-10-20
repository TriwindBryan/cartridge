// "Add to Steam": non-Steam game shortcuts (shortcuts.vdf) plus library artwork (config/grid).
// Pure Node so it can be tested; process control is injected.
'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

// ---------------------------------------------------------------- binary VDF
// Steam's shortcuts.vdf is "binary KeyValues": type byte, NUL-terminated key, value.
const T = { MAP: 0x00, STR: 0x01, INT: 0x02, FLOAT: 0x03, PTR: 0x04, WSTR: 0x05, COLOR: 0x06, U64: 0x07, END: 0x08 };

/** Parse into an ordered list of { key, type, value } (maps hold nested lists). */
function parseVdf(buf) {
  let i = 0;
  const cstr = () => { const s = i; while (i < buf.length && buf[i] !== 0) i++; const out = buf.toString('utf8', s, i); i++; return out; };
  const map = () => {
    const entries = [];
    while (i < buf.length) {
      const type = buf[i++];
      if (type === T.END) return entries;
      const key = cstr();
      let value;
      if (type === T.MAP) value = map();
      else if (type === T.STR) value = cstr();
      else if (type === T.INT || type === T.PTR || type === T.COLOR) { value = buf.readInt32LE(i); i += 4; }
      else if (type === T.FLOAT) { value = buf.readFloatLE(i); i += 4; }
      else if (type === T.U64) { value = buf.readBigUInt64LE(i); i += 8; }
      else throw new Error(`Unknown VDF type ${type} at ${i - 1}`);
      entries.push({ key, type, value });
    }
    return entries;
  };
  return map();
}

function writeVdf(entries) {
  const parts = [];
  const cstr = (s) => { parts.push(Buffer.from(String(s), 'utf8'), Buffer.from([0])); };
  const map = (list) => {
    for (const { key, type, value } of list) {
      parts.push(Buffer.from([type]));
      cstr(key);
      if (type === T.MAP) map(value);
      else if (type === T.STR) cstr(value);
      else if (type === T.INT || type === T.PTR || type === T.COLOR) { const b = Buffer.alloc(4); b.writeInt32LE(value | 0); parts.push(b); }
      else if (type === T.FLOAT) { const b = Buffer.alloc(4); b.writeFloatLE(value); parts.push(b); }
      else if (type === T.U64) { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(value)); parts.push(b); }
    }
    parts.push(Buffer.from([T.END]));
  };
  map(entries);
  return Buffer.concat(parts);
}

const get = (list, key) => (list || []).find((e) => e.key.toLowerCase() === key.toLowerCase());

// ---------------------------------------------------------------- ids
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(str) {
  let c = 0xffffffff;
  for (const b of Buffer.from(str, 'utf8')) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
/** The id Steam uses for a non-Steam shortcut (and for its artwork file names). */
function shortcutAppId(exeQuoted, name) {
  return (crc32(exeQuoted + name) | 0x80000000) >>> 0;
}
const quote = (p) => `"${p}"`;

// ---------------------------------------------------------------- finding Steam
function run(cmd, args) {
  return new Promise((resolve) => execFile(cmd, args, { windowsHide: true }, (err, stdout) => resolve(err ? '' : String(stdout))));
}

async function findSteamRoot(platform = process.platform) {
  const candidates = [];
  if (platform === 'win32') {
    const out = await run('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath']);
    const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (m) candidates.push(m[1].trim().replace(/\//g, '\\'));
    candidates.push('C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam');
  } else if (platform === 'linux') {
    const h = os.homedir();
    candidates.push(path.join(h, '.steam', 'steam'), path.join(h, '.local', 'share', 'Steam'), path.join(h, '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam'));
  } else if (platform === 'darwin') {
    candidates.push(path.join(os.homedir(), 'Library', 'Application Support', 'Steam'));
  }
  for (const c of candidates) if (fs.existsSync(path.join(c, 'userdata'))) return c;
  return null;
}

/** The Steam account that was used most recently (its userdata folder). */
async function findUserDir(steamRoot) {
  const base = path.join(steamRoot, 'userdata');
  let best = null;
  for (const id of await fsp.readdir(base).catch(() => [])) {
    if (!/^\d+$/.test(id) || id === '0') continue;
    const cfg = path.join(base, id, 'config');
    let t = 0;
    for (const f of ['localconfig.vdf', 'shortcuts.vdf']) {
      try { t = Math.max(t, (await fsp.stat(path.join(cfg, f))).mtimeMs); } catch { /* missing */ }
    }
    try { t = Math.max(t, (await fsp.stat(path.join(base, id))).mtimeMs); } catch { /* missing */ }
    if (!best || t > best.t) best = { id, dir: path.join(base, id), t };
  }
  return best;
}

async function isSteamRunning(platform = process.platform) {
  if (platform === 'win32') return /steam\.exe/i.test(await run('tasklist', ['/FI', 'IMAGENAME eq steam.exe', '/NH']));
  if (platform === 'darwin') return (await run('pgrep', ['-x', 'steam_osx'])).trim().length > 0;
  if (platform === 'linux') return (await run('pgrep', ['-x', 'steam'])).trim().length > 0;
  return false;
}

// ---------------------------------------------------------------- shortcuts
async function readShortcuts(userDir) {
  const file = path.join(userDir, 'config', 'shortcuts.vdf');
  let root;
  try { root = parseVdf(await fsp.readFile(file)); } catch { root = []; }
  let sc = get(root, 'shortcuts');
  if (!sc) { sc = { key: 'shortcuts', type: T.MAP, value: [] }; root.push(sc); }
  return { file, root, list: sc };
}

async function saveShortcuts({ file, root, list }) {
  // keep keys "0","1",... in order, as Steam does
  list.value.forEach((e, i) => { e.key = String(i); });
  await fsp.mkdir(path.dirname(file), { recursive: true });
  try { await fsp.copyFile(file, `${file}.cartridge-backup`); } catch { /* first shortcut */ }
  const tmp = `${file}.tmp`;
  await fsp.writeFile(tmp, writeVdf(root));
  await fsp.rename(tmp, file);
}

function shortcutEntry({ appid, name, exe, startDir, icon, tags }) {
  return [
    { key: 'appid', type: T.INT, value: appid | 0 },
    { key: 'AppName', type: T.STR, value: name },
    { key: 'Exe', type: T.STR, value: quote(exe) },
    { key: 'StartDir', type: T.STR, value: quote(startDir) },
    { key: 'icon', type: T.STR, value: icon || '' },
    { key: 'ShortcutPath', type: T.STR, value: '' },
    { key: 'LaunchOptions', type: T.STR, value: '' },
    { key: 'IsHidden', type: T.INT, value: 0 },
    { key: 'AllowDesktopConfig', type: T.INT, value: 1 },
    { key: 'AllowOverlay', type: T.INT, value: 1 },
    { key: 'OpenVR', type: T.INT, value: 0 },
    { key: 'Devkit', type: T.INT, value: 0 },
    { key: 'DevkitGameID', type: T.STR, value: '' },
    { key: 'DevkitOverrideAppID', type: T.INT, value: 0 },
    { key: 'LastPlayTime', type: T.INT, value: 0 },
    { key: 'FlatpakAppID', type: T.STR, value: '' },
    { key: 'tags', type: T.MAP, value: (tags || []).map((t, i) => ({ key: String(i), type: T.STR, value: t })) },
  ];
}

const sameExe = (entry, exe) => {
  const e = get(entry.value, 'Exe');
  return e && e.value.replace(/"/g, '').toLowerCase() === exe.toLowerCase();
};

/** Add (or update) a shortcut. Returns the appid used for artwork. */
async function addShortcut(userDir, { name, exe, startDir, icon, tags }) {
  const sc = await readShortcuts(userDir);
  const appid = shortcutAppId(quote(exe), name);
  const fresh = shortcutEntry({ appid, name, exe, startDir, icon, tags });
  const existing = sc.list.value.find((e) => sameExe(e, exe));
  if (existing) {
    // keep the user's play time and hidden state
    for (const keep of ['LastPlayTime', 'IsHidden']) {
      const old = get(existing.value, keep);
      if (old) get(fresh, keep).value = old.value;
    }
    existing.value = fresh;
  } else {
    sc.list.value.push({ key: '', type: T.MAP, value: fresh });
  }
  await saveShortcuts(sc);
  return appid;
}

async function removeShortcut(userDir, exe) {
  const sc = await readShortcuts(userDir);
  const before = sc.list.value.length;
  sc.list.value = sc.list.value.filter((e) => !sameExe(e, exe));
  if (sc.list.value.length !== before) await saveShortcuts(sc);
  return before - sc.list.value.length;
}

async function hasShortcut(userDir, exe) {
  const sc = await readShortcuts(userDir);
  return sc.list.value.some((e) => sameExe(e, exe));
}

/** Write library artwork. art = { portrait, wide, hero, logo } as PNG Buffers. */
async function writeArtwork(userDir, appid, art) {
  const grid = path.join(userDir, 'config', 'grid');
  await fsp.mkdir(grid, { recursive: true });
  const names = { portrait: `${appid}p.png`, wide: `${appid}.png`, hero: `${appid}_hero.png`, logo: `${appid}_logo.png` };
  const written = [];
  for (const [kind, file] of Object.entries(names)) {
    if (!art || !art[kind]) continue;
    await fsp.writeFile(path.join(grid, file), art[kind]);
    written.push(file);
  }
  return written;
}

async function removeArtwork(userDir, appid) {
  const grid = path.join(userDir, 'config', 'grid');
  for (const f of [`${appid}p.png`, `${appid}.png`, `${appid}_hero.png`, `${appid}_logo.png`]) await fsp.rm(path.join(grid, f), { force: true });
}

module.exports = {
  T, parseVdf, writeVdf, crc32, shortcutAppId, findSteamRoot, findUserDir, isSteamRunning,
  addShortcut, removeShortcut, hasShortcut, writeArtwork, removeArtwork, readShortcuts,
};
