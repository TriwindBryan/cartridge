// No-Intro DAT parsing and ROM <-> game matching. Pure Node.
'use strict';

/** Parse a clrmamepro-style DAT into Maps keyed by SHA-1 and by serial. */
function parseDat(text) {
  const bySha1 = new Map();
  const bySerial = new Map();
  const gameRe = /game \(\s*([\s\S]*?)\n\)/g;
  let m;
  while ((m = gameRe.exec(text))) {
    const block = m[1];
    const name = (block.match(/^\s*name "([^"]+)"/m) || [])[1];
    if (!name) continue;
    const region = (block.match(/^\s*region "([^"]+)"/m) || [])[1] || '';
    const romRe = /^\s*rom \((.*)\)\s*$/gm; // rom names contain parentheses, so match the whole line
    let r;
    while ((r = romRe.exec(block))) {
      const line = r[1];
      const sha = (line.match(/sha1 ([0-9A-Fa-f]{40})/) || [])[1];
      const serial = (line.match(/serial "([^"]+)"/) || [])[1] || (block.match(/^\s*serial "([^"]+)"/m) || [])[1] || '';
      const entry = { name, region, serial, sha1: sha ? sha.toUpperCase() : null };
      if (entry.sha1) bySha1.set(entry.sha1, entry);
      if (serial && !bySerial.has(serial)) bySerial.set(serial, entry);
    }
  }
  return { bySha1, bySerial, size: bySha1.size };
}

// The same names are matched against every game on each update, so remember the results (13,000-ROM libraries)
function memo(fn, max = 60000) {
  const cache = new Map();
  return (x) => {
    let v = cache.get(x);
    if (v === undefined) {
      if (cache.size >= max) cache.clear();
      v = fn(x);
      cache.set(x, v);
    }
    return v;
  };
}

/** "Legend of Zelda, The - Majora's Mask (USA) (Rev 1)" -> { base, tags: ['USA','Rev 1'] } */
const splitName = memo(splitNameRaw);
function splitNameRaw(name) {
  const i = name.indexOf(' (');
  const base = i === -1 ? name : name.slice(0, i);
  const tags = [];
  const tagRe = /\(([^)]+)\)/g;
  let t;
  while ((t = tagRe.exec(name))) tags.push(...t[1].split(',').map((s) => s.trim()));
  return { base, tags };
}

// Re-releases and special editions carry different data, so a port that names a region expects the original release, not these
const SPECIAL = /^(lodgenet|gamecube|ique|switch online|virtual console|wii u virtual console|wii virtual console|classic mini|nintendo power|kiosk|demo|sample|beta.*|proto.*|aftermarket|unl|pirate|.*collection.*|.*edition)$/i;
const isSpecial = (tag) => SPECIAL.test(tag);

const norm = memo((s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''));

/**
 * Decide how well a ROM fits a catalog game.
 * rom: { system, sha1, serial, internalName, datName }
 * Returns { level: 'ok'|'warn'|null, reason }
 */
function matchRomToGame(rom, game) {
  const spec = game.rom || {};
  const discFamily = spec.discIds && ['gc', 'wii'].includes(rom.system) && ['gc', 'wii'].includes(game.system);
  const arcadeFamily = !!rom.arcade && game.system === 'arcade'; // a port listed as "arcade" takes a set from any board
  if (rom.system !== game.system && !discFamily && !arcadeFamily) return { level: null };
  // arcade ports can name the exact sets they accept (["sf2", "sf2ce"]), clones of those count too
  if (rom.arcade && spec.sets) {
    const ok = spec.sets.includes(rom.arcade.set) || (rom.arcade.parent && spec.sets.includes(rom.arcade.parent));
    return ok ? { level: spec.sets.includes(rom.arcade.set) ? 'ok' : 'warn', reason: spec.sets.includes(rom.arcade.set) ? `Arcade set ${rom.arcade.set}` : `${rom.arcade.set} is a different version of ${rom.arcade.parent}; the port expects ${spec.sets.join(' or ')}` } : { level: null };
  }

  // Disc games: match by disc ID prefix (3 chars = game, 4th = region)
  if (spec.discIds) {
    const hit = spec.discIds.some((p) => rom.serial && rom.serial.startsWith(p));
    return hit ? { level: 'ok', reason: `Disc ${rom.serial}` } : { level: null };
  }

  if (spec.sha1 && rom.sha1 && spec.sha1.map((s) => s.toUpperCase()).includes(rom.sha1)) {
    return { level: 'ok', reason: 'Exact checksum match' };
  }

  let titleHit = false;
  let tags = [];
  if (rom.datName) {
    const { base, tags: t } = splitName(rom.datName);
    tags = t;
    titleHit = (spec.titles || []).some((title) => norm(title) === norm(base));
  }
  if (!titleHit && rom.internalName && spec.headerNames) {
    titleHit = spec.headerNames.some((h) => norm(h) === norm(rom.internalName));
  }
  if (!titleHit && rom.byName && rom.internalName) {
    // big dumps (Switch, Wii U, PS3, discs…) are named after the game, so the title list applies too
    // arcade titles often carry a subtitle ("Metal Slug - Super Vehicle-001"), so the main title counts too
    const names = [rom.internalName, ...(rom.arcade ? [rom.internalName.split(' - ')[0]] : [])];
    titleHit = (spec.titles || []).some((title) => names.some((n) => norm(title) === norm(n)));
  }
  if (!titleHit) return { level: null };

  if (!rom.datName) {
    return spec.regions || spec.requireTags
      ? { level: 'warn', reason: "Couldn't verify the version of this dump. It may still work." }
      : { level: 'ok', reason: rom.byName ? 'Matched by file name' : 'Identified by ROM header' };
  }
  const has = (tag) => tags.some((x) => x.toLowerCase() === tag.toLowerCase());
  if (spec.regions && !spec.regions.some(has)) {
    return { level: 'warn', reason: `This is the ${tags[0] || 'unknown'} version; the port expects ${spec.regions.join(' or ')}.` };
  }
  if (spec.requireTags && !spec.requireTags.every(has)) {
    return { level: 'warn', reason: `The port expects the ${spec.requireTags.join(', ')} release.` };
  }
  const special = spec.regions ? tags.filter((t) => isSpecial(t) && !(spec.requireTags || []).some((r) => r.toLowerCase() === t.toLowerCase())) : [];
  if (special.length) {
    return { level: 'warn', reason: `This is the ${special.join(', ')} release; the port expects the original ${spec.regions.join(' or ')} release.` };
  }
  if (spec.excludeTags && spec.excludeTags.some(has)) {
    return { level: 'warn', reason: `The ${spec.excludeTags.join(', ')} release may not be supported.` };
  }
  if (spec.sha1 && rom.sha1) {
    return { level: 'warn', reason: "The checksum doesn't match the one the port lists." };
  }
  return { level: 'ok', reason: 'Verified against No-Intro' };
}

/** Best ROM for a game from the library list (ok beats warn; manual assignment wins). */
function bestRomForGame(game, roms, manualId) {
  if (manualId) {
    const r = roms.find((x) => x.id === manualId);
    if (r) return { rom: r, level: 'ok', reason: 'Chosen by you' };
  }
  let best = null;
  for (const rom of roms) {
    const m = matchRomToGame(rom, game);
    if (!m.level) continue;
    if (!best || (best.level === 'warn' && m.level === 'ok')) best = { rom, ...m };
    if (best.level === 'ok') break;
  }
  return best;
}

module.exports = { parseDat, splitName, norm, isSpecial, matchRomToGame, bestRomForGame };
