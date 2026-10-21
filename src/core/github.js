// GitHub release lookup and Windows asset selection. Pure Node (uses global fetch).
'use strict';

const API = 'https://api.github.com';

function headers(token) {
  const h = { Accept: 'application/vnd.github+json', 'User-Agent': 'Cartridge-Launcher' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghJson(url, token) {
  let res;
  try {
    res = await fetch(url, { headers: headers(token) });
  } catch {
    const e = new Error("Couldn't reach GitHub. Check your internet connection.");
    e.code = 'OFFLINE';
    throw e;
  }
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset');
    const when = reset ? new Date(Number(reset) * 1000).toLocaleTimeString() : 'later';
    const err = new Error(`GitHub rate limit reached. Try again after ${when}, or add a GitHub token in Settings.`);
    err.code = 'RATE_LIMIT';
    throw err;
  }
  if (res.status === 404) { const e = new Error('No releases found'); e.code = 'NOT_FOUND'; throw e; }
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${url}`);
  return res.json();
}

/** Latest release; falls back to the newest release in the list (covers prerelease-only repos). */
async function latestRelease(repo, token) {
  try {
    return await ghJson(`${API}/repos/${repo}/releases/latest`, token);
  } catch (e) {
    if (e.code !== 'NOT_FOUND') throw e;
    const list = await ghJson(`${API}/repos/${repo}/releases?per_page=5`, token);
    if (!Array.isArray(list) || !list.length) throw e;
    return list[0];
  }
}

const PLATFORM_WORDS = {
  win32: { want: /(win|windows|win64|x64|x86_64|msvc)/i, avoid: /(linux|ubuntu|mac|macos|osx|darwin|appimage|flatpak|android|apk|ios|switch|wiiu|vita|3ds|arm64|aarch64)/i },
  linux: { want: /(linux|appimage|ubuntu)/i, avoid: /(win|windows|mac|osx|darwin|android|ios|switch)/i },
  darwin: { want: /(mac|macos|osx|darwin|universal|apple)/i, avoid: /(windows|win64|win32|\bwin\b|linux|ubuntu|appimage|flatpak|android|apk|\bios\b|switch|\.exe$|\.msi$)/i },
};
const JUNK = /(debug|symbols|\.pdb|source|src\b|sha256|checksum|\.sig$|\.asc$|\.txt$|\.json$)/i;
const ARCHIVE = /\.(zip|7z|rar|tar\.gz|tgz|tar\.xz)$/i;

/**
 * Choose the asset to download for this platform.
 * assetMatch (optional regex string from the catalog) narrows the choice first.
 */
function pickAsset(assets, platform = process.platform, assetMatch, arch = process.arch) {
  const words = PLATFORM_WORDS[platform] || PLATFORM_WORDS.win32;
  let pool = (assets || []).filter((a) => !JUNK.test(a.name));
  if (assetMatch) {
    const re = new RegExp(assetMatch, 'i');
    const narrowed = pool.filter((a) => re.test(a.name));
    if (narrowed.length) pool = narrowed;
  }
  const scored = pool.map((a) => {
    let s = 0;
    if (ARCHIVE.test(a.name)) s += 4;
    else if (platform === 'win32' && /\.exe$/i.test(a.name)) s += 2;
    else if (platform === 'linux' && /\.appimage$/i.test(a.name)) s += 3;
    else if (platform === 'darwin' && /\.dmg$/i.test(a.name)) s += 3; // a zip is simpler to unpack, so it wins a tie
    else s -= 10;
    if (words.want.test(a.name)) s += 5;
    if (words.avoid.test(a.name)) s -= 8;
    if (/(installer|setup)/i.test(a.name)) s -= 1;
    if (platform === 'win32' && /(x86|i686|win32)(?!_64)/i.test(a.name) && !/x86_64|x64|win64/i.test(a.name)) s -= 2;
    // On a Mac or Linux, a download that doesn't say which system it's for is almost always the Windows build
    // (zelda3_v0.3.zip was), so only count it when its name names this system or it's a Mac disk image / AppImage
    if (platform !== 'win32' && !words.want.test(a.name) && !/\.(dmg|appimage)$/i.test(a.name)) s -= 20;
    if (platform === 'darwin') {
      // Apple Silicon runs Intel builds too (Rosetta), but a native or universal build is better, and the reverse doesn't work
      const armOnly = /(arm64|aarch64|apple[-_ ]?silicon|\bm1\b)/i.test(a.name) && !/universal/i.test(a.name);
      const intelOnly = /(x86_64|x64|intel|amd64)/i.test(a.name) && !/universal/i.test(a.name);
      if (/universal/i.test(a.name)) s += 2;
      if (arch === 'arm64' && armOnly) s += 2;
      if (arch !== 'arm64' && armOnly) s -= 20;
      if (arch === 'arm64' && intelOnly) s -= 1;
    }
    return { a, s };
  }).filter((x) => x.s > 0).sort((x, y) => y.s - x.s || (y.a.size || 0) - (x.a.size || 0));
  return scored.length ? scored[0].a : null;
}

function summariseRelease(rel, game, platform) {
  // the catalog's assetMatch describes Windows downloads; Mac and Linux can have their own (game.mac.assetMatch)
  const plat = (platform === 'darwin' && game.mac) || (platform === 'linux' && game.linux) || {};
  const asset = pickAsset(rel.assets, platform, platform === 'win32' ? game.assetMatch : plat.assetMatch);
  return {
    tag: rel.tag_name,
    name: rel.name || rel.tag_name,
    published: rel.published_at,
    prerelease: !!rel.prerelease,
    notes: (rel.body || '').slice(0, 4000),
    url: rel.html_url,
    asset: asset ? { name: asset.name, url: asset.browser_download_url, size: asset.size, digest: asset.digest || null } : null,
  };
}

/**
 * Search GitHub for decomp / recomp ports.
 * GitHub's repository search doesn't support brackets, so instead of one complex query
 * we run a few simple ones side by side and merge the results.
 */
function discoverQueries(text) {
  const t = String(text || '').replace(/[()"]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t) return [`${t} recomp fork:false`, `${t} decomp fork:false`, `${t} port fork:false`];
  return ['topic:recompilation fork:false', 'topic:decompilation fork:false', 'topic:n64recomp fork:false'];
}

async function discover(query, token) {
  const queries = discoverQueries(query);
  const results = await Promise.allSettled(queries.map((q) =>
    ghJson(`${API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=30`, token)));
  const ok = results.filter((r) => r.status === 'fulfilled');
  if (!ok.length) throw results[0].reason;
  const byRepo = new Map();
  for (const r of ok) {
    for (const it of r.value.items || []) {
      if (byRepo.has(it.full_name)) continue;
      byRepo.set(it.full_name, {
        repo: it.full_name, description: it.description || '', stars: it.stargazers_count,
        updated: it.pushed_at, topics: it.topics || [], avatar: it.owner && it.owner.avatar_url,
      });
    }
  }
  return [...byRepo.values()].sort((a, b) => b.stars - a.stars).slice(0, 50);
}

module.exports = { latestRelease, pickAsset, summariseRelease, discover, discoverQueries, ghJson };
