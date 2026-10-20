// Look up a game's Metascore from its public Metacritic page. Pure Node (fetch is injectable).
'use strict';

const BASE = 'https://www.metacritic.com/game/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

/** "The Legend of Zelda: Majora's Mask" -> "the-legend-of-zelda-majoras-mask" (Metacritic's URL style). */
function slugify(title) {
  return String(title || '')
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ') // "[Remastered]", "(USA)"
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const PLATFORM_NAMES = ['Nintendo 64', 'GameCube', 'Wii U', 'Wii', 'Super Nintendo', 'SNES', 'Game Boy Advance', 'Game Boy Color', 'Game Boy', 'DS', '3DS',
  'PlayStation 5', 'PlayStation 4', 'PlayStation 3', 'PlayStation 2', 'PlayStation', 'PSP', 'Xbox 360', 'Xbox One', 'Xbox', 'Dreamcast', 'Genesis', 'PC', 'Switch'];

function findRating(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRating(n); if (r) return r; } return null; }
  if (node.aggregateRating && node.aggregateRating.ratingValue != null) {
    return { rating: node.aggregateRating, platform: [].concat(node.gamePlatform || node.platform || [])[0] || '' };
  }
  for (const v of Object.values(node)) { const r = findRating(v); if (r) return r; }
  return null;
}

/** Pull { score, reviews, platform, user } out of a Metacritic game page. score is null for "tbd". */
function parsePage(html) {
  const critic = parseCritic(html);
  const user = parseUser(pageText(html));
  if (critic === undefined) return user ? { score: null, reviews: 0, platform: platformIn(html), user } : undefined;
  return { ...critic, user: user || null };
}

function pageText(html) {
  return html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
}

/** "User score / Universal Acclaim / Based on 2,661 User Ratings / 9.2" -> { score: 9.2, ratings: 2661 } */
function parseUser(text) {
  let tbd = null;
  for (const hit of text.matchAll(/User Score/gi)) {
    const block = text.slice(hit.index, hit.index + 260);
    const rat = block.match(/Based on ([\d,]+) User Ratings?/i);
    const ratings = rat ? Number(rat[1].replace(/,/g, '')) : 0;
    const rest = (rat ? block.replace(rat[0], ' ') : block).replace(/User Score/i, ' ');
    const num = rest.match(/(?:^|\s)(10(?:\.0)?|\d\.\d)(?=\s|$)/);
    if (num && rat) return { score: Number(num[1]), ratings };
    if (/\btbd\b/i.test(block.slice(0, 140))) tbd = tbd || { score: null, ratings };
  }
  return tbd;
}

function parseCritic(html) {
  // 1) schema.org data embedded in the page
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const found = findRating(JSON.parse(m[1]));
      if (found) {
        const score = Math.round(Number(found.rating.ratingValue));
        if (Number.isFinite(score) && score >= 0 && score <= 100) {
          return { score, reviews: Number(found.rating.reviewCount || found.rating.ratingCount) || 0, platform: String(found.platform || '') };
        }
      }
    } catch { /* not JSON we understand */ }
  }
  // 2) the page's own data blob: only read "score" and "reviewCount" from inside the criticScoreSummary object itself,
  //    never from whatever comes after it (other games, ads), which is how a page with no score once showed 144
  const summary = html.match(/"criticScoreSummary"\s*:\s*\{([^{}]*)\}/);
  if (summary) {
    const sc = summary[1].match(/"score"\s*:\s*(null|\d{1,3})/);
    const rc = summary[1].match(/"reviewCount"\s*:\s*(\d+)/);
    if (sc && sc[1] === 'null') return { score: null, reviews: 0, platform: platformIn(html) };
    if (sc && validScore(Number(sc[1]))) return { score: Number(sc[1]), reviews: rc ? Number(rc[1]) : 0, platform: platformIn(html) };
  }
  // 3) visible text: "Metascore ... 88 ... Based on 15 Critic Reviews"
  const text = pageText(html);
  // The page shows "Metascore / Generally Favorable / Based on 15 Critic Reviews / 88" (number last),
  // so read the score from the block in either order.
  let sawTbd = false;
  for (const hit of text.matchAll(/Metascore/gi)) {
    const at = hit.index;
    const block = text.slice(at, at + 260);
    const rev = block.match(/Based on (\d+) Critic Reviews?/i);
    if (rev) {
      const rest = block.replace(rev[0], ' ').replace(/Metascore/i, ' ');
      const num = rest.match(/(?:^|\s)(\d{1,3})(?=\s|$)/);
      if (num && validScore(Number(num[1]))) return { score: Number(num[1]), reviews: Number(rev[1]), platform: platformIn(html) };
    }
    if (/^Metascore\W{0,40}tbd\b/i.test(block) || /\btbd\b/i.test(block.slice(0, 120))) sawTbd = true;
  }
  if (sawTbd) return { score: null, reviews: 0, platform: platformIn(html) };
  return undefined; // couldn't read the page
}

function platformIn(html) {
  const m = html.match(/"gamePlatform"\s*:\s*"([^"]+)"/) || html.match(/"platform"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/);
  if (m) return m[1];
  // visible text: only when exactly one platform is named, since the site menu lists many (that's how "DS" got picked)
  const seen = PLATFORM_NAMES.filter((p) => html.includes(`>${p}<`));
  return seen.length === 1 ? seen[0] : '';
}

const validScore = (n) => Number.isInteger(n) && n >= 0 && n <= 100;

/** Last check before anything is shown: a Metascore is 0-100 and a User Score 0-10, anything else is a misread. */
function sane(r) {
  if (!r) return r;
  const out = { ...r };
  if (out.score != null && !validScore(out.score)) return undefined;
  if (!Number.isFinite(out.reviews) || out.reviews < 0) out.reviews = 0;
  if (out.user && (out.user.score != null && !(out.user.score >= 0 && out.user.score <= 10))) out.user = null;
  return out;
}

/**
 * Look a title up. Returns { score, reviews, platform, url } (score null = Metacritic has no score),
 * or null if there's no page for it.
 */
async function lookup(title, fetchImpl = fetch) {
  const slug = slugify(title);
  if (!slug) return null;
  const url = `${BASE}${slug}/`;
  const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Metacritic answered ${res.status}`);
  const parsed = sane(parsePage(await res.text()));
  if (parsed === undefined) throw new Error("Couldn't read Metacritic's page");
  return { ...parsed, url };
}

/** Bump when the page reading changes, so scores saved by an older version are looked up again. */
const VERSION = 2;

module.exports = { slugify, parsePage, parseUser, lookup, sane, VERSION };
