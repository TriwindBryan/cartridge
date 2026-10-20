// Cover art: matching games and ROMs to libretro-thumbnails box art, with SteamGridDB as an optional fallback.
// Pure Node (fetch is passed in), so it can be unit tested.
'use strict';

const ORG = 'libretro-thumbnails';
const API = 'https://api.github.com/repos/';
const RAW = 'https://raw.githubusercontent.com/';
const SGDB = 'https://www.steamgriddb.com/api/v2/';

/** libretro-thumbnails file names replace these characters with "_". */
const thumbName = (n) => String(n).replace(/[&*/:`<>?\\|"]/g, '_');
const boxartUrl = (repo, name) => `${RAW}${ORG}/${repo}/master/Named_Boxarts/${encodeURIComponent(thumbName(name))}.png`;

/** "Legend of Zelda, The - Majora's Mask (USA) (Rev 1)" -> { base: "Legend of Zelda, The - Majora's Mask", tags: ['USA', 'Rev 1'] } */
function splitTags(name) {
  const s = String(name || '');
  const i = s.search(/\s*[([]/);
  const base = (i < 0 ? s : s.slice(0, i)).trim();
  const tags = [...s.matchAll(/[([]([^)\]]*)[)\]]/g)].map((m) => m[1].trim());
  return { base, tags };
}

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13 };
/** Words of a title, lowercased, with "The" moved/dropped, "&" as "and" and roman numerals as digits. */
function words(title) {
  return splitTags(title).base.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/_/g, ' ').replace(/&/g, ' and ').replace(/'/g, '')
    .replace(/,\s*the\b/g, ' ').replace(/^the\s+/, '').replace(/\s+-\s+the\s+/g, ' ')
    .split(/[^a-z0-9]+/).filter(Boolean)
    .map((w) => (ROMAN[w] ? String(ROMAN[w]) : w));
}
const normTitle = (t) => words(t).join('');

const BAD_TAGS = /\b(beta|proto|prototype|demo|sample|kiosk|pirate|hack|unl|aftermarket|program|debug)\b/i;
/** Lower is better: preferred regions first, then the usual order, and pre-release versions last. */
function rank(name, prefer = []) {
  const { tags } = splitTags(name);
  const t = tags.join(', ');
  let r = 50;
  const order = [...prefer, 'USA', 'World', 'USA, Europe', 'Europe', 'Japan, USA', 'Japan'];
  for (let i = 0; i < order.length; i++) if (new RegExp(`(^|, )${order[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(,|$)`).test(tags[0] || '')) { r = i; break; }
  if (BAD_TAGS.test(t)) r += 100;
  if (/\bRev\b|\bv\d/i.test(t)) r += 0.5;
  return r;
}

/** Index a console's cover list for matching. names = file names without ".png". */
function makeIndex(names) {
  const exact = new Set(names);
  const byNorm = new Map();
  const entries = [];
  for (const n of names) {
    const w = words(n);
    const key = w.join('');
    if (!key) continue;
    if (!byNorm.has(key)) byNorm.set(key, []);
    byNorm.get(key).push(n);
    entries.push({ name: n, words: new Set(w), nums: w.filter((x) => /^\d+$/.test(x)).join(' '), first: w[0] });
  }
  return { exact, byNorm, entries, size: names.length };
}

/**
 * Pick the best cover name.
 * want: { exact: [No-Intro names], titles: [plain titles], region: 'USA' }
 */
function bestMatch(index, want) {
  const prefer = want.region ? [want.region] : [];
  const pick = (list) => [...list].sort((a, b) => rank(a, prefer) - rank(b, prefer) || a.length - b.length)[0];
  // 1. an exact No-Intro name (what verified ROMs and the built-in catalog give)
  for (const n of want.exact || []) if (index.exact.has(thumbName(n))) return thumbName(n);
  // 2. the same title once tags, punctuation and "The" are ignored
  const titles = [...(want.exact || []), ...(want.titles || [])].filter(Boolean);
  for (const t of titles) {
    const hit = index.byNorm.get(normTitle(t));
    if (hit) return pick(hit);
  }
  // 3. close enough: almost all the same words, the same first word and the same numbers (so FF VII never becomes FF VIII)
  let best = null;
  for (const t of titles) {
    const w = words(t);
    if (w.length < 2) continue;
    const set = new Set(w);
    const nums = w.filter((x) => /^\d+$/.test(x)).join(' ');
    for (const e of index.entries) {
      if (e.first !== w[0] || e.nums !== nums) continue;
      let shared = 0;
      for (const x of set) if (e.words.has(x)) shared++;
      const score = shared / (set.size + e.words.size - shared);
      if (score >= 0.75 && (!best || score > best.score || (score === best.score && rank(e.name, prefer) < rank(best.name, prefer)))) best = { name: e.name, score };
    }
  }
  return best ? best.name : null;
}

/** The region tag of a dump name, used to prefer the matching box. */
function regionOf(name) {
  const { tags } = splitTags(name);
  return tags.find((t) => /^(USA|Europe|Japan|World|Australia|Korea|Brazil|France|Germany|Spain|Italy)(,|$)/.test(t)) || null;
}

/** Download a console's cover list from GitHub (two API calls). */
async function fetchIndexNames(repo, fetchImpl, token) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'Cartridge-Launcher', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const get = async (url) => {
    const res = await fetchImpl(url, { headers });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    return res.json();
  };
  try {
    const root = await get(`${API}${ORG}/${repo}/git/trees/master`);
    const dir = (root.tree || []).find((e) => e.path === 'Named_Boxarts' && e.type === 'tree');
    if (!dir) return [];
    const list = await get(`${API}${ORG}/${repo}/git/trees/${dir.sha}`);
    return (list.tree || []).filter((e) => /\.png$/i.test(e.path)).map((e) => e.path.replace(/\.png$/i, ''));
  } catch (e) {
    // GitHub's API limit is 60 calls an hour without a token; the thumbnail server's folder listing is the backup
    const site = `https://thumbnails.libretro.com/${encodeURIComponent(repo.replace(/_/g, ' '))}/Named_Boxarts/`;
    const res = await fetchImpl(site, { headers: { 'User-Agent': 'Cartridge-Launcher' } }).catch(() => null);
    if (!res || !res.ok) throw e;
    const html = await res.text();
    return [...html.matchAll(/href="([^"?/]+)\.png"/gi)].map((m) => decodeURIComponent(m[1]));
  }
}

/** SteamGridDB (needs the user's free API key): best 600x900 cover for a title. */
async function steamGridCover(title, key, fetchImpl) {
  const headers = { Authorization: `Bearer ${key}`, 'User-Agent': 'Cartridge-Launcher' };
  const get = async (url) => {
    const res = await fetchImpl(url, { headers });
    if (res.status === 401 || res.status === 403) throw new Error('SteamGridDB key was not accepted');
    if (!res.ok) return null;
    return res.json();
  };
  const search = await get(`${SGDB}search/autocomplete/${encodeURIComponent(title)}`);
  const hits = (search && search.data) || [];
  if (!hits.length) return null;
  const want = normTitle(title);
  const game = hits.find((h) => normTitle(h.name) === want) || hits[0];
  const grids = await get(`${SGDB}grids/game/${game.id}?dimensions=600x900&types=static&nsfw=false&humor=false`);
  const g = grids && grids.data && grids.data[0];
  return g ? { url: g.url, name: game.name } : null;
}

/** Is this buffer a real image (PNG, JPEG, WebP or GIF)? */
function imageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (buf.toString('latin1', 0, 3) === 'GIF') return 'gif';
  return null;
}

module.exports = { thumbName, boxartUrl, splitTags, words, normTitle, rank, makeIndex, bestMatch, regionOf, fetchIndexNames, steamGridCover, imageType };
