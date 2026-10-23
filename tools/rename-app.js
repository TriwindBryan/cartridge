#!/usr/bin/env node
'use strict';
// Renames the app everywhere people can see it, in one go:
//   node tools/rename-app.js Cartridge Fulton
// It changes the window text, Help, README, docs, installer and download names, the menus and the build scripts.
// It leaves alone the names the app uses inside itself (the preload bridge, saved-settings keys, temp folder prefixes, bundled
// font names) and the GitHub address, because changing those would break saved data or links. CHANGELOG.md keeps its history.
// Run `npm test` afterwards, and rename the GitHub repository by hand (Settings → General) if you want it to match.
const fs = require('fs');
const path = require('path');

const [OLD, NEW] = process.argv.slice(2);
if (!OLD || !NEW) { console.error('Usage: node tools/rename-app.js OldName NewName'); process.exit(1); }
const root = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'catalog', 'fonts']);
const SKIP_FILES = new Set(['CHANGELOG.md', 'package-lock.json', 'rom.js', 'OFL.txt', 'rename-app.js']);
const EXT = new Set(['.js', '.html', '.css', '.md', '.json', '.bat', '.yml', '.py', '.svg']);

const lower = OLD.toLowerCase();
// Things that must keep the old spelling. Each is swapped for a placeholder, then put back.
const KEEP = [
  new RegExp(`window\\.${lower}\\b`, 'g'), new RegExp(`exposeInMainWorld\\('${lower}'`, 'g'), new RegExp(`/\\* global ${lower} \\*/`, 'g'),
  new RegExp(`'${lower}\\.view'`, 'g'), new RegExp(`pkg\\.${lower}\\b`, 'g'), new RegExp(`from: '${lower}'`, 'g'),
  new RegExp(`"${OLD}( (Display|Heavy|Text))"`, 'g'), new RegExp(`\\b${OLD} (Display|Heavy|Text)\\b`, 'g'),
  new RegExp(`${lower}-(rom|dmg)-`, 'g'), new RegExp(`\\.${lower}-backup`, 'g'),
  new RegExp(`[A-Za-z0-9_-]+/${lower}\\b`, 'g'), new RegExp(`"${lower}": \\{`, 'g'), new RegExp(`com\\.${lower}\\.`, 'g'),
  new RegExp(`\\bthe ${lower} (ROM|game|cart)`, 'gi'),
];

let changed = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) { if (!SKIP_DIRS.has(name.name)) walk(p); continue; }
    if (SKIP_FILES.has(name.name) || !EXT.has(path.extname(name.name))) continue;
    const before = fs.readFileSync(p, 'utf8');
    const kept = [];
    let s = before;
    for (const re of KEEP) s = s.replace(re, (m) => { kept.push(m); return `\u0000K${kept.length - 1}\u0000`; });
    s = s.split(OLD).join(NEW).split(OLD.toUpperCase()).join(NEW.toUpperCase());
    s = s.split(`${OLD}-Launcher`).join(`${NEW}-Launcher`);
    s = s.replace(/\u0000K(\d+)\u0000/g, (_m, i) => kept[Number(i)]);
    if (s !== before) { fs.writeFileSync(p, s); changed++; console.log('updated', path.relative(root, p)); }
  }
}
walk(root);
// file names that carry the app name (the Windows "Start …" shortcut file)
for (const f of fs.readdirSync(root)) {
  if (f.includes(OLD)) { fs.renameSync(path.join(root, f), path.join(root, f.split(OLD).join(NEW))); console.log('renamed', f); }
}
console.log(`${changed} files updated.`);
