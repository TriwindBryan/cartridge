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
  '.wud': 'wiiu', '.wux': 'wiiu', '.wua': 'wiiu', '.rpx': 'wiiu',
  '.nsp': 'switch', '.nsz': 'switch', '.xci': 'switch', '.xcz': 'switch',
  '.3ds': '3ds', '.cci': '3ds', '.cia': '3ds', '.cxi': '3ds', '.3dsx': '3ds',
  '.gdi': 'dreamcast', '.cdi': 'dreamcast',
  '.pbp': 'ps1', '.cso': 'psp', '.vpk': 'vita', '.pkg': 'ps3',
  '.xbe': 'xbox', '.xex': 'x360',
};
// Shared by several consoles: the file's contents (and then its folder name) decide.
const SHARED_EXT = ['.iso', '.bin', '.cue', '.chd', '.img', '.m3u', '.ccd'];
const ROM_EXTENSIONS = [...Object.keys(CART_EXT), ...Object.keys(DISC_EXT), ...SHARED_EXT];

// Systems whose files are big: identified by name (plus serial where the header has one) and left where they are.
const NAME_ONLY = new Set(['ps1', 'ps2', 'ps3', 'psp', 'vita', 'segacd', 'saturn', 'dreamcast', '3do', 'pcecd', 'neocd',
  'xbox', 'x360', 'wiiu', 'switch', '3ds']);
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
  if (base === 'meta.xml') return 'wiiu';
  return null;
}

// ---- Folder name hints ------------------------------------------------------------
// When a disc can't be told apart by its contents (.chd is compressed), the folder it sits in usually says
// ("D:\ROMs\Sega Saturn\…", "Sony - PlayStation 2", "PS1"). Specific names come before general ones.
const HINTS = [
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
    // Xbox discs (XDVDFS): an extracted "xiso" has it at 0x10000; full dumps put it after the video partition
    for (const [off, sys] of [[0x18310000, 'xbox'], [0xfdb0000, 'x360'], [0x2090000, 'x360'], [0x10000, 'xbox']]) {
      if (off + 20 <= size && txt(readAt(fd, off, 20), 0, 20) === XBOX_MAGIC) return sys;
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

/** Work out which console a file is for. Returns a system id or null. */
function sniffSystem(file, size, depth = 0) {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file).toLowerCase();
  if (base === 'param.sfo') return /^sce_sys$/i.test(path.basename(path.dirname(file))) ? 'vita' : 'ps3';
  if (base === 'meta.xml') return 'wiiu';
  if (CART_EXT[ext]) return CART_EXT[ext];
  if (ext === '.pkg') return withFile(file, (fd) => (readAt(fd, 0, 4).toString('latin1') === '\x7fPKG' ? 'ps3' : null));
  if (DISC_EXT[ext]) return DISC_EXT[ext];
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
  if (ext === '.chd') return hint && (NAME_ONLY.has(hint) || hint === 'gc' || hint === 'wii') ? hint : 'ps1'; // compressed: only the folder can tell
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
  const sce = find(dir, 'sce_sys', entries);
  if (sce && find(dir, 'eboot.bin', entries)) { const sfo = find(sce, 'param.sfo'); if (sfo) return sfo; }
  const meta = find(dir, 'meta', entries);
  if (meta && find(dir, 'code', entries)) { const xml = find(meta, 'meta.xml'); if (xml) return xml; }
  return find(dir, 'default.xex', entries) || find(dir, 'default.xbe', entries);
}

/** "Crash Bandicoot (USA) (Disc 1) [!].cue" -> "Crash Bandicoot" */
function nameFromFile(file) {
  return path.basename(file, path.extname(file)).replace(/\s*[([].*$/, '').replace(/_/g, ' ').trim();
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
    } else if (base === 'default.xex' || base === 'default.xbe') {
      name = nameFromFile(parent);
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
    return { system, size: data.length, format: order, data, storeExt, sha1: sha1(data), ...parseN64Header(data) };
  }

  const data = stripHeader(system, raw);
  const header = system === 'snes' ? parseSnesHeader(data) : cartHeader(system, raw);
  const info = { system, size: data.length, format: ext.slice(1), data, storeExt, sha1: sha1(data), ...header };
  if (data !== raw) info.alt = { data: raw, sha1: sha1(raw) };
  return info;
}

module.exports = {
  ROM_EXTENSIONS, NAME_ONLY, systemForExtension, sniffSystem, sniffDiscImage, hintFromPath, dumpMarker, cueTracks, nameFromFile,
  parseSfo, n64Order, toZ64, parseN64Header, stripSnesCopierHeader, parseSnesHeader, readDiscHeader, inspectRom, sha1, sha1File,
};
