// Builds catalog/arcade.json: every arcade set Cartridge can recognise, with its name, year, maker, board and parent.
// Sources (from github.com/libretro/libretro-database, metadat/):
//   fbneo-split/FinalBurn Neo (ClrMame Pro XML, Arcade only).dat   names as used by FBNeo and its box art
//   mame/MAME 2016 XML (Arcade Only).xml                           the board each set runs on (sourcefile)
// Usage: node tools/build-arcade.js <fbneo.dat> <mame2016.xml> > catalog/arcade.json
'use strict';
const fs = require('fs');

// MAME driver file -> Cartridge board id
const BOARDS = {
  'cps1.cpp': 'cps1', 'kenseim.cpp': 'cps1', 'cps2.cpp': 'cps2', 'cps3.cpp': 'cps3', 'zn.cpp': 'zn',
  'neogeo.cpp': 'neogeo', 'neodriv.hxx': 'neogeo', 'neoprint.cpp': null,
  'naomi.cpp': 'naomi', 'segas16a.cpp': 'sys16', 'segas16b.cpp': 'sys16', 'segas18.cpp': 'sys18', 'segas24.cpp': 'sys24',
  'segas32.cpp': 'sys32', 'model1.cpp': 'model1', 'model2.cpp': 'model2', 'model3.cpp': 'model3', 'stv.cpp': 'stv',
  'namcos1.cpp': 'namcos1', 'namcos2.cpp': 'namcos2', 'namcos11.cpp': 'namcos11', 'namcos12.cpp': 'namcos12', 'namcos22.cpp': 'namcos22',
  'konamigx.cpp': 'konamigx', 'ksys573.cpp': 'sys573', 'taito_f3.cpp': 'taitof3', 'pgm.cpp': 'pgm', 'cave.cpp': 'cave',
  'psikyo.cpp': 'psikyo', 'psikyo4.cpp': 'psikyo', 'psikyosh.cpp': 'psikyo',
  'midtunit.cpp': 'midway', 'midwunit.cpp': 'midway', 'midyunit.cpp': 'midway', 'midxunit.cpp': 'midway',
  'toaplan1.cpp': 'toaplan', 'toaplan2.cpp': 'toaplan', 'm72.cpp': 'irem', 'm92.cpp': 'irem',
};

const [fbFile, mameFile] = process.argv.slice(2);
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? m[1] : null; };
const unxml = (s) => s.replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const field = (body, tag) => { const m = body.match(new RegExp(`<${tag}>([^<]*)</${tag}>`)); return m ? unxml(m[1]).trim() : ''; };

// MAME 2016: board for every machine, plus the sets of boards FBNeo doesn't emulate (NAOMI, Model 2/3, ZN, ST-V…)
const mame = {};
const mameText = fs.readFileSync(mameFile, 'utf8');
for (const m of mameText.matchAll(/<machine ([^>]*)>([\s\S]*?)<\/machine>/g)) {
  const tag = m[1];
  if (/isbios="yes"|isdevice="yes"|ismechanical="yes"|runnable="no"/.test(tag)) continue;
  const name = attr(tag, 'name');
  let board = BOARDS[attr(tag, 'sourcefile')] || null;
  if (board === 'naomi' && attr(tag, 'romof') === 'awbios') board = 'atomiswave';
  mame[name] = { board, desc: field(m[2], 'description'), year: field(m[2], 'year'), maker: field(m[2], 'manufacturer'), parent: attr(tag, 'cloneof') };
}

const sets = {};
const fbText = fs.readFileSync(fbFile, 'utf8');
for (const m of fbText.matchAll(/<game ([^>]*)>([\s\S]*?)<\/game>/g)) {
  const tag = m[1];
  if (/isbios="yes"|isdevice="yes"/.test(tag)) continue;
  const name = attr(tag, 'name');
  const parent = attr(tag, 'cloneof');
  const romof = attr(tag, 'romof');
  let board = (mame[name] && mame[name].board) || (parent && mame[parent] && mame[parent].board) || (romof === 'neogeo' ? 'neogeo' : null);
  if (board == null && romof === 'cps3') board = 'cps3';
  sets[name] = [unxml(field(m[2], 'description')), parseInt(field(m[2], 'year'), 10) || 0, field(m[2], 'manufacturer'), board || 'arcade', parent || '', 'f'];
}
// sets only MAME runs, on the boards above
for (const [name, x] of Object.entries(mame)) {
  if (sets[name] || !x.board) continue;
  sets[name] = [x.desc, parseInt(x.year, 10) || 0, x.maker, x.board, x.parent || '', 'm'];
}
const bios = ['neogeo', 'pgm', 'naomi', 'naomi2', 'awbios', 'cps3', 'stvbios', 'coh1000c', 'coh1000w', 'coh1002e', 'coh3002c', 'sys573', 'decocass', 'skns', 'konamigx', 'isgsm', 'hod2bios'];
process.stdout.write(JSON.stringify({
  about: 'Arcade sets Cartridge recognises: name -> [description, year, manufacturer, board, parent, source (f = FinalBurn Neo, m = MAME)]. Built by tools/build-arcade.js from libretro-database.',
  bios,
  sets,
}));
