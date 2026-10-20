// Community catalog: the decomp/recomp port lists maintained at
// github.com/tgeorgiadis/quiver-community-app-catalog (also used by Quiver Launcher).
'use strict';

const INDEX_URL = 'https://raw.githubusercontent.com/tgeorgiadis/quiver-community-app-catalog/main/index.json';
const SOURCE_PAGE = 'https://github.com/tgeorgiadis/quiver-community-app-catalog';

// tag -> our system id (first match wins, most specific first)
const SYSTEM_TAGS = [
  // specific names first: "xbox" is also on every Xbox 360 entry, "nintendo ds" before "ds" and so on
  ['switch', 'switch'], ['nintendo switch', 'switch'], ['nsw', 'switch'], ['wiiu', 'wiiu'], ['wii u', 'wiiu'], ['3ds', '3ds'], ['nintendo 3ds', '3ds'],
  ['n64dd', 'n64dd'], ['64dd', 'n64dd'], ['n64', 'n64'], ['snes', 'snes'], ['gbc', 'gbc'], ['gba', 'gba'], ['gb', 'gb'], ['fds', 'fds'], ['nes', 'nes'],
  ['nds', 'nds'], ['nintendo ds', 'nds'], ['virtual boy', 'vb'], ['gcn', 'gc'], ['gamecube', 'gc'], ['wii', 'wii'],
  ['ps3', 'ps3'], ['playstation 3', 'ps3'], ['vita', 'vita'], ['ps vita', 'vita'], ['psp', 'psp'], ['ps2', 'ps2'], ['ps1', 'ps1'], ['psx', 'ps1'],
  ['x360', 'x360'], ['xbox 360', 'x360'], ['xbox', 'xbox'],
  ['dreamcast', 'dreamcast'], ['dc', 'dreamcast'], ['saturn', 'saturn'], ['sega saturn', 'saturn'], ['sega cd', 'segacd'], ['mega cd', 'segacd'],
  ['32x', '32x'], ['smd', 'genesis'], ['gen', 'genesis'], ['sega genesis', 'genesis'], ['sega mega drive', 'genesis'],
  ['sms', 'sms'], ['master system', 'sms'], ['game gear', 'gg'], ['sg-1000', 'sg1000'],
  ['pc engine', 'pce'], ['turbografx', 'pce'], ['pce', 'pce'], ['neo geo pocket', 'ngp'], ['neo geo', 'neogeo'], ['neogeo', 'neogeo'],
  ['wonderswan', 'ws'], ['3do', '3do'], ['jaguar', 'jaguar'], ['lynx', 'lynx'], ['atari 2600', 'a2600'], ['atari 7800', 'a7800'],
  ['cps1', 'cps1'], ['cps2', 'cps2'], ['cps3', 'cps3'], ['naomi', 'naomi'], ['naomi2', 'naomi'], ['atomiswave', 'atomiswave'], ['mame', 'arcade'], ['fbneo', 'arcade'], ['arcade', 'arcade'], ['mobile', 'mobile'], ['pc', 'pc'],
];

function systemFromTags(tags) {
  const t = (tags || []).map((x) => String(x).toLowerCase());
  for (const [tag, sys] of SYSTEM_TAGS) if (t.includes(tag)) return sys;
  return 'pc';
}

function kindFromTags(tags) {
  const t = (tags || []).map((x) => String(x).toLowerCase());
  if (t.includes('recomp') || t.includes('recompilation')) return 'Static recompilation';
  if (t.includes('decomp') || t.includes('decompilation')) return 'Native PC port';
  if (t.includes('recreation')) return 'Reimplementation';
  return 'Community port';
}

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Flatten one list file into candidate entries. */
function candidatesFromList(list) {
  return (list.apps || []).filter((a) => a && a.repository && a.name).map((a) => {
    const tags = a.tags || [];
    return {
      key: `${a.repository.toLowerCase()}#${(a.releaseAssetFilter || '').toLowerCase()}`,
      repo: a.repository,
      name: a.name,
      project: a.project || a.repository.split('/')[1],
      system: systemFromTags(tags),
      kind: kindFromTags(tags),
      tags,
      icon: a.appIconUrl || null,
      assetFilter: a.releaseAssetFilter || null,
      filesToAdd: a.filesToAdd || [],
      harbourMasters: tags.some((t) => /harbour masters/i.test(t)) || /^harbourmasters\//i.test(a.repository),
      list: list.name || '',
    };
  });
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Cartridge-Launcher' } });
  if (!res.ok) throw new Error(`Couldn't load the community catalog (${res.status}).`);
  return res.json();
}

/** Download every list in the community index. */
async function fetchCommunity() {
  let index;
  try { index = await fetchJson(INDEX_URL); } catch (e) {
    if (/fetch failed/i.test(e.message)) throw new Error("Couldn't reach the community catalog. Check your internet connection.");
    throw e;
  }
  const lists = await Promise.all((index.lists || []).map((l) => fetchJson(l.remoteLocation).catch(() => null)));
  const seen = new Set();
  const out = [];
  for (const list of lists.filter(Boolean)) {
    for (const c of candidatesFromList(list)) {
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      out.push(c);
    }
  }
  return out;
}

/** Turn a community entry into a Cartridge game entry. */
function gameFromCandidate(c) {
  const id = `community-${slug(c.repo)}${c.assetFilter ? '-' + slug(c.assetFilter) : ''}`;
  return {
    id,
    title: c.name,
    port: c.project,
    system: c.system,
    year: null,
    developer: '',
    publisher: '',
    kind: c.kind,
    credits: [{ role: c.kind === 'Static recompilation' ? 'Recompiled by' : 'Made by', name: c.harbourMasters ? 'Harbour Masters' : c.repo.split('/')[0] }],
    repo: c.repo,
    description: `${c.project}, a ${c.kind.toLowerCase()} of ${c.name}. Added from the community catalog.`,
    filesToAdd: c.filesToAdd,
    assetMatch: c.assetFilter ? escapeRe(c.assetFilter) : undefined,
    rom: {
      titles: [c.name],
      headerNames: [c.name],
      setup: { type: c.harbourMasters ? 'beside-exe' : 'in-app' },
      note: 'Added from the community catalog: if your ROM isn\'t matched automatically, pick it from the list in the ROM slot.',
      firstRun: c.harbourMasters
        ? 'On first launch the game finds your ROM next to it and extracts its assets.'
        : 'If the game asks for your ROM or game files, the path is on your clipboard: paste it with Ctrl+V.',
    },
    art: { boxart: [`${c.name} (USA)`, `${c.name} (USA, Europe)`, `${c.name} (Europe)`], icon: c.icon },
    custom: true,
    source: 'community',
  };
}

module.exports = { INDEX_URL, SOURCE_PAGE, fetchCommunity, candidatesFromList, gameFromCandidate, systemFromTags, kindFromTags };
