// Save backups: copy a game's own files (saves, settings, mods) out of its install folder.
// Anything that came in the release download is skipped, as are large files the game can rebuild.
'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const SKIP_EXT = /\.(z64|n64|v64|sfc|smc|nes|gb|gbc|gba|nds|iso|rvz|gcm|wbfs|ciso|cso|chd|bin|cue|o2r|otr|exe|dll|so|dylib|pdb|log|tmp)$/i;
const SKIP_DIRS = /^(logs?|cache|shadercache|crashdumps?)$/i;
const MAX_FILE = 64 * 1024 * 1024;

async function walk(dir, base = dir, out = []) {
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.test(e.name)) await walk(full, base, out); continue; }
    if (!e.isFile()) continue;
    const st = await fsp.stat(full);
    out.push({ rel: path.relative(base, full).split(path.sep).join('/'), size: st.size, mtime: Math.round(st.mtimeMs) });
  }
  return out;
}

/** List of files a release shipped with (relative paths), recorded right after install. */
async function makeManifest(dir) {
  return (await walk(dir)).map((f) => f.rel);
}

/**
 * Which files in an install folder belong to the player.
 * With a manifest: anything not in the release, plus release files changed since install (e.g. a default config the game rewrote).
 * Without one (installed before backups existed): files changed after the install date.
 */
async function userFiles(dir, { manifest, installedAt } = {}) {
  const shipped = manifest ? new Map(manifest.map((r) => [r.toLowerCase(), true])) : null;
  const files = await walk(dir);
  return files.filter((f) => {
    if (SKIP_EXT.test(f.rel) || f.size > MAX_FILE) return false;
    if (/(^|\/)portable\.txt$/i.test(f.rel)) return false;
    if (shipped) return !shipped.has(f.rel.toLowerCase()) || (installedAt && f.mtime > installedAt + 120000);
    return installedAt ? f.mtime > installedAt + 120000 : true;
  });
}

const stamp = (d = new Date()) => d.toISOString().replace(/[:T]/g, '-').replace(/\.(\d+)Z$/, '-$1');

/** Copy files into backupRoot/<gameId>/<timestamp>/ with an info.json. Returns the backup, or null if nothing to save. */
async function createBackup({ gameDir, backupRoot, gameId, files, reason, extra = [] }) {
  if (!files.length && !extra.length) return null;
  let id = stamp();
  let dest = path.join(backupRoot, gameId, id);
  for (let n = 2; fs.existsSync(dest); n++) { id = `${stamp()}-${n}`; dest = path.join(backupRoot, gameId, id); } // never overwrite
  await fsp.mkdir(dest, { recursive: true });
  let size = 0;
  for (const f of files) {
    const to = path.join(dest, 'game', ...f.rel.split('/'));
    await fsp.mkdir(path.dirname(to), { recursive: true });
    await fsp.copyFile(path.join(gameDir, ...f.rel.split('/')), to);
    size += f.size;
  }
  // folders outside the install (e.g. %APPDATA%\sm64coopdx)
  for (const ex of extra) {
    if (!fs.existsSync(ex.path)) continue;
    const exFiles = (await walk(ex.path)).filter((f) => !SKIP_EXT.test(f.rel) && f.size <= MAX_FILE);
    for (const f of exFiles) {
      const to = path.join(dest, 'extra', ex.key, ...f.rel.split('/'));
      await fsp.mkdir(path.dirname(to), { recursive: true });
      await fsp.copyFile(path.join(ex.path, ...f.rel.split('/')), to);
      size += f.size;
    }
  }
  const info = { id, gameId, reason, createdAt: Date.now(), files: files.length, size, fingerprint: fingerprint(files), extra: extra.map((e) => ({ key: e.key, path: e.path })) };
  await fsp.writeFile(path.join(dest, 'info.json'), JSON.stringify(info, null, 2));
  return { ...info, dir: dest };
}

/** Quick signature of a file set, to skip backups when nothing changed. */
function fingerprint(files) {
  return files.map((f) => `${f.rel}:${f.size}:${f.mtime}`).sort().join('|');
}

async function listBackups(backupRoot, gameId) {
  const dir = path.join(backupRoot, gameId);
  const out = [];
  for (const id of await fsp.readdir(dir).catch(() => [])) {
    try {
      const info = JSON.parse(await fsp.readFile(path.join(dir, id, 'info.json'), 'utf8'));
      out.push({ ...info, dir: path.join(dir, id) });
    } catch { /* not a backup */ }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** Put a backup's files back. Files the game has now but the backup doesn't are left alone. */
async function restoreBackup(backup, gameDir) {
  const gameFiles = path.join(backup.dir, 'game');
  if (fs.existsSync(gameFiles)) await fsp.cp(gameFiles, gameDir, { recursive: true, force: true });
  for (const ex of backup.extra || []) {
    const src = path.join(backup.dir, 'extra', ex.key);
    if (fs.existsSync(src)) { await fsp.mkdir(ex.path, { recursive: true }); await fsp.cp(src, ex.path, { recursive: true, force: true }); }
  }
}

/** Keep the newest `keep` automatic backups per game; manual ones are never pruned. */
async function prune(backupRoot, gameId, keep = 10) {
  const all = await listBackups(backupRoot, gameId);
  const auto = all.filter((b) => b.reason !== 'manual');
  for (const b of auto.slice(keep)) await fsp.rm(b.dir, { recursive: true, force: true });
}

module.exports = { walk, makeManifest, userFiles, createBackup, listBackups, restoreBackup, prune, fingerprint, stamp };
