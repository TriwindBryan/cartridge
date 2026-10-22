// The main color of a picture (a game's cover), for the soft "color wash" behind the selected game.
'use strict';

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The strongest color in a picture. pixels: RGBA or BGRA bytes (bgra = true for Electron's toBitmap()).
 * Grays, near-white and near-black are ignored (a white cover with a red logo gives red, not gray).
 * Returns a hex color tuned to glow nicely on a dark background, or null when the picture has no real color.
 */
function dominantColor(pixels, { bgra = false } = {}) {
  const bins = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let total = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const r = pixels[bgra ? i + 2 : i], g = pixels[i + 1], b = pixels[bgra ? i : i + 2], a = pixels[i + 3];
    if (a < 128) continue;
    total++;
    const [h, s, l] = rgbToHsl(r, g, b);
    if (s < 0.22 || l < 0.12 || l > 0.9) continue;
    const w = s * (1 - Math.abs(l - 0.5) * 1.4);
    const bin = bins[Math.floor(h / 30) % 12];
    bin.w += w; bin.r += r * w; bin.g += g * w; bin.b += b * w;
  }
  const best = bins.reduce((a, b) => (b.w > a.w ? b : a));
  // a few colored pixels in a gray picture aren't its color
  if (!total || best.w < total * 0.02) return null;
  const [h, s, l] = rgbToHsl(best.r / best.w, best.g / best.w, best.b / best.w);
  return hslToHex(h, Math.min(0.85, Math.max(0.5, s)), Math.min(0.55, Math.max(0.4, l)));
}

// shared with the window (renderer/index.html loads this file too)
if (typeof module !== 'undefined' && module.exports) module.exports = { dominantColor, rgbToHsl, hslToHex };
else window.cartColor = { dominantColor, rgbToHsl, hslToHex };
