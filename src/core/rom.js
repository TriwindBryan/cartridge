// ROM reading, format normalisation, hashing and console identification for every system Cartridge knows.
// Pure Node — no Electron imports, so it can be unit tested.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---- Extension tables ---------------------------------------------------------
// Cartridge systems: small files, hashed and checked against No-Intro, and copied into the ROM library.
const CART_EXT = {
  '.z64': 'n64', '.n64': 'n64', '.v64': 'n64', '.ndd': 'n64dd',
  '.sfc': 'snes', '.smc': 'snes', '.swc': 'snes', '.fig': 'snes',
  '.nes': 'nes', '.fds': 'fds', '.vb': 'vb', '.vboy': 'vb',
  '.gb': 'gb', '.gbc': 'gbc', '.cgb': 'gbc', '.gba': 'gba', '.agb': 'gba', '.min': 'pokemini', '.nds': 'nds', '.dsi': 'nds',
  '.sg': 'sg1000', '.sms': 'sms', '.gg': 'gg', '.md': 'genesis', '.gen': 'genesis', '.smd': 'genesis', '.32x': '32x',
  '.pce': 'pce', '.sgx': 'sgx', '.ngp': 'ngp', '.ngc': 'ngpc', '.ws': 'ws', '.wsc': 'wsc',
  '.a26': 'a2600', '.a52': 'a5200', '.a78': 'a7800', '.lnx': 'lynx', '.lyx': 'lynx', '.j64': 'jaguar', '.jag': 'jaguar',
  '.col': 'coleco', '.int': 'intv', '.vec': 'vectrex', '.mx1': 'msx', '.mx2': 'msx',
};
// Disc and modern formats with only one possible console: identified by name/header, never copied.
const DISC_EXT = {
  '.gcm': 'gc', '.rvz': 'gc', '.ciso': 'gc', '.gcz': 'gc', '.wia': 'gc', '.wbfs': 'wii', // gc/wii decided by the disc header
  '.wud': 'wiiu', '.wux': 'wiiu', '.wua': 'wiiu', '.rpx': 'wiiu', '.wuhb': 'wiiu', '.tmd': 'wiiu',
  '.nsp': 'switch', '.nsz': 'switch', '.xci': 'switch', '.xcz': 'switch',
  '.3ds': '3ds', '.cci': '3ds', '.cia': '3ds', '.cxi': '3ds', '.3dsx': '3ds',
  '.zcci': '3ds', '.zcxi': '3ds', '.z3dsx': '3ds', '.zcia': '3ds', // Azahar's compressed (Z3DS) formats
  '.gdi': 'dreamcast', '.cdi': 'dreamcast',
  '.pbp': 'ps1', '.cso': 'psp', '.vpk': 'vita', '.pkg': 'ps3',
  '.xbe': 'xbox', '.xex': 'x360',
};
// Shared by several consoles: the file's contents (and then its folder name) decide.
const SHARED_EXT = ['.iso', '.bin', '.cue', '.chd', '.img', '.m3u', '.ccd'];
const ROM_EXTENSIONS = [...Object.keys(CART_EXT), ...Object.keys(DISC_EXT), ...SHARED_EXT];

// Systems whose files are big: identified by name (plus serial where the header has one) and left where they are.
const NAME_ONLY = new Set(['ps1', 'ps2', 'ps3', 'psp', 'vita', 'segacd', 'saturn', 'dreamcast', '3do', 'pcecd', 'neocd',
  'xbox', 'x360', 'wiiu', 'switch', '3ds', 'ps4', 'ps5', 'xone', 'xsx', 'switch2']);
// File type the tidy copy in the ROM library gets.
const STORE_EXT = { n64: '.z64', snes: '.sfc', nes: '.nes', genesis: '.md', a2600: '.a26' };

/** The likeliest system for a file, from its extension alone (shared types give their most common console). */
function systemForExtension(file) {
  const ext = path.extname(file).toLowerCase();
  if (CART_EXT[ext]) return CART_EXT[ext];
  if (DISC_EXT[ext]) return DISC_EXT[ext];
  if (ext === '.bin') return 'genesis';
  if (SHARED_EXT.includes(ext)) return 'ps1';
  const base = path.basename(file).toLowerCase();
  if (base === 'param.sfo') return 'ps3';
  if (base === 'param.json') return 'ps5';
  if (base === 'microsoftgame.config' || base === 'appxmanifest.xml') return 'xone';
  if (base === 'meta.xml') return 'wiiu';
  // Xbox 360 Games on Demand / Xbox Live Arcade: a file with no extension inside a content-type folder (00007000, 000D0000…)
  if (!ext && /^[0-9a-f]{8}$/i.test(path.basename(path.dirname(file)))) return 'x360';
  return null;
}

/** Xbox 360 STFS package (Games on Demand, XBLA, DLC): { title, titleId, type } or null. */
function stfsInfo(file) {
  return withFile(file, (fd) => {
    const h = readAt(fd, 0, 0x1700);
    const magic = h.toString('latin1', 0, 4);
    if (!['CON ', 'LIVE', 'PIRS'].includes(magic) || h.length < 0x491) return null;
    // the display name is UTF-16 big-endian at 0x411 (English first)
    const raw = Buffer.from(h.subarray(0x411, 0x411 + 0x80));
    raw.swap16();
    const title = raw.toString('utf16le').replace(/\0[\s\S]*$/, '').trim();
    return { title, titleId: h.readUInt32BE(0x360).toString(16).toUpperCase().padStart(8, '0'), type: h.readUInt32BE(0x344) };
  });
}

// ---- Folder name hints ------------------------------------------------------------
// When a disc can't be told apart by its contents (.chd is compressed), the folder it sits in usually says
// ("D:\ROMs\Sega Saturn\…", "Sony - PlayStation 2", "PS1"). Specific names come before general ones.
const HINTS = [
  [/switch ?2\b|\bnsw2\b|\bns2\b/, 'switch2'], [/\bps5\b|playstation ?5/, 'ps5'], [/\bps4\b|playstation ?4/, 'ps4'],
  [/xbox ?series|series ?x|\bxsx\b|\bxss\b/, 'xsx'], [/xbox ?one|\bxb1\b|\bxbone\b/, 'xone'],
  [/\bswitch\b|\bnsw\b/, 'switch'], [/\bwii ?u\b/, 'wiiu'], [/\b3ds\b/, '3ds'], [/\bnds\b|\bnintendo ds\b|^ds$/, 'nds'],
  [/game ?cube|\bgcn?\b|\bngc\b/, 'gc'], [/\bwii\b/, 'wii'], [/64 ?dd/, 'n64dd'], [/\bn64\b|nintendo 64/, 'n64'],
  [/\bsnes\b|super nintendo|super famicom|\bsfc\b/, 'snes'], [/disk system|\bfds\b/, 'fds'], [/\bnes\b|famicom|nintendo entertainment/, 'nes'],
  [/virtual ?boy/, 'vb'], [/\bgba\b|game ?boy advance/, 'gba'], [/\bgbc\b|game ?boy colou?r/, 'gbc'], [/\bgb\b|game ?boy/, 'gb'],
  [/saturn/, 'saturn'], [/dreamcast|\bdc\b/, 'dreamcast'], [/sega ?cd|mega ?cd/, 'segacd'], [/\b32x\b/, '32x'],
  [/genesis|mega ?drive|\bmd\b/, 'genesis'], [/master ?system|\bsms\b|mark iii/, 'sms'], [/game ?gear|\bgg\b/, 'gg'], [/sg-?1000/, 'sg1000'],
  [/\bps3\b|playstation ?3/, 'ps3'], [/\bvita\b|\bpsv\b/, 'vita'], [/\bpsp\b|playstation portable/, 'psp'],
  [/\bps2\b|playstation ?2/, 'ps2'], [/\bps1\b|\bpsx\b|playstation/, 'ps1'],
  [/xbox ?360|\bx360\b/, 'x360'], [/xbox/, 'xbox'],
  [/(pc ?engine|turbo ?grafx|\btg\b|\bpce\b)[ -]?(cd|16 ?cd)|turbografx-cd/, 'pcecd'], [/supergrafx/, 'sgx'], [/pc ?engine|turbo ?grafx|\btg ?16\b|\bpce\b/, 'pce'],
  [/neo ?geo ?cd/, 'neocd'], [/neo ?geo pocket colou?r|\bngpc\b/, 'ngpc'], [/neo ?geo pocket|\bngp\b/, 'ngp'],
  [/wonder ?swan colou?r|\bwsc\b/, 'wsc'], [/wonder ?swan/, 'ws'], [/\b3do\b/, '3do'], [/jaguar/, 'jaguar'], [/lynx/, 'lynx'],
  [/\b2600\b/, 'a2600'], [/\b5200\b/, 'a5200'], [/\b7800\b/, 'a7800'], [/coleco/, 'coleco'], [/intellivision/, 'intv'], [/vectrex/, 'vectrex'], [/\bmsx/, 'msx'],
];
function hintFromPath(file) {
  const parts = path.resolve(file).split(/[\\/]+/).slice(0, -1).reverse().slice(0, 4);
  for (const part of parts) {
    const p = part.toLowerCase().replace(/[_.]+/g, ' ');
    for (const [re, sys] of HINTS) if (re.test(p)) return sys;
  }
  return null;
}

// ---- Low-level reads ----------------------------------------------------------------
function readAt(fd, pos, len) {
  const b = Buffer.alloc(len);
  const n = fs.readSync(fd, b, 0, len, pos);
  return b.subarray(0, n);
}
function withFile(file, fn) {
  const fd = fs.openSync(file, 'r');
  try { return fn(fd); } finally { fs.closeSync(fd); }
}
const txt = (b, a, z) => (b.length >= z ? b.toString('latin1', a, z) : '');
const SYNC = Buffer.from([0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00]);
const XBOX_MAGIC = 'MICROSOFT*XBOX*MEDIA';

/** Look inside a CD/DVD image (.iso, .bin, .img) for the console's own signature. */
function sniffDiscImage(file, size) {
  return withFile(file, (fd) => {
    const head = readAt(fd, 0, 0x40);
    if (head.length >= 0x20 && head.readUInt32BE(0x1c) === 0xc2339f3d) return 'gc';
    if (head.length >= 0x20 && head.readUInt32BE(0x18) === 0x5d1c9ea3) return 'wii';
    // Raw CD images use 2352-byte sectors that start with a sync pattern; the data sits after a 16 or 24 byte header
    const raw = head.length >= 16 && head.subarray(0, 12).equals(SYNC);
    const dataOff = raw ? (head[15] === 2 ? 24 : 16) : 0;
    const sector = raw ? 2352 : 2048;
    const s0 = readAt(fd, dataOff, 0x100);
    if (txt(s0, 0, 14) === 'SEGADISCSYSTEM' || txt(s0, 0, 11) === 'SEGA_CD_ROM') return 'segacd';
    if (txt(s0, 0, 15) === 'SEGA SEGASATURN') return 'saturn';
    if (txt(s0, 0, 15) === 'SEGA SEGAKATANA') return 'dreamcast';
    if (s0.length > 7 && s0[0] === 1 && s0.subarray(1, 6).every((x) => x === 0x5a) && s0[6] === 1) return '3do';
    const s1 = readAt(fd, sector + dataOff, 0x60);
    if (/PC Engine CD-ROM SYSTEM/.test(s1.toString('latin1'))) return 'pcecd';
    const pvd = readAt(fd, 16 * sector + dataOff, 0x80); // ISO 9660 primary volume descriptor
    if (txt(pvd, 1, 6) === 'CD001') {
      const sys = txt(pvd, 8, 40);
      const vol = txt(pvd, 40, 72);
      if (/PSP GAME/i.test(sys) || /PSP GAME/i.test(vol)) return 'psp';
      if (/PS3VOLUME/i.test(vol)) return 'ps3';
      if (/PLAYSTATION/i.test(sys)) return size > 900 * 1024 * 1024 ? 'ps2' : 'ps1';
      if (/NEOGEO/i.test(vol) || /NEO-GEO/i.test(sys)) return 'neocd';
    }
    // Xbox discs (XDVDFS): the volume descriptor sits 0x10000 into the game partition. Full dumps put the partition
    // after a video partition (XGD1 0x18300000 original Xbox; XGD2 0xFD90000 and XGD3 0x2080000 Xbox 360);
    // trimmed "xiso" files start with it. The game file in the root folder settles 360 vs original Xbox.
    for (const [part, sys] of [[0x18300000, 'xbox'], [0xfd90000, 'x360'], [0x2080000, 'x360'], [0, null]]) {
      const off = part + 0x10000;
      if (off + 32 > size || txt(readAt(fd, off, 20), 0, 20) !== XBOX_MAGIC) continue;
      const vd = readAt(fd, off, 32);
      const rootAt = part + vd.readUInt32LE(20) * 2048;
      const rootLen = Math.min(vd.readUInt32LE(24), 256 * 1024);
      const root = rootLen && rootAt + rootLen <= size ? readAt(fd, rootAt, rootLen).toString('latin1').toLowerCase() : '';
      if (root.includes('default.xex')) return 'x360';
      if (root.includes('default.xbe')) return 'xbox';
      return sys || 'xbox';
    }
    return null;
  });
}

/** Files a .cue sheet points to (its .bin tracks). */
function cueTracks(cueFile) {
  try {
    const dir = path.dirname(cueFile);
    return [...fs.readFileSync(cueFile, 'latin1').matchAll(/^\s*FILE\s+"?([^"\r\n]+?)"?\s+\w+\s*$/gim)].map((m) => path.join(dir, m[1]));
  } catch { return []; }
}
/** The first disc listed in a .m3u playlist. */
function m3uFirst(file) {
  try {
    const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#'));
    return line ? path.resolve(path.dirname(file), line) : null;
  } catch { return null; }
}

/** What a CHD holds, from its metadata: 'gd' (Dreamcast/NAOMI GD-ROM), 'dvd', 'cd' or null. */
function chdKind(file) {
  return withFile(file, (fd) => {
    const h = readAt(fd, 0, 124);
    if (h.length < 64 || txt(h, 0, 8) !== 'MComprHD') return null;
    const version = h.readUInt32BE(12);
    const metaAt = version >= 5 ? Number(h.readBigUInt64BE(48)) : version >= 3 ? Number(h.readBigUInt64BE(36)) : 0;
    let at = metaAt;
    for (let i = 0; at && i < 64; i++) {
      const m = readAt(fd, at, 16);
      if (m.length < 16) break;
      const tag = txt(m, 0, 4);
      if (tag === 'CHGD') return 'gd';
      if (tag === 'DVD ') return 'dvd';
      if (tag === 'CHT2' || tag === 'CHTR' || tag === 'CHCD') return 'cd';
      at = Number(m.readBigUInt64BE(8));
    }
    return null;
  });
}

/** Work out which console a file is for. Returns a system id or null. */
function sniffSystem(file, size, depth = 0) {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file).toLowerCase();
  if (base === 'param.sfo') {
    if (!/^sce_sys$/i.test(path.basename(path.dirname(file)))) return 'ps3';
    // PS4 and Vita both use sce_sys/param.sfo: the title ID tells them apart (CUSA… is PS4, PCSx… is Vita)
    let id = '';
    try { id = parseSfo(fs.readFileSync(file)).TITLE_ID || ''; } catch { /* unreadable */ }
    return /^(CUSA|PLAS|PCAS|PCJS|PLJS|PLJM|PCKS)/i.test(id) ? 'ps4' : 'vita';
  }
  if (base === 'param.json') return 'ps5';
  if (base === 'microsoftgame.config' || base === 'appxmanifest.xml') return hintFromPath(file) === 'xsx' ? 'xsx' : 'xone';
  if (base === 'meta.xml') return 'wiiu';
  if (CART_EXT[ext]) return CART_EXT[ext];
  if (ext === '.pkg') return withFile(file, (fd) => { const m = readAt(fd, 0, 4).toString('latin1'); return m === '\x7fPKG' ? 'ps3' : m === '\x7fCNT' ? 'ps4' : null; });
  // Switch 2 dumps use the same file types as the Switch: only their folder tells them apart
  if (['.nsp', '.nsz', '.xci', '.xcz'].includes(ext) && hintFromPath(file) === 'switch2') return 'switch2';
  if (DISC_EXT[ext]) return DISC_EXT[ext];
  if (!ext) return stfsInfo(file) ? 'x360' : null;
  if (!SHARED_EXT.includes(ext)) return null;
  const hint = hintFromPath(file);
  const refine = (found) => {
    // the folder name settles the cases the contents can't: PS1 vs PS2 CDs, original Xbox vs 360 xisos
    if (found === 'ps1' && hint === 'ps2') return 'ps2';
    if (found === 'xbox' && hint === 'x360') return 'x360';
    return found;
  };
  if (ext === '.cue' || ext === '.m3u' || ext === '.ccd') {
    if (depth > 2) return hint;
    const parts = ext === '.cue' ? cueTracks(file) : ext === '.m3u' ? [m3uFirst(file)] : [file.replace(/\.ccd$/i, '.img')];
    for (const p of parts.filter(Boolean).slice(0, 3)) {
      let st; try { st = fs.statSync(p); } catch { continue; }
      const found = ext === '.m3u' ? sniffSystem(p, st.size, depth + 1) : sniffDiscImage(p, st.size);
      if (found) return refine(found);
    }
    return hint && NAME_ONLY.has(hint) ? hint : 'ps1';
  }
  if (ext === '.chd') {
    // compressed, but the CHD's own notes say what kind of disc it holds: GD-ROM is Dreamcast, DVD is PS2-era, CD is the rest
    const kind = chdKind(file);
    if (kind === 'gd') return hint === 'naomi' || hint === 'atomiswave' ? hint : 'dreamcast';
    if (kind === 'dvd') return hint && ['ps2', 'psp', 'gc', 'wii', 'xbox', 'x360'].includes(hint) ? hint : 'ps2';
    if (kind === 'cd' && hint === 'dreamcast') return 'ps1'; // a CD-ROM can't be a Dreamcast GD-ROM
    return hint && (NAME_ONLY.has(hint) || hint === 'gc' || hint === 'wii') ? hint : 'ps1';
  }
  const found = sniffDiscImage(file, size);
  if (found) return refine(found);
  if (ext === '.bin') {
    const head = withFile(file, (fd) => readAt(fd, 0, 0x110));
    if (txt(head, 0, 4) === 'SCE\0') return null; // a PS3/Vita program file, not a game image
    if (txt(head, 0x100, 0x108) === 'SEGA 32X') return '32x';
    if (txt(head, 0x100, 0x104) === 'SEGA' || txt(head, 0x101, 0x105) === 'SEGA') return 'genesis';
    if (hint) return hint;
    if (fs.existsSync(file.replace(/\.bin$/i, '.cue'))) return 'ps1';
    if (size <= 64 * 1024) return 'a2600'; // Atari 2600 dumps are tiny .bin files
    return size <= 8 * 1024 * 1024 ? 'genesis' : null;
  }
  return hint && NAME_ONLY.has(hint) ? hint : null; // .iso / .img with no signature we know
}

/** Inside a folder: is this an extracted game (PS3, Vita, Wii U, Xbox)? Returns the file that identifies it. */
function dumpMarker(dir, entries) {
  const find = (d, name, list) => {
    try {
      const hit = (list || fs.readdirSync(d)).find((e) => e.toLowerCase() === name);
      return hit ? path.join(d, hit) : null;
    } catch { return null; }
  };
  const ps3 = find(dir, 'ps3_game', entries);
  if (ps3) { const sfo = find(ps3, 'param.sfo'); if (sfo) return sfo; }
  // PS3 digital (PSN) game folder, as installed on the console: NPUB30000/PARAM.SFO + USRDIR
  if (find(dir, 'usrdir', entries)) { const sfo = find(dir, 'param.sfo', entries); if (sfo) return sfo; }
  const sce = find(dir, 'sce_sys', entries);
  if (sce && find(dir, 'eboot.bin', entries)) { const sfo = find(sce, 'param.sfo'); if (sfo) return sfo; }
  const meta = find(dir, 'meta', entries);
  if (meta && find(dir, 'code', entries)) { const xml = find(meta, 'meta.xml'); if (xml) return xml; }
  // Wii U in NUS format (encrypted, as downloaded from Nintendo): title.tmd + title.tik + 000000xx.app files
  const tmd = find(dir, 'title.tmd', entries);
  if (tmd && (entries || []).some((e) => /^[0-9a-f]{8}\.app$/i.test(e))) return tmd;
  if (sce && find(dir, 'eboot.bin', entries)) { const json = find(sce, 'param.json'); if (json) return json; } // PS5
  const xbox = find(dir, 'microsoftgame.config', entries) || (find(dir, 'appxmanifest.xml', entries) && find(dir, 'resources.pri', entries) ? find(dir, 'appxmanifest.xml', entries) : null);
  if (xbox) return xbox; // Xbox One / Series (GDK or UWP package)
  return find(dir, 'default.xex', entries) || find(dir, 'default.xbe', entries);
}

/** "Crash Bandicoot (USA) (Disc 1) [!].cue" -> "Crash Bandicoot" */
function nameFromFile(file) {
  return path.basename(file, path.extname(file))
    .replace(/^\d{3,5}\s*-\s+/, '') // release numbers: "0337 - Mario Kart 7"
    .replace(/\s*[([].*$/, '')
    .replace(/_/g, ' ')
    .replace(/\s+(decrypted|encrypted|trimmed|cia|3ds)$/i, '')
    .trim();
}

// ---- Headers of modern formats ------------------------------------------------------------
/** PlayStation PARAM.SFO (PS3, Vita, PSP): key/value table. */
function parseSfo(buf) {
  const out = {};
  if (buf.length < 20 || buf.toString('latin1', 0, 4) !== '\0PSF') return out;
  const keys = buf.readUInt32LE(8), data = buf.readUInt32LE(12), count = buf.readUInt32LE(16);
  for (let i = 0; i < count && 20 + i * 16 + 16 <= buf.length; i++) {
    const e = 20 + i * 16;
    const kOff = keys + buf.readUInt16LE(e), fmt = buf.readUInt16LE(e + 2), len = buf.readUInt32LE(e + 4), dOff = data + buf.readUInt32LE(e + 12);
    const key = buf.toString('latin1', kOff, buf.indexOf(0, kOff));
    out[key] = fmt === 0x0404 ? buf.readUInt32LE(dOff) : buf.toString('utf8', dOff, dOff + len).replace(/\0+$/, '');
  }
  return out;
}
function xmlTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  return m ? m[1].replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() : '';
}
/** Details for big formats that are identified by name: a better title and a serial where the files carry one. */
function nameOnlyInfo(file, system) {
  const base = path.basename(file).toLowerCase();
  const ext = path.extname(file).toLowerCase();
  const parent = path.dirname(file);
  let name = nameFromFile(file), serial = '';
  try {
    if (base === 'param.sfo') {
      const sfo = parseSfo(fs.readFileSync(file));
      name = sfo.TITLE || path.basename(path.dirname(parent));
      serial = sfo.TITLE_ID || '';
    } else if (base === 'meta.xml' || ext === '.rpx') {
      const xmlFile = base === 'meta.xml' ? file : path.join(parent, '..', 'meta', 'meta.xml');
      const game = base === 'meta.xml' ? path.dirname(parent) : path.dirname(parent);
      name = nameFromFile(game);
      if (fs.existsSync(xmlFile)) {
        const xml = fs.readFileSync(xmlFile, 'utf8');
        name = xmlTag(xml, 'longname_en') || name;
        serial = xmlTag(xml, 'product_code');
      }
    } else if (base === 'title.tmd') {
      // NUS folders are usually named after the game ("Mario Kart 8 [0005000010145D00]"); the title ID is in the TMD
      name = nameFromFile(parent);
      const id = withFile(file, (fd) => readAt(fd, 0x18c, 8));
      if (id.length === 8) serial = id.toString('hex').toUpperCase();
    } else if (base === 'default.xex' || base === 'default.xbe') {
      name = nameFromFile(parent);
    } else if (base === 'param.json') {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      const loc = j.localizedParameters || {};
      const lang = loc[loc.defaultLanguage] || loc['en-US'] || Object.values(loc).find((v) => v && v.titleName) || {};
      name = lang.titleName || nameFromFile(path.dirname(parent));
      serial = j.titleId || '';
    } else if (base === 'microsoftgame.config' || base === 'appxmanifest.xml') {
      const xml = fs.readFileSync(file, 'utf8');
      name = (xml.match(/DefaultDisplayName="([^"]+)"/) || xml.match(/<DisplayName>([^<]+)<\/DisplayName>/) || [])[1] || nameFromFile(parent);
      if (/^ms-resource:/i.test(name)) name = nameFromFile(parent);
      serial = (xml.match(/TitleId="?([0-9A-Fa-f]{8})/) || xml.match(/<TitleId>([0-9A-Fa-f]{8})</) || [])[1] || '';
    } else if (ext === '.pkg' && system === 'ps4') {
      // PS4 package: the content ID at 0x40 holds the title ID (UP9000-CUSA00900_00-…)
      const cid = withFile(file, (fd) => txt(readAt(fd, 0x40, 36), 0, 36));
      serial = (cid.match(/[A-Z]{4}\d{5}/) || [])[0] || '';
    } else if (system === 'x360' && !ext) {
      const s = stfsInfo(file);
      if (s) { name = s.title || nameFromFile(path.dirname(parent)); serial = s.titleId; }
    } else if (system === 'switch') {
      const id = path.basename(file).match(/\[(0100[0-9a-f]{12})\]/i);
      serial = id ? id[1].toUpperCase() : '';
    } else if (system === '3ds' && ext !== '.cia' && ext !== '.3dsx') {
      serial = withFile(file, (fd) => {
        const magic = txt(readAt(fd, 0x100, 4), 0, 4);
        const ncch = magic === 'NCSD' ? 0x4000 : magic === 'NCCH' ? 0 : -1;
        if (ncch < 0) return '';
        return txt(readAt(fd, ncch + 0x150, 16), 0, 16).replace(/[^\x20-\x7e]/g, '').trim();
      });
    }
  } catch { /* fall back to the file name */ }
  return { internalName: name, serial };
}

// ---- N64 byte orders --------------------------------------------------------
// .z64 = big endian (native), .v64 = 16-bit byteswapped, .n64 = 32-bit little endian
function n64Order(buf) {
  if (buf.length < 4) return null;
  const magic = buf.readUInt32BE(0);
  if (magic === 0x80371240) return 'z64';
  if (magic === 0x37804012) return 'v64';
  if (magic === 0x40123780) return 'n64';
  return null;
}

function toZ64(buf) {
  const order = n64Order(buf);
  if (order === 'z64' || order === null) return buf;
  const out = Buffer.from(buf); // copy
  if (order === 'v64') out.swap16();
  else if (order === 'n64') out.swap32();
  return out;
}

function parseN64Header(z64) {
  const name = z64.toString('latin1', 0x20, 0x34).replace(/\0/g, '').trim();
  const serial = z64.toString('latin1', 0x3b, 0x3f).replace(/[^\x20-\x7e]/g, '');
  const version = z64[0x3f];
  return { internalName: name, serial, version };
}

// ---- SNES --------------------------------------------------------------------
function stripSnesCopierHeader(buf) {
  return buf.length % 1024 === 512 ? buf.subarray(512) : buf;
}

function parseSnesHeader(buf) {
  // Try LoROM (0x7FC0) then HiROM (0xFFC0)
  for (const base of [0x7fc0, 0xffc0]) {
    if (buf.length < base + 0x20) continue;
    const title = buf.toString('latin1', base, base + 21);
    if (/^[\x20-\x7e]{21}$/.test(title)) return { internalName: title.trim(), serial: '' };
  }
  return { internalName: '', serial: '' };
}

// ---- Other cartridges: dump headers No-Intro leaves out, and internal names --------------------
function stripHeader(system, raw) {
  if (system === 'nes' && txt(raw, 0, 4) === 'NES\x1a') return raw.subarray(16);
  if (system === 'fds' && txt(raw, 0, 4) === 'FDS\x1a') return raw.subarray(16);
  if (system === 'lynx' && txt(raw, 0, 4) === 'LYNX') return raw.subarray(64);
  if (system === 'a7800' && txt(raw, 1, 10) === 'ATARI7800') return raw.subarray(128);
  if ((system === 'pce' || system === 'sgx') && raw.length % 8192 === 512) return raw.subarray(512);
  if (system === 'snes') return stripSnesCopierHeader(raw);
  return raw;
}
const clean = (s) => s.replace(/\0.*$/s, '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
function cartHeader(system, raw) {
  let internalName = '', serial = '';
  if (system === 'gba' && raw.length > 0xb0) { internalName = clean(txt(raw, 0xa0, 0xac)); serial = clean(txt(raw, 0xac, 0xb0)); }
  if ((system === 'gb' || system === 'gbc') && raw.length > 0x144) internalName = raw.toString('latin1', 0x134, 0x143).replace(/[\0\x80-\xff]/g, '').trim();
  if (system === 'nds' && raw.length > 0x10) { internalName = clean(txt(raw, 0, 12)); serial = clean(txt(raw, 0x0c, 0x10)); }
  if ((system === 'genesis' || system === '32x') && raw.length > 0x190) { internalName = clean(txt(raw, 0x150, 0x180)) || clean(txt(raw, 0x120, 0x150)); serial = clean(txt(raw, 0x180, 0x18e)); }
  if (system === 'lynx' && txt(raw, 0, 4) === 'LYNX') internalName = clean(txt(raw, 0x0a, 0x2a));
  if (system === 'a7800' && txt(raw, 1, 10) === 'ATARI7800') internalName = clean(txt(raw, 0x11, 0x31));
  if ((system === 'ngp' || system === 'ngpc') && raw.length > 0x30) internalName = clean(txt(raw, 0x24, 0x30));
  if (system === 'vb' && raw.length > 0x220) internalName = clean(raw.toString('latin1', raw.length - 0x220, raw.length - 0x20c));
  return { internalName, serial };
}

// ---- GameCube / Wii discs ---------------------------------------------------
function readDiscHeader(file) {
  return withFile(file, (fd) => {
    const head = readAt(fd, 0, 0x100);
    const magic = head.toString('latin1', 0, 4);
    let off = 0;
    if (magic === 'RVZ\x01' || magic === 'WIA\x01') off = 0x58; // disc header copy inside header 2
    else if (magic === 'WBFS') off = 0x200;
    else if (head.length >= 4 && head.readUInt32BE(0) === 0xb10bc001) off = 0x8000; // CISO
    const disc = off ? readAt(fd, off, 0x80) : head;
    const id = txt(disc, 0, 6);
    if (!/^[A-Z0-9]{6}$/.test(id)) return { serial: '', internalName: '' };
    const name = disc.toString('latin1', 0x20, 0x80).replace(/\0.*$/s, '').trim();
    const system = disc.length >= 0x20 && disc.readUInt32BE(0x18) === 0x5d1c9ea3 ? 'wii'
      : disc.length >= 0x20 && disc.readUInt32BE(0x1c) === 0xc2339f3d ? 'gc' : undefined;
    return { serial: id, internalName: name, ...(system ? { system } : {}) };
  });
}

function sha1(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex').toUpperCase();
}

function sha1File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha1');
    fs.createReadStream(file).on('data', (d) => h.update(d)).on('error', reject)
      .on('end', () => resolve(h.digest('hex').toUpperCase()));
  });
}

/**
 * Inspect a ROM file. Returns system, normalised bytes (for cartridges),
 * sha1 of the normalised data and header info. `alt` is the unstripped dump, for DATs that keep headers.
 */
async function inspectRom(file) {
  const stat = fs.statSync(file);
  const system = systemForExtension(file) ? sniffSystem(file, stat.size) : null;
  if (!system) throw new Error("Couldn't tell which console this file is for");
  const ext = path.extname(file).toLowerCase();

  if (system === 'gc' || system === 'wii') {
    const header = readDiscHeader(file);
    // Hashing a 1.4 GB disc is slow and Redump hashes don't apply to RVZ, so identify by disc ID.
    return { system, size: stat.size, sha1: null, format: ext.slice(1), ...header };
  }

  if (NAME_ONLY.has(system)) {
    // Big images have no shared checksum list here, so they're identified by name (and serial where possible)
    // and stay where they are (Cartridge remembers the path).
    const tracks = ext === '.cue' ? cueTracks(file) : [];
    const size = stat.size + tracks.reduce((n, t) => { try { return n + fs.statSync(t).size; } catch { return n; } }, 0);
    const format = path.basename(file).toLowerCase() === 'param.sfo' || path.basename(file).toLowerCase() === 'meta.xml' ? 'folder' : ext.slice(1);
    return { system, size, sha1: null, format, byName: true, tracks, ...nameOnlyInfo(file, system) };
  }

  if (stat.size > 512 * 1024 * 1024) throw new Error('File is too large to be a cartridge ROM');
  const raw = fs.readFileSync(file);
  const storeExt = STORE_EXT[system] || ext;

  if (system === 'n64') {
    const order = n64Order(raw);
    if (!order) throw new Error('This file does not look like an N64 ROM');
    const data = toZ64(raw);
    return { system, size: data.length, format: order, data, storeExt, converted: order !== 'z64', sha1: sha1(data), ...parseN64Header(data) };
  }

  const data = stripHeader(system, raw);
  const header = system === 'snes' ? parseSnesHeader(data) : cartHeader(system, raw);
  const info = { system, size: data.length, format: ext.slice(1), data, storeExt, converted: data !== raw, sha1: sha1(data), ...header };
  if (data !== raw) info.alt = { data: raw, sha1: sha1(raw) };
  return info;
}

module.exports = {
  chdKind, SHARED_EXT_SET: new Set(SHARED_EXT), stfsInfo, ROM_EXTENSIONS, NAME_ONLY, systemForExtension, sniffSystem, sniffDiscImage, hintFromPath, dumpMarker, cueTracks, nameFromFile,
  parseSfo, n64Order, toZ64, parseN64Header, stripSnesCopierHeader, parseSnesHeader, readDiscHeader, inspectRom, sha1, sha1File,
};
