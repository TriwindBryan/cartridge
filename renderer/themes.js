// Color themes for Settings → Colors. The first one is the default.
// A theme is one accent color (buttons, links, the selected item) plus two soft glows for the wallpaper behind the window.
// Everything else (the dark grays, text, borders) stays the same, like macOS dark mode with a different accent color.
'use strict';

window.THEMES = [
  { id: 'fulton', name: 'Fulton Blue', colors: { accent: '#0a84ff', wall1: '#1a4a8a', wall2: '#0e3566', base: '#0a1222' } },
  { id: 'gold', name: 'Alliance Gold', colors: { accent: '#e8b54a', wall1: '#1d3f78', wall2: '#0b1e3f', base: '#070d1c' } },
  { id: 'arctic', name: 'Frost', colors: { accent: '#64d2ff', wall1: '#1c5e7e', wall2: '#0b2f45', base: '#06141d' } },
  { id: 'cartridge', name: 'Classic Red', colors: { accent: '#ff453a', wall1: '#7a1a1a', wall2: '#3a0d14', base: '#12060a' } },
  { id: 'midnight', name: 'Midnight', colors: { accent: '#5e8bff', wall1: '#1d2f78', wall2: '#0e1440', base: '#070a1c' } },
  { id: 'synthwave', name: 'Synthwave', colors: { accent: '#bf5af2', wall1: '#5b1f8a', wall2: '#2a0e4f', base: '#0d0618' } },
  { id: 'toxic', name: 'Toxic Green', colors: { accent: '#30d158', wall1: '#13602b', wall2: '#0a3317', base: '#05100a' } },
  { id: 'sunset', name: 'Sunset', colors: { accent: '#ff9f0a', wall1: '#7a3a12', wall2: '#3a1a12', base: '#120907' } },
  { id: 'gameboy', name: 'Pocket Green', colors: { accent: '#9bbc0f', wall1: '#2f4a1f', wall2: '#1a2e14', base: '#0a1208' } },
  { id: 'steel', name: 'Graphite', colors: { accent: '#9aa5b8', wall1: '#343a46', wall2: '#1b1f27', base: '#0b0d11' } },
];

// The colors you can change in Custom, with plain names
window.THEME_KEYS = [
  ['accent', 'Accent', 'Buttons, links, the selected item and highlights'],
  ['wall1', 'Background glow', 'The soft color behind the window, top left'],
  ['wall2', 'Second glow', 'The soft color behind the window, bottom right'],
];

// Settings saved by earlier versions used other color names; map them so nobody's theme changes by surprise.
const OLD_KEYS = { hot: 'accent', glow2: 'wall1', glow3: 'wall2', skyMid: 'base' };

/** The colors to use: a preset, or your custom colors on top of the preset they started from. */
window.themeColors = function themeColors(theme) {
  const t = theme || {};
  const find = (id) => window.THEMES.find((x) => x.id === id);
  const base = (find(t.preset === 'custom' ? t.base : t.preset) || window.THEMES[0]).colors;
  if (t.preset !== 'custom') return { ...base };
  const c = { ...base };
  for (const [k, v] of Object.entries(t.custom || {})) {
    if (!/^#[0-9a-f]{6}$/i.test(String(v || ''))) continue;
    if (c[k] !== undefined) c[k] = v;
    else if (OLD_KEYS[k]) c[OLD_KEYS[k]] = v;
  }
  return c;
};

/** White or near-black text for something filled with this color (a pale accent needs dark text). */
window.inkFor = function inkFor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.42 ? '#10131a' : '#ffffff';
};

window.applyTheme = function applyTheme(theme) {
  const c = window.themeColors(theme);
  const r = document.documentElement.style;
  r.setProperty('--accent', c.accent);
  r.setProperty('--on-accent', window.inkFor(c.accent));
  r.setProperty('--wall1', c.wall1);
  r.setProperty('--wall2', c.wall2);
  r.setProperty('--wall-base', c.base || '#0a1222');
  // the older style rules still read these names: they all follow the accent now
  for (const k of ['--magenta', '--hot', '--gold', '--cyan', '--orange']) r.setProperty(k, c.accent);
};
