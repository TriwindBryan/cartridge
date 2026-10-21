// Color themes for Settings → Appearance. Each sets the few base colors; everything else (darker shades, the sky,
// glows and the grid floor) is mixed from them in styles.css.
'use strict';

window.THEMES = [
  { id: 'cartridge', name: 'Cartridge Red', colors: { magenta: '#c8161d', hot: '#e2342b', gold: '#ffd23f', orange: '#ff7b1c', cyan: '#19e3ff', glow1: '#ff8a3d', glow2: '#d9241c', glow3: '#6e0d14', skyTop: '#04030c', skyMid: '#0f0a22' } },
  { id: 'midnight', name: 'Midnight Blue', colors: { magenta: '#1d48c4', hot: '#3b7bff', gold: '#ffd23f', orange: '#ff9f2e', cyan: '#4fe3ff', glow1: '#5aa0ff', glow2: '#2a5bd8', glow3: '#0e1f5c', skyTop: '#02030c', skyMid: '#070d26' } },
  { id: 'synthwave', name: 'Synthwave', colors: { magenta: '#7b2cd6', hot: '#a64bff', gold: '#ffd23f', orange: '#ff7b1c', cyan: '#19e3ff', glow1: '#ff7b1c', glow2: '#b5179e', glow3: '#3c0a5c', skyTop: '#05020f', skyMid: '#140a2e' } },
  { id: 'toxic', name: 'Toxic Green', colors: { magenta: '#178c3a', hot: '#2fd158', gold: '#e8ff3f', orange: '#b8e02a', cyan: '#7dffb0', glow1: '#b8e02a', glow2: '#22a447', glow3: '#0b3d1c', skyTop: '#020803', skyMid: '#071a0d' } },
  { id: 'sunset', name: 'Sunset Orange', colors: { magenta: '#c95412', hot: '#ff7a2e', gold: '#ffe45c', orange: '#ffb02e', cyan: '#3fd8ff', glow1: '#ffd25c', glow2: '#f26a1b', glow3: '#6e2a0d', skyTop: '#06030a', skyMid: '#1c0d1c' } },
  { id: 'arctic', name: 'Arctic', colors: { magenta: '#1f7fb0', hot: '#43b8e8', gold: '#f2fbff', orange: '#9fe4ff', cyan: '#b3f0ff', glow1: '#bff1ff', glow2: '#3aa7d6', glow3: '#0d3a52', skyTop: '#020509', skyMid: '#081624' } },
  { id: 'gameboy', name: 'Pocket Green', colors: { magenta: '#306230', hot: '#5f8f1f', gold: '#c4d93a', orange: '#9bbc0f', cyan: '#9bbc0f', glow1: '#9bbc0f', glow2: '#5f8f1f', glow3: '#1f3a1f', skyTop: '#0b140b', skyMid: '#132313' } },
  { id: 'steel', name: 'Steel', colors: { magenta: '#4d5566', hot: '#7d8aa3', gold: '#f2f2f2', orange: '#c9ced8', cyan: '#9ecbff', glow1: '#aeb8c9', glow2: '#5c677d', glow3: '#20242d', skyTop: '#040507', skyMid: '#0d1016' } },
];

// The colors you can change in Custom, with plain names
window.THEME_KEYS = [
  ['magenta', 'Main color', 'Panels, borders, the logo shadow'],
  ['hot', 'Accent', 'Selected chips, buttons and glows'],
  ['gold', 'Highlight', 'The selected tab, big buttons, scores'],
  ['cyan', 'Links & grid', 'Links, the search box and the grid floor'],
  ['glow1', 'Horizon glow', 'The sunset at the bottom of the sky'],
  ['skyMid', 'Sky', 'The night sky behind everything'],
];

/** The colors to use: a preset, or your custom colors on top of the preset they started from. */
window.themeColors = function themeColors(theme) {
  const t = theme || {};
  const base = (window.THEMES.find((x) => x.id === (t.preset === 'custom' ? t.base : t.preset)) || window.THEMES[0]).colors;
  if (t.preset !== 'custom') return { ...base };
  const c = { ...base, ...(t.custom || {}) };
  // the in-between sky and glow shades follow the custom colors
  if (t.custom && t.custom.hot) c.glow2 = t.custom.hot;
  if (t.custom && t.custom.magenta) c.glow3 = `color-mix(in srgb, ${t.custom.magenta} 55%, #000)`;
  if (t.custom && t.custom.skyMid) c.skyTop = `color-mix(in srgb, ${t.custom.skyMid} 35%, #000)`;
  return c;
};

window.applyTheme = function applyTheme(theme) {
  const c = window.themeColors(theme);
  const r = document.documentElement.style;
  const map = { magenta: '--magenta', hot: '--hot', gold: '--gold', orange: '--orange', cyan: '--cyan', glow1: '--glow1', glow2: '--glow2', glow3: '--glow3', skyTop: '--sky-top', skyMid: '--sky-mid' };
  for (const [k, v] of Object.entries(map)) if (c[k]) r.setProperty(v, c[k]);
};
