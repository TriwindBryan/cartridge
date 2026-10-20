// Arcade games: MAME / FinalBurn Neo .zip "sets" (sf2.zip, mvsc.zip, sfiii3.zip…), identified by their set name.
// Uses catalog/arcade.json (built by tools/build-arcade.js). Pure Node.
'use strict';
const fs = require('fs');
const path = require('path');

// The BIOS set each board needs next to its games (FBNeo and MAME look in the same folder)
const BOARD_BIOS = { neogeo: 'neogeo', pgm: 'pgm', naomi: 'naomi', atomiswave: 'awbios', stv: 'stvbios', sys573: 'sys573', konamigx: 'konamigx' };
const ARCHIVE = /\.(zip|7z)$/i;

function load(file) {
  const db = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { sets: db.sets || {}, bios: new Set(db.bios || []) };
}

/** Set name for a file, if it looks like an arcade set: lowercase letters, digits and _ only ("sf2.zip"). */
function setNameOf(file) {
  if (!ARCHIVE.test(file)) return null;
  const base = String(file).split(/[\\/]/).pop().replace(ARCHIVE, '');
  return /^[a-z0-9_]{1,24}$/.test(base) ? base : null;
}

/** 'game' for a known set, 'bios' for a BIOS set, or null. */
function classify(db, file) {
  const name = setNameOf(file);
  if (!db || !name) return null;
  if (db.sets[name]) return 'game';
  if (db.bios.has(name)) return 'bios';
  return null;
}

/** "Street Fighter II - The World Warrior (910522 World)" -> "Street Fighter II - The World Warrior" */
const titleOf = (desc) => String(desc || '').replace(/\s*\(.*$/, '').split(' / ')[0].trim();

function lookup(db, name) {
  const s = db && db.sets[name];
  if (!s) return null;
  const [desc, year, maker, board, parent, src] = s;
  const p = parent && db.sets[parent];
  return { set: name, desc, title: titleOf(desc), year, maker, board, parent, parentDesc: p ? p[0] : '', src };
}

/** Everything Cartridge stores about an arcade set found on disk. */
function inspect(db, file) {
  const name = setNameOf(file);
  const a = lookup(db, name);
  if (!a) throw new Error('Not a known arcade set');
  const st = fs.statSync(file);
  const bios = BOARD_BIOS[a.board];
  const biosMissing = bios ? !['.zip', '.7z'].some((x) => fs.existsSync(path.join(path.dirname(file), bios + x))) : false;
  return {
    system: a.board, size: st.size, sha1: null, format: path.extname(file).slice(1).toLowerCase(),
    internalName: a.title, serial: name, byName: true,
    arcade: { set: name, desc: a.desc, year: a.year, maker: a.maker, parent: a.parent, parentDesc: a.parentDesc, src: a.src, bios: bios || null, biosMissing },
  };
}

module.exports = { BOARD_BIOS, load, setNameOf, classify, lookup, inspect, titleOf };
