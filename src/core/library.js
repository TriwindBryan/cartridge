// The launcher's brain: catalog, ROM library, installs and launching.
// Electron-specific bits (clipboard, shell) are injected so this stays testable.
'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');

const rom = require('./rom');
const romdb = require('./romdb');
const gh = require('./github');
const inst = require('./install');
const community = require('./community');
const metacritic = require('./metacritic');
const backup = require('./backup');
const covers = require('./covers');
const arcade = require('./arcade');
const crypto = require('crypto');
const update = require('./update');

const DAT_BASE = 'https://raw.githubusercontent.com/libretro/libretro-database/master/metadat/';
const RELEASE_TTL = 6 * 60 * 60 * 1000;

class Library extends EventEmitter {
  constructor({ dataDir, catalogFile, platform = process.platform, hooks = {} }) {
    super();
    this.dataDir = dataDir;
    this.catalogFile = catalogFile;
    this.platform = platform;
    this.hooks = hooks; // { copyToClipboard(text), revealFile(path), openExternal(url) }
    try {
      const pkg = require('../../package.json');
      this.version = pkg.version.replace(/\.0$/, '');
      this.links = { ...(pkg.cartridge || {}) };
    } catch { this.version = ''; this.links = {}; }
    this.statePath = path.join(dataDir, 'state.json');
    this.state = {
      settings: { libraryDir: path.join(os.homedir(), 'Cartridge'), githubToken: '', extraCatalogUrl: '', romFolders: [], showMetacritic: false, welcomeSeen: false, checkUpdates: true, backgroundImage: '', backgroundDim: 55, backupDir: '', autoBackup: true, steamGridKey: '' },
      installed: {}, roms: [], romOverride: {}, releases: {}, userGames: [], scanIndex: {}, steam: {}, covers: {},
    };
    this.dats = {};
    this.running = new Map();
    this.jobs = new Map();
    this.coverJobs = new Map();
    this.thumbIdx = {};
    this.slots = 0;
    this.queue = [];
  }

  // ---------- persistence ----------
  async load() {
    await fsp.mkdir(this.dataDir, { recursive: true });
    let hadState = false;
    try {
      const saved = JSON.parse(await fsp.readFile(this.statePath, 'utf8'));
      hadState = true;
      this.state = { ...this.state, ...saved, settings: { ...this.state.settings, ...(saved.settings || {}) } };
    } catch { /* first run */ }
    const base = JSON.parse(await fsp.readFile(this.catalogFile, 'utf8'));
    this.systems = base.systems;
    this.baseGames = base.games;
    if (!this.arcadeDb) {
      try { this.arcadeDb = arcade.load(path.join(path.dirname(this.catalogFile), 'arcade.json')); } catch { this.arcadeDb = null; }
    }
    this.remoteGames = [];
    if (this.state.settings.extraCatalogUrl) {
      try { this.remoteGames = (await (await fetch(this.state.settings.extraCatalogUrl)).json()).games || []; } catch { /* offline */ }
    }
    // Remember when each game first appeared, for "Recently added". Games present on the very first run count as the starting collection (0).
    const seen = this.state.firstSeen || (this.state.firstSeen = {});
    let changed = false;
    for (const g of this.games) if (!(g.id in seen)) { seen[g.id] = hadState ? Date.now() : 0; changed = true; }
    if (changed && hadState) await this.save();
    return this;
  }

  /** Saves are queued so overlapping callers (e.g. a game exiting mid-install) never collide. */
  save() {
    const run = async () => {
      const tmp = `${this.statePath}.${process.pid}.${Date.now()}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(this.state, null, 2));
      await fsp.rename(tmp, this.statePath);
    };
    this.saving = (this.saving || Promise.resolve()).then(run, run);
    return this.saving;
  }

  get dirs() {
    const root = this.state.settings.libraryDir;
    return { root, games: path.join(root, 'Games'), roms: path.join(root, 'ROMs'), downloads: path.join(root, 'Downloads'), backups: this.state.settings.backupDir || path.join(root, 'Backups') };
  }

  get games() {
    const byId = new Map();
    for (const g of [...this.baseGames, ...this.remoteGames, ...this.state.userGames]) byId.set(g.id, g);
    return [...byId.values()];
  }

  game(id) {
    const g = this.games.find((x) => x.id === id);
    if (!g) throw new Error(`Unknown game ${id}`);
    return g;
  }

  // ---------- view model for the UI ----------
  snapshot() {
    const coverOf = (key) => { const c = (this.state.covers || {})[key]; return c && c.file ? c.file : null; };
    const roms = this.state.roms.map((r) => ({ ...r, cover: coverOf(`rom:${r.id}`), customCover: ((this.state.covers || {})[`rom:${r.id}`] || {}).source === 'custom' }));
    // scores saved by an older, buggier page reader are ignored (and looked up again)
    const metaFresh = (id) => { const c = (this.state.metaCache || {})[id]; return !!c && c.v === metacritic.VERSION; };
    const metaOf = (id) => (metaFresh(id) ? this.state.metaCache[id].data || null : null);
    // Match each game only against ROMs for its own console (13,000 ROMs × every game was slow)
    const bySystem = new Map();
    const arcadeRoms = [];
    for (const r of roms) {
      if (!bySystem.has(r.system)) bySystem.set(r.system, []);
      bySystem.get(r.system).push(r);
      if (r.arcade) arcadeRoms.push(r);
    }
    const candidates = (g) => {
      if (this.state.romOverride[g.id]) return roms; // a ROM you picked by hand can be from anywhere
      const list = [...(bySystem.get(g.system) || [])];
      if (g.system === 'gc' || g.system === 'wii') list.push(...(bySystem.get(g.system === 'gc' ? 'wii' : 'gc') || []));
      if (g.system === 'arcade') list.push(...arcadeRoms.filter((r) => r.system !== 'arcade'));
      return list;
    };
    const games = this.games.map((g) => {
      const installed = this.state.installed[g.id] || null;
      const rel = this.state.releases[g.id];
      const match = romdb.bestRomForGame(g, candidates(g), this.state.romOverride[g.id]);
      const latest = rel && rel.data ? rel.data : null;
      return {
        ...g,
        installed,
        inSteam: !!(this.state.steam || {})[g.id],
        cover: coverOf(`game:${g.id}`),
        customCover: ((this.state.covers || {})[`game:${g.id}`] || {}).source === 'custom',
        metacritic: g.metacritic || metaOf(g.id),
        metaChecked: !!g.metacritic || metaFresh(g.id),
        addedAt: Math.max((this.state.firstSeen || {})[g.id] || 0, installed ? installed.installedAt || 0 : 0),
        running: this.running.has(g.id),
        job: Library.publicJob(this.jobs.get(g.id)),
        release: latest,
        releaseError: rel && rel.error ? rel.error : null,
        updateAvailable: !!(installed && latest && latest.tag && latest.tag !== installed.tag),
        romMatch: match ? { romId: match.rom.id, level: match.level, reason: match.reason, label: match.rom.datName || match.rom.originalName, file: match.rom.file } : null,
      };
    });
    return { systems: this.systems, games, roms, scanning: !!this.scanning, settings: { ...this.state.settings, githubToken: this.state.settings.githubToken ? '••••' : '', steamGridKey: this.state.settings.steamGridKey ? '••••' : '' }, dirs: this.dirs, platform: this.platform, version: this.version || '', links: this.links || {}, appUpdate: (this.state.appUpdate || {}).data || null, changelog: path.join(path.dirname(path.dirname(this.catalogFile)), 'CHANGELOG.md') };
  }

  emitChange() { this.emit('change'); }

  static publicJob(j) {
    return j ? { phase: j.phase, progress: j.progress, got: j.got || 0, total: j.total || 0, cancel: !!j.cancel } : null;
  }

  // ---------- settings ----------
  async updateSettings(patch) {
    const next = { ...patch };
    if (next.githubToken === '••••') delete next.githubToken;
    if (next.steamGridKey === '••••') delete next.steamGridKey;
    if ('steamGridKey' in next) {
      // a new key may find covers that were missing before
      for (const [k, c] of Object.entries(this.state.covers || {})) if (c.none) delete this.state.covers[k];
    }
    this.state.settings = { ...this.state.settings, ...next };
    await this.save();
    if ('extraCatalogUrl' in patch) await this.load();
    this.emitChange();
  }

  // ---------- releases ----------
  async refreshReleases({ force = false, ids } = {}) {
    const token = this.state.settings.githubToken;
    const todo = this.games.filter((g) => !g.sourceOnly && g.repo && (!ids || ids.includes(g.id)));
    let changed = false;
    await Promise.all(todo.map(async (g) => {
      const cached = this.state.releases[g.id];
      if (!force && cached && Date.now() - cached.fetchedAt < RELEASE_TTL) return;
      try {
        const rel = await gh.latestRelease(g.repo, token);
        this.state.releases[g.id] = { fetchedAt: Date.now(), data: gh.summariseRelease(rel, g, this.platform) };
      } catch (e) {
        // Keep stale data on rate-limit so the UI still works offline.
        if (cached && cached.data && (e.code === 'RATE_LIMIT' || e.code === 'OFFLINE')) return;
        this.state.releases[g.id] = { fetchedAt: Date.now(), error: e.message, data: cached && cached.data };
      }
      changed = true;
    }));
    if (changed) { await this.save(); this.emitChange(); }
  }

  // ---------- ROM library ----------
  async loadDat(system) {
    const sys = this.systems[system];
    if (!sys || !sys.romDb) return null;
    if (this.dats[system]) return this.dats[system];
    const cache = path.join(this.dataDir, 'romdb', path.basename(sys.romDb));
    let text = null;
    try {
      const st = await fsp.stat(cache);
      if (Date.now() - st.mtimeMs < 30 * 24 * 3600 * 1000) text = await fsp.readFile(cache, 'utf8');
    } catch { /* not cached */ }
    if (!text) {
      try {
        const res = await fetch(DAT_BASE + sys.romDb.split('/').map(encodeURIComponent).join('/'));
        if (res.ok) {
          text = await res.text();
          await fsp.mkdir(path.dirname(cache), { recursive: true });
          await fsp.writeFile(cache, text);
        }
      } catch { /* offline: fall back to cache or header-only */ }
      if (!text) { try { text = await fsp.readFile(cache, 'utf8'); } catch { return null; } }
    }
    this.dats[system] = romdb.parseDat(text);
    return this.dats[system];
  }

  /**
   * Walk files, folders (any depth) and zip/7z archives looking for ROMs.
   * With skipKnown, files already checked in an earlier scan (same size and date) are skipped,
   * so rescanning a big ROM folder at startup is quick.
   */
  async collectRomFiles(paths, tmpDirs, { skipKnown = false } = {}) {
    const out = [];
    const index = this.state.scanIndex || (this.state.scanIndex = {});
    const ownDirs = [this.dirs.roms, this.dirs.games, this.dirs.downloads].map((d) => path.resolve(d).toLowerCase());
    const SKIP_DIRS = /^(\$recycle\.bin|system volume information|windows|program files( \(x86\))?|programdata|appdata|node_modules|\.git)$/i;
    const stamp = (st) => `${st.size}:${Math.round(st.mtimeMs)}`;
    const visit = async (p, depth, archive) => {
      let st;
      try { st = await fsp.stat(p); } catch { return; }
      if (st.isDirectory()) {
        if (depth > 12) return;
        if (!archive && (ownDirs.includes(path.resolve(p).toLowerCase()) || (depth > 0 && SKIP_DIRS.test(path.basename(p))))) return;
        let entries = [];
        try { entries = await fsp.readdir(p); } catch { return; }
        // an extracted PS3 / Vita / Wii U / Xbox game is one game, not hundreds of loose files
        const marker = !archive && rom.dumpMarker(p, entries);
        if (marker) {
          let mst; try { mst = await fsp.stat(marker); } catch { return; }
          if (skipKnown && index[marker] === stamp(mst)) return;
          out.push({ file: marker, shown: path.basename(p), indexKey: marker, stamp: stamp(mst), fromArchive: false });
          return;
        }
        for (const e of entries) await visit(path.join(p, e), depth + 1, archive);
        return;
      }
      const arc = !archive ? arcade.classify(this.arcadeDb, p) : null;
      if (arc) {
        // an arcade set (sf2.zip): the zip itself is the game, and emulators find it by this exact name, so it stays put
        if (skipKnown && index[p] === stamp(st)) return;
        if (arc === 'bios') { index[p] = stamp(st); return; } // neogeo.zip and friends: needed by games, not games themselves
        out.push({ file: p, shown: path.basename(p), indexKey: p, stamp: stamp(st), fromArchive: false, arcade: true });
        return;
      }
      if (rom.systemForExtension(p) && !/^(param\.sfo|meta\.xml)$/i.test(path.basename(p))) {
        if (!archive && skipKnown && index[p] === stamp(st)) return;
        out.push({ file: p, shown: archive ? `${path.basename(archive.file)} › ${path.basename(p)}` : path.basename(p), indexKey: archive ? archive.file : p, stamp: archive ? archive.stamp : stamp(st), fromArchive: !!archive });
      } else if (!archive && /\.(zip|7z)$/i.test(p) && st.size < 256 * 1024 * 1024) {
        if (skipKnown && index[p] === stamp(st)) return;
        const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'cartridge-rom-'));
        tmpDirs.push(tmp);
        try {
          await inst.extract(p, tmp);
          const before = out.length;
          await visit(tmp, depth + 1, { file: p, stamp: stamp(st) });
          if (out.length === before) index[p] = stamp(st); // a zip with no ROMs: remember it so we don't reopen it
        } catch { index[p] = stamp(st); /* not an archive we can read */ }
      }
    };
    for (const p of paths) await visit(p, 0, null);
    // a .cue already covers its .bin tracks, so don't list those separately
    const tracks = new Set(out.filter((f) => /\.cue$/i.test(f.file)).flatMap((f) => rom.cueTracks(f.file)).map((t) => path.resolve(t).toLowerCase()));
    return tracks.size ? out.filter((f) => !tracks.has(path.resolve(f.file).toLowerCase())) : out;
  }

  /** Add ROM files / folders / zips. Returns a per-file report for the UI. */
  async addRoms(paths, opts = {}) {
    const tmpDirs = [];
    const report = [];
    try {
      const files = await this.collectRomFiles(paths, tmpDirs, opts);
      const index = this.state.scanIndex;
      const remember = (f) => { if (f.indexKey) index[f.indexKey] = f.stamp; };
      await fsp.mkdir(this.dirs.roms, { recursive: true });
      for (const f of files) {
        const { file, shown } = f;
        try {
          const info = f.arcade ? arcade.inspect(this.arcadeDb, file) : await (this.hooks.inspectRom || rom.inspectRom)(file);
          const dat = await this.loadDat(info.system);
          let datHit = dat && info.sha1 ? dat.bySha1.get(info.sha1) : null;
          if (!datHit && dat && info.alt && dat.bySha1.get(info.alt.sha1)) {
            // this database lists the dump with its header kept, so keep it too
            datHit = dat.bySha1.get(info.alt.sha1);
            Object.assign(info, { data: info.alt.data, sha1: info.alt.sha1, size: info.alt.data.length });
          }
          const id = info.arcade ? `arcade-${info.arcade.set}` : info.sha1 || `${info.system}-${info.serial || ''}-${info.size}-${(info.internalName || path.basename(file)).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          if (this.state.roms.some((r) => r.id === id)) { remember(f); report.push({ file: shown, status: 'duplicate', id, system: info.system, name: datHit ? datHit.name : info.internalName }); continue; }

          let stored = file;
          if (!info.data && f.fromArchive) {
            // a disc pulled out of a zip: keep a copy (and its .bin tracks) since the temporary folder is deleted
            const dest = path.join(this.dirs.roms, path.basename(file, path.extname(file)).replace(/[<>:"/\\|?*]/g, '_'));
            await fsp.mkdir(dest, { recursive: true });
            for (const part of [file, ...(info.tracks || [])]) if (fs.existsSync(part)) await fsp.copyFile(part, path.join(dest, path.basename(part)));
            stored = path.join(dest, path.basename(file));
          }
          if (info.data) {
            const ext = info.storeExt || path.extname(file);
            const base = (datHit ? datHit.name : path.basename(file, path.extname(file))).replace(/[<>:"/\\|?*]/g, '_');
            stored = path.join(this.dirs.roms, base + ext);
            await fsp.writeFile(stored, info.data);
          }
          const entry = {
            id, file: stored, originalName: path.basename(file), system: info.system, sha1: info.sha1,
            serial: (datHit && datHit.serial) || info.serial, internalName: info.internalName,
            datName: datHit ? datHit.name : null, size: info.size, format: info.format, addedAt: Date.now(), byName: !!info.byName,
            ...(info.arcade ? { arcade: info.arcade } : {}),
          };
          this.state.roms.push(entry);
          remember(f);
          const unlocks = this.games.filter((g) => romdb.matchRomToGame(entry, g).level).map((g) => g.port);
          report.push({ file: shown, status: 'added', id, system: info.system, name: entry.datName || entry.internalName || entry.originalName, verified: !!datHit, unlocks });
        } catch (e) {
          remember(f); // don't re-check a bad file on every startup
          report.push({ file: shown, status: 'error', error: e.message });
        }
      }
      await this.save();
      this.emitChange();
      return report;
    } finally {
      for (const t of tmpDirs) fsp.rm(t, { recursive: true, force: true }).catch(() => {});
    }
  }

  // ---------- ROM folders (scanned now and on every start) ----------
  async addRomFolder(dir) {
    const folders = this.state.settings.romFolders || [];
    if (!folders.some((f) => path.resolve(f).toLowerCase() === path.resolve(dir).toLowerCase())) {
      this.state.settings.romFolders = [...folders, dir];
      await this.save();
    }
    return this.addRoms([dir], { skipKnown: true });
  }

  async removeRomFolder(dir) {
    this.state.settings.romFolders = (this.state.settings.romFolders || []).filter((f) => f !== dir);
    await this.save();
    this.emitChange();
  }

  /** Rescan every saved folder; only new or changed files are opened. */
  async scanRomFolders({ full = false } = {}) {
    if (this.scanning) return this.scanning;
    const log = this.hooks.log || (() => {});
    // A sleeping or disconnected drive (a NAS, a USB disk) can take a long time to answer, so check without waiting on it forever
    const reachable = (f) => Promise.race([fsp.stat(f).then(() => true, () => false), new Promise((r) => setTimeout(() => r(false), 15000))]);
    const all = this.state.settings.romFolders || [];
    const ok = await Promise.all(all.map(reachable));
    const folders = all.filter((_, i) => ok[i]);
    for (const f of all.filter((_, i) => !ok[i])) log(`ROM folder not reachable, skipped: ${f}`);
    if (!folders.length || this.scanning) return this.scanning || [];
    this.emit('scan', true);
    const t0 = Date.now();
    this.scanning = this.addRoms(folders, { skipKnown: !full })
      .then((report) => { log(`Scanned ${folders.length} ROM folder(s) in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${report.filter((r) => r.status === 'added').length} added, ${report.length} checked`); return report; })
      .finally(() => { this.scanning = null; this.emit('scan', false); });
    return this.scanning;
  }

  async removeRom(id) {
    const r = this.state.roms.find((x) => x.id === id);
    if (!r) return;
    this.state.roms = this.state.roms.filter((x) => x.id !== id);
    if (r.file.startsWith(this.dirs.roms)) await fsp.rm(r.file, { force: true });
    for (const [g, rid] of Object.entries(this.state.romOverride)) if (rid === id) delete this.state.romOverride[g];
    await this.save();
    this.emitChange();
  }

  async assignRom(gameId, romId) {
    if (romId) this.state.romOverride[gameId] = romId; else delete this.state.romOverride[gameId];
    await this.save();
    this.emitChange();
  }

  // ---------- install / update / uninstall ----------
  setJob(id, job) {
    if (job) this.jobs.set(id, job); else this.jobs.delete(id);
    this.emit('job', id, job);
  }

  async install(gameId) {
    if (this.jobs.has(gameId)) return;
    const g = this.game(gameId);
    const controller = new AbortController();
    this.setJob(gameId, { phase: 'Checking for the latest release', progress: 0, cancel: true });
    this.jobs.get(gameId).abort = controller;
    let archive;
    try {
      await this.refreshReleases({ force: true, ids: [gameId] });
      const rel = this.state.releases[gameId];
      if (!rel || !rel.data) throw new Error(rel && rel.error ? rel.error : 'No release found');
      const { asset, tag } = rel.data;
      if (!asset) throw new Error(`This release has no ${{ darwin: 'Mac', linux: 'Linux' }[this.platform] || 'Windows'} download yet. Check the project page.`);

      archive = path.join(this.dirs.downloads, `${gameId}-${asset.name}`);
      await inst.download(asset.url, archive, {
        signal: controller.signal, digest: asset.digest,
        onProgress: (p, got, total) => this.setJob(gameId, { phase: 'Downloading', progress: p, got, total, cancel: true, abort: controller }),
      });

      this.setJob(gameId, { phase: 'Unpacking', progress: null });
      const target = path.join(this.dirs.games, gameId);
      const staging = path.join(this.dirs.downloads, `${gameId}-staging`);
      await fsp.rm(staging, { recursive: true, force: true });
      if (/\.(exe|appimage)$/i.test(asset.name)) {
        await fsp.mkdir(staging, { recursive: true });
        await fsp.copyFile(archive, path.join(staging, asset.name));
      } else {
        await inst.extract(archive, staging);
      }
      const content = await inst.unwrap(staging);
      const prevInstall = this.state.installed[gameId];
      if (prevInstall && fs.existsSync(target)) {
        this.setJob(gameId, { phase: 'Backing up your saves', progress: null });
        await this.backupGame(gameId, 'before update').catch(() => null);
        this.setJob(gameId, { phase: 'Unpacking', progress: null });
      }
      // remember which files came with the download, so backups can tell them apart from saves
      const shipped = await backup.makeManifest(content);
      await this.saveManifest(gameId, shipped);
      await inst.mergeInto(content, target); // keeps saves/configs from a previous version
      await fsp.rm(staging, { recursive: true, force: true });

      for (const f of g.filesToAdd || []) {
        const p = path.join(target, f);
        if (!fs.existsSync(p)) await fsp.writeFile(p, '');
      }
      const exe = await inst.findExecutable(target, g.exe, this.platform);
      if (!exe) throw new Error(this.platform === 'darwin' ? "Installed, but couldn't find the game's app. Open the folder to start it manually." : "Installed, but couldn't find the game's .exe. Open the folder to start it manually.");
      if (this.platform === 'darwin') await inst.clearQuarantine(target);
      else if (this.platform !== 'win32') await fsp.chmod(exe, 0o755).catch(() => {});
      // portable.txt must sit next to the exe, wherever that is
      for (const f of g.filesToAdd || []) {
        const p = path.join(path.dirname(exe), f);
        if (!fs.existsSync(p)) await fsp.writeFile(p, '');
      }

      const prev = this.state.installed[gameId];
      this.state.installed[gameId] = {
        tag, dir: target, exe, installedAt: Date.now(), asset: asset.name,
        launchedOnce: prev ? prev.launchedOnce : false, playTime: prev ? prev.playTime || 0 : 0, lastPlayed: prev ? prev.lastPlayed : null,
      };
      await this.save();
      this.setJob(gameId, null);
      this.emitChange();
      fsp.rm(archive, { force: true }).catch(() => {});
      return { ok: true };
    } catch (e) {
      this.setJob(gameId, null);
      if (archive) fsp.rm(archive, { force: true }).catch(() => {});
      this.emitChange();
      if (e.name === 'AbortError') return { ok: false, cancelled: true };
      return { ok: false, error: e.message };
    }
  }

  cancel(gameId) {
    const j = this.jobs.get(gameId);
    if (j && j.abort) j.abort.abort();
  }

  async uninstall(gameId) {
    const i = this.state.installed[gameId];
    if (!i) return;
    if (this.running.has(gameId)) throw new Error('Close the game first.');
    await this.backupGame(gameId, 'before uninstall').catch(() => null);
    await fsp.rm(i.dir, { recursive: true, force: true });
    delete this.state.installed[gameId];
    await this.save();
    this.emitChange();
  }

  // ---------- launching ----------
  async prepareRom(g, i) {
    const spec = (g.rom && g.rom.setup) || { type: 'in-app' };
    const match = romdb.bestRomForGame(g, this.state.roms, this.state.romOverride[g.id]);
    if (!match) return { needsRom: true };
    const src = match.rom.file;
    if (!fs.existsSync(src)) return { needsRom: true, missing: src };
    const exeDir = path.dirname(i.exe);
    if (spec.type === 'beside-exe') {
      const dest = path.join(exeDir, spec.fileName || path.basename(src));
      if (!fs.existsSync(dest)) await fsp.copyFile(src, dest);
    } else if (spec.type === 'file') {
      const dest = path.join(exeDir, spec.path);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      if (!fs.existsSync(dest)) await fsp.copyFile(src, dest);
    }
    if (this.hooks.copyToClipboard) this.hooks.copyToClipboard(src);
    if (spec.reveal && !i.launchedOnce && this.hooks.revealFile) this.hooks.revealFile(src);
    return { rom: match.rom, level: match.level };
  }

  async launch(gameId, { force = false } = {}) {
    const g = this.game(gameId);
    const i = this.state.installed[gameId];
    if (!i) throw new Error('Install the game first.');
    if (this.running.has(gameId)) return { ok: true, alreadyRunning: true };
    if (!fs.existsSync(i.exe)) throw new Error("The game's files are missing. Reinstall it.");
    const prep = await this.prepareRom(g, i);
    // Most games ask for the ROM themselves, so a missing ROM never blocks Play.
    // Only games that read the ROM from a fixed file path (Perfect Dark) can't start without it.
    const setupType = ((g.rom && g.rom.setup) || {}).type;
    if (prep.needsRom && setupType === 'file' && !force) return { ok: false, needsRom: true };

    const firstRun = !i.launchedOnce;
    // Mac app bundles start through "open"; -W waits until the game quits, so play time and backups still work
    const isApp = this.platform === 'darwin' && /\.app$/i.test(i.exe);
    const child = isApp
      ? spawn('open', ['-W', '-n', i.exe], { detached: true, stdio: 'ignore' })
      : spawn(i.exe, [], { cwd: path.dirname(i.exe), detached: true, stdio: 'ignore', windowsHide: false });
    const started = Date.now();
    this.running.set(gameId, child);
    child.on('error', () => { this.running.delete(gameId); this.emitChange(); });
    child.on('exit', async () => {
      this.running.delete(gameId);
      const cur = this.state.installed[gameId];
      if (cur) { cur.playTime = (cur.playTime || 0) + (Date.now() - started); cur.lastPlayed = Date.now(); await this.save(); }
      if (this.state.settings.autoBackup !== false) await this.backupGame(gameId, 'after playing').catch(() => null);
      this.emitChange();
      this.emit('exited', gameId);
    });
    child.unref();
    i.launchedOnce = true;
    await this.save();
    this.emitChange();
    const noRomTip = 'If the game asks for your ROM, pick it there. It remembers it after that, so you only do this once.';
    return {
      ok: true, firstRun, noRom: !!prep.needsRom,
      tip: firstRun ? (prep.needsRom ? noRomTip : (g.rom && g.rom.firstRun) || null) : null,
      romFile: prep.rom ? prep.rom.file : null,
    };
  }

  // ---------- custom games ----------
  async addUserGame(entry) {
    const id = entry.id || entry.repo.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const game = {
      id, title: entry.title || entry.repo.split('/')[1], port: entry.port || entry.repo.split('/')[1],
      system: entry.system || 'n64', year: entry.year ? Number(entry.year) : null,
      developer: entry.developer || '', publisher: entry.publisher || '', kind: entry.kind || 'Community port',
      credits: [{ role: 'Made by', name: entry.repo.split('/')[0] }], repo: entry.repo,
      description: entry.description || '', filesToAdd: entry.portable ? ['portable.txt'] : [],
      rom: { titles: entry.romTitle ? [entry.romTitle] : [], headerNames: entry.romTitle ? [entry.romTitle] : [], setup: { type: entry.romSetup || 'in-app' } },
      art: { boxart: entry.boxart ? [entry.boxart] : [], icon: entry.icon || null }, custom: true,
    };
    this.state.userGames = this.state.userGames.filter((x) => x.id !== id).concat(game);
    (this.state.firstSeen || (this.state.firstSeen = {}))[id] = Date.now();
    await this.save();
    this.emitChange();
    this.refreshReleases({ ids: [id] }).catch(() => {});
    return game;
  }

  // ---------- community catalog ----------
  /** All community-listed ports (cached for a day so browsing works offline). */
  async communityList({ force = false } = {}) {
    const cache = path.join(this.dataDir, 'community.json');
    let cached = null;
    try { cached = JSON.parse(await fsp.readFile(cache, 'utf8')); } catch { /* none yet */ }
    if (!force && cached && Date.now() - cached.fetchedAt < 24 * 3600 * 1000) return this.markCommunity(cached.items);
    try {
      const items = await community.fetchCommunity();
      await fsp.writeFile(cache, JSON.stringify({ fetchedAt: Date.now(), items }));
      return this.markCommunity(items);
    } catch (e) {
      if (cached) return this.markCommunity(cached.items);
      throw e;
    }
  }

  markCommunity(items) {
    const repos = new Map(this.games.map((g) => [`${(g.repo || '').toLowerCase()}#${(g.assetMatch || '').replace(/\\/g, '').toLowerCase()}`, g.id]));
    const plainRepos = new Map(this.games.map((g) => [(g.repo || '').toLowerCase(), g.id]));
    return {
      source: community.SOURCE_PAGE,
      items: items.map((c) => ({ ...c, onShelf: repos.get(c.key) || (!c.assetFilter && plainRepos.get(c.repo.toLowerCase())) || null })),
    };
  }

  async addCommunityGame(key) {
    const { items } = await this.communityList();
    const c = items.find((x) => x.key === key);
    if (!c) throw new Error('That game is no longer in the community catalog.');
    if (c.onShelf) return this.game(c.onShelf);
    const game = community.gameFromCandidate(c);
    this.state.userGames = this.state.userGames.filter((x) => x.id !== game.id).concat(game);
    (this.state.firstSeen || (this.state.firstSeen = {}))[game.id] = Date.now();
    await this.save();
    this.emitChange();
    this.refreshReleases({ ids: [game.id] }).catch(() => {});
    return game;
  }

  // ---------- save backups ----------
  manifestPath(gameId) { return path.join(this.dataDir, 'manifests', `${gameId}.json`); }

  async saveManifest(gameId, files) {
    let old = [];
    try { old = JSON.parse(await fsp.readFile(this.manifestPath(gameId), 'utf8')); } catch { /* first install */ }
    const all = [...new Set([...old, ...files])];
    await fsp.mkdir(path.dirname(this.manifestPath(gameId)), { recursive: true });
    await fsp.writeFile(this.manifestPath(gameId), JSON.stringify(all));
  }

  expandPath(p) {
    const env = { APPDATA: process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), LOCALAPPDATA: process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), HOME: os.homedir(), USERPROFILE: os.homedir() };
    return path.normalize(String(p).replace(/%([A-Z]+)%|\$\{?([A-Z]+)\}?/g, (m, a, b) => env[a || b] || m));
  }

  /** Back up a game's saves. reason: 'manual' | 'after playing' | 'before update' | 'before uninstall' | 'before restore'. */
  async backupGame(gameId, reason = 'manual') {
    const g = this.game(gameId);
    const i = this.state.installed[gameId];
    if (!i || !fs.existsSync(i.dir)) return null;
    let manifest = null;
    try { manifest = JSON.parse(await fsp.readFile(this.manifestPath(gameId), 'utf8')); } catch { /* installed before backups existed */ }
    const files = await backup.userFiles(i.dir, { manifest, installedAt: i.installedAt });
    const extra = (g.saves || []).map((s) => ({ key: s.key, path: this.expandPath(s.path) }));
    if (reason !== 'manual') {
      const latest = (await backup.listBackups(this.dirs.backups, gameId))[0];
      if (latest && latest.fingerprint === backup.fingerprint(files) && !extra.length) return null; // nothing changed
    }
    const made = await backup.createBackup({ gameDir: i.dir, backupRoot: this.dirs.backups, gameId, files, reason, extra });
    if (made) await backup.prune(this.dirs.backups, gameId, 10);
    if (made) this.emit('backup', gameId, made);
    return made;
  }

  async listBackups(gameId) {
    return backup.listBackups(this.dirs.backups, gameId);
  }

  async restoreBackup(gameId, backupId) {
    const i = this.state.installed[gameId];
    if (!i) throw new Error('Install the game first, then restore its saves.');
    if (this.running.has(gameId)) throw new Error('Close the game first.');
    const b = (await this.listBackups(gameId)).find((x) => x.id === backupId);
    if (!b) throw new Error('That backup no longer exists.');
    await this.backupGame(gameId, 'before restore'); // so a restore can always be undone
    await backup.restoreBackup(b, i.dir);
    return b;
  }

  async backupAll() {
    const out = [];
    for (const id of Object.keys(this.state.installed)) {
      const b = await this.backupGame(id, 'manual').catch(() => null);
      if (b) out.push(id);
    }
    return out;
  }


  // ---------- cover art ----------
  get coverDir() { return path.join(this.dataDir, 'covers'); }

  /** Run fn with at most 4 downloads at once. */
  async limited(fn) {
    if (this.slots >= 4) await new Promise((r) => this.queue.push(r));
    this.slots++;
    try { return await fn(); } finally { this.slots--; const next = this.queue.shift(); if (next) next(); }
  }

  /** The cover list for one libretro-thumbnails console, cached on disk for 30 days. */
  thumbIndex(repo) {
    if (this.thumbIdx[repo]) return this.thumbIdx[repo];
    const file = path.join(this.coverDir, 'index', `${repo}.json`);
    const p = (async () => {
      let cached = null;
      try { cached = JSON.parse(await fsp.readFile(file, 'utf8')); } catch { /* none yet */ }
      if (cached && Date.now() - cached.at < 30 * 24 * 3600 * 1000) return covers.makeIndex(cached.names);
      try {
        const names = await covers.fetchIndexNames(repo, this.hooks.fetch || fetch, this.state.settings.githubToken);
        await fsp.mkdir(path.dirname(file), { recursive: true });
        await fsp.writeFile(file, JSON.stringify({ at: Date.now(), names }));
        return covers.makeIndex(names);
      } catch (e) {
        if (cached) return covers.makeIndex(cached.names); // offline: an old list is fine
        this.thumbIdx[repo] = null; // try again next time
        throw e;
      }
    })();
    this.thumbIdx[repo] = p;
    return p;
  }

  /** What to look for: the console plus exact No-Intro names and plain titles. */
  coverWant(kind, ref) {
    if (kind === 'game') {
      const g = this.game(ref);
      const exact = (g.art && g.art.boxart) || [];
      return { system: g.system, exact, titles: [g.title, g.port].filter(Boolean), region: exact[0] ? covers.regionOf(exact[0]) : null };
    }
    if (kind === 'rom') {
      const r = this.state.roms.find((x) => x.id === ref);
      if (!r) throw new Error('That ROM is no longer in your library');
      if (r.arcade) {
        // arcade box art is named after the full set description; clones fall back to their parent's box
        return { system: r.system, thumbs: r.arcade.src === 'm' ? 'MAME' : 'FBNeo_-_Arcade_Games', exact: [r.arcade.desc, r.arcade.parentDesc].filter(Boolean), titles: [r.internalName], region: null };
      }
      const exact = r.datName ? [r.datName] : [];
      const titles = [r.internalName, rom.nameFromFile(r.originalName || r.file)].filter(Boolean);
      return { system: r.system, exact, titles, region: covers.regionOf(r.datName || r.originalName || '') };
    }
    return { system: ref.system, exact: [], titles: [ref.title].filter(Boolean), region: null };
  }

  coverKey(kind, ref) {
    return kind === 'title' ? `title:${ref.system}:${covers.normTitle(ref.title)}` : `${kind}:${ref}`;
  }

  saveSoon() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save().catch(() => {}), 800);
  }

  /** Find (or return the saved) cover for a game, a ROM or a title. Resolves to a local image path or null. */
  async cover(kind, ref, { force = false } = {}) {
    const key = this.coverKey(kind, ref);
    const all = this.state.covers || (this.state.covers = {});
    const entry = all[key];
    if (entry && entry.file && !force) {
      if (fs.existsSync(entry.file)) return entry.file;
      delete all[key];
    } else if (entry && entry.none && !force && Date.now() - entry.at < 7 * 24 * 3600 * 1000) {
      return null; // looked recently and found nothing
    }
    if (this.coverJobs.has(key)) return this.coverJobs.get(key);
    const job = this.findCover(kind, ref, key).finally(() => this.coverJobs.delete(key));
    this.coverJobs.set(key, job);
    return job;
  }

  async findCover(kind, ref, key) {
    const want = this.coverWant(kind, ref);
    const sys = { ...(this.systems[want.system] || {}), ...(want.thumbs ? { thumbs: want.thumbs } : {}) };
    const fetchImpl = this.hooks.fetch || fetch;
    const tryUrls = [];
    if (sys.thumbs) {
      let index = null;
      try { index = await this.thumbIndex(sys.thumbs); } catch { /* list unavailable: try the exact names directly */ }
      if (index) {
        const name = covers.bestMatch(index, want);
        if (name) tryUrls.push({ url: covers.boxartUrl(sys.thumbs, name), source: 'libretro', name });
      } else {
        for (const n of want.exact) tryUrls.push({ url: covers.boxartUrl(sys.thumbs, n), source: 'libretro', name: n });
      }
    }
    for (const t of tryUrls) {
      const file = await this.downloadCover(t.url, key).catch(() => null);
      if (file) return this.rememberCover(key, { file, url: t.url, source: t.source, name: t.name });
    }
    const sgKey = this.state.settings.steamGridKey;
    const title = want.titles[0] || (want.exact[0] ? covers.splitTags(want.exact[0]).base : '');
    if (sgKey && title) {
      const hit = await covers.steamGridCover(title, sgKey, fetchImpl).catch(() => null);
      if (hit) {
        const file = await this.downloadCover(hit.url, key).catch(() => null);
        if (file) return this.rememberCover(key, { file, url: hit.url, source: 'steamgriddb', name: hit.name });
      }
    }
    this.state.covers[key] = { none: true, at: Date.now() };
    this.saveSoon();
    return null;
  }

  rememberCover(key, entry) {
    this.state.covers[key] = { ...entry, at: Date.now() };
    this.saveSoon();
    return entry.file;
  }

  async downloadCover(url, key) {
    return this.limited(async () => {
      const res = await (this.hooks.fetch || fetch)(url, { headers: { 'User-Agent': 'Cartridge-Launcher' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const type = covers.imageType(buf);
      if (!type) throw new Error('Not an image');
      await fsp.mkdir(this.coverDir, { recursive: true });
      const file = path.join(this.coverDir, `${crypto.createHash('sha1').update(key).digest('hex').slice(0, 16)}.${type}`);
      await fsp.writeFile(file, buf);
      return file;
    });
  }

  /** Use your own picture as a game's or ROM's cover. */
  async setCustomCover(kind, id, imageFile) {
    const buf = await fsp.readFile(imageFile);
    const type = covers.imageType(buf);
    if (!type) throw new Error('That file is not a PNG, JPG, WebP or GIF image');
    const key = this.coverKey(kind, id);
    const dir = path.join(this.coverDir, 'custom');
    await fsp.mkdir(dir, { recursive: true });
    const old = (this.state.covers || {})[key];
    const file = path.join(dir, `${crypto.createHash('sha1').update(key).digest('hex').slice(0, 16)}-${Date.now()}.${type}`);
    await fsp.writeFile(file, buf);
    if (old && old.source === 'custom' && old.file) fsp.rm(old.file, { force: true }).catch(() => {});
    this.state.covers[key] = { file, source: 'custom', at: Date.now() };
    await this.save();
    this.emitChange();
    return file;
  }

  /** Go back to the automatic cover. */
  async resetCover(kind, id) {
    const key = this.coverKey(kind, id);
    const old = (this.state.covers || {})[key];
    if (old && old.source === 'custom' && old.file) await fsp.rm(old.file, { force: true }).catch(() => {});
    delete this.state.covers[key];
    const file = await this.cover(kind, id);
    await this.save();
    this.emitChange();
    return file;
  }

  /** Look for every missing cover now (also retries ones not found before). */
  async findAllCovers({ onProgress } = {}) {
    const items = [...this.games.map((g) => ['game', g.id]), ...this.state.roms.map((r) => ['rom', r.id])];
    let found = 0, missing = 0, done = 0;
    await Promise.all(items.map(async ([kind, id]) => {
      const key = this.coverKey(kind, id);
      const e = this.state.covers[key];
      if (e && e.none) delete this.state.covers[key];
      const file = await this.cover(kind, id).catch(() => null);
      if (file) found++; else missing++;
      done++;
      if (onProgress) onProgress(done, items.length);
    }));
    await this.save();
    this.emitChange();
    return { found, missing, total: items.length };
  }

  // ---------- Metacritic ----------
  /** Fetch (and remember) the Metascore for a game that doesn't have one stored in the catalog. */
  async metascore(gameId, { force = false } = {}) {
    const g = this.game(gameId);
    if (g.metacritic && !force) return g.metacritic;
    const cache = this.state.metaCache || (this.state.metaCache = {});
    const hit = cache[gameId];
    const fresh = hit && hit.v === metacritic.VERSION && Date.now() - hit.fetchedAt < (hit.data ? 30 : 1) * 24 * 3600 * 1000;
    if (hit && fresh && !force) return hit.data || null;
    try {
      const data = await metacritic.lookup(g.title, this.hooks.fetch || fetch);
      cache[gameId] = { fetchedAt: Date.now(), data, v: metacritic.VERSION };
    } catch (e) {
      cache[gameId] = { fetchedAt: Date.now(), data: null, error: e.message, v: metacritic.VERSION };
    }
    await this.save();
    this.emitChange();
    return cache[gameId].data || null;
  }

  // ---------- Cartridge updates ----------
  /** Is there a newer Cartridge on GitHub? Checked at most every 12 hours unless forced. */
  async checkAppUpdate({ force = false } = {}) {
    if (!force && this.state.settings.checkUpdates === false) return null;
    const hit = this.state.appUpdate;
    if (!force && hit && Date.now() - hit.checkedAt < 12 * 3600 * 1000) return hit.data;
    const data = await update.checkForUpdate({ repo: this.links.repo, current: this.version, fetchImpl: this.hooks.fetch || fetch, token: this.state.settings.githubToken, platform: this.platform });
    this.state.appUpdate = { checkedAt: Date.now(), data: data.available ? data : null, latest: data.latest || null, skipped: data.skipped || null };
    await this.save();
    this.emitChange();
    return { ...data };
  }

  /** Thanks list for the About page: everyone credited in the catalog, with the ports they worked on. */
  credits() {
    const people = new Map();
    for (const g of this.games || []) {
      for (const c of g.credits || []) {
        if (!c || !c.name) continue;
        const key = c.name.toLowerCase();
        if (!people.has(key)) people.set(key, { name: c.name, url: c.url || null, roles: new Set(), games: new Set() });
        const p = people.get(key);
        if (c.role) p.roles.add(c.role.replace(/\s+by$/i, ''));
        p.games.add(g.port || g.title);
        if (!p.url && c.url) p.url = c.url;
        // the port's GitHub owner is usually the team itself
        if (!p.url && g.repo && /port/i.test(c.role || '')) p.url = `https://github.com/${g.repo.split('/')[0]}`;
      }
    }
    return [...people.values()]
      .map((p) => ({ name: p.name, url: p.url, roles: [...p.roles], games: [...p.games].sort() }))
      .sort((a, b) => b.games.length - a.games.length || a.name.localeCompare(b.name));
  }

  // ---------- getting the ROM the right way ----------
  /** How to dump this console's games yourself (catalog/dumping.json). */
  dumpGuide(system) {
    if (!this.dumping) {
      try { this.dumping = JSON.parse(fs.readFileSync(path.join(path.dirname(this.catalogFile), 'dumping.json'), 'utf8')); } catch { this.dumping = { guides: [], fallback: null }; }
    }
    return this.dumping.guides.find((x) => x.systems.includes(system)) || this.dumping.fallback;
  }

  /**
   * Everything the "How do I get this ROM?" panel shows: the dumping guide, the exact dumps the port accepts
   * (from the No-Intro list, so names and SHA-1s are real), and a link to buy the original.
   */
  async romHelp(gameId) {
    const g = this.game(gameId);
    const spec = g.rom || {};
    const sys = this.systems[g.system] || {};
    const out = { guide: this.dumpGuide(g.system), targets: [], more: 0, discIds: spec.discIds || null, checked: false };
    const base = (g.title || '').replace(/^The /, '');
    out.buyUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${base} ${sys.name || ''}`.trim())}`;
    if (!spec.discIds && (spec.titles || spec.sha1)) {
      const dat = await this.loadDat(g.system).catch(() => null);
      if (dat) {
        out.checked = true;
        const seen = new Set();
        const hits = [];
        for (const e of dat.bySha1.values()) {
          if (seen.has(e.name)) continue;
          const m = romdb.matchRomToGame({ system: g.system, sha1: e.sha1, datName: e.name }, g);
          if (m.level !== 'ok') continue;
          seen.add(e.name);
          hits.push({ name: e.name, sha1: e.sha1 });
        }
        // plain retail releases first: preferred region, then the fewest extra tags
        const extra = (n) => romdb.splitName(n).tags.length;
        hits.sort((a, b) => covers.rank(a.name) - covers.rank(b.name) || extra(a.name) - extra(b.name) || a.name.localeCompare(b.name));
        out.targets = hits.slice(0, 5);
        out.more = Math.max(0, hits.length - 5);
      }
    }
    return out;
  }

  async removeUserGame(id) {
    this.state.userGames = this.state.userGames.filter((x) => x.id !== id);
    await this.save();
    this.emitChange();
  }
}

module.exports = { Library };
