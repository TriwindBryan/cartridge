# Builds Cartridge's square app icon (a rounded tile with the glowing cartridge on a 90s sunset).
# Needs the cartridge renders from render.py (icon-1024.png, icon-small-256.png) in the folder given.
# Run: python3 make_svg.py && python3 render.py . && python3 make_square.py . ../
#   writes ../icon.png (512, Windows/Linux/in-app), ../icon-mac.png (1024, macOS layout), ../icon.icns (macOS) and ../icon.ico
import sys, pathlib
from PIL import Image, ImageDraw, ImageFilter

here = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])
art = Image.open(here / 'icon-1024.png').convert('RGBA')
art_small = Image.open(here / 'icon-small-256.png').convert('RGBA')

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def gradient(w, h, stops):
    g = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
            if p0 <= t <= p1:
                g.putpixel((0, y), lerp(c0, c1, (t - p0) / (p1 - p0)))
                break
    return g.resize((w, h))

def tile(size, simple=False):
    """The square artwork at size x size (no rounding yet)."""
    S = size * 4 if size < 256 else size  # draw small sizes big, then shrink: smoother
    img = gradient(S, S, [(0, (16, 4, 28)), (0.55, (58, 8, 30)), (1, (200, 22, 29))]).convert('RGBA')
    d = ImageDraw.Draw(img)
    hz = int(S * 0.70)  # horizon
    if not simple:
        # sunset: a gold-to-red half sun with the classic stripes cut out
        r = int(S * 0.30)
        sun = gradient(2 * r, r, [(0, (255, 214, 72)), (0.6, (255, 123, 28)), (1, (226, 52, 43))]).convert('RGBA')
        mask = Image.new('L', (2 * r, r), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, 2 * r, 2 * r], fill=255)
        md = ImageDraw.Draw(mask)
        for i in range(5):
            y = int(r * (0.45 + i * 0.12))
            md.rectangle([0, y, 2 * r, y + max(2, int(r * (0.02 + i * 0.012)))], fill=0)
        img.paste(sun, (S // 2 - r, hz - r), mask)
        # neon grid floor
        floor = Image.new('RGBA', (S, S - hz), (90, 6, 20, 255))
        img.paste(floor, (0, hz))
        lw = max(2, S // 170)
        for i in range(1, 7):
            y = hz + int((S - hz) * (i / 6) ** 1.8)
            d.line([(0, y), (S, y)], fill=(255, 75, 110, 255), width=lw)
        for i in range(-6, 7):
            d.line([(S // 2 + i * S * 0.045, hz), (S // 2 + i * S * 0.30, S)], fill=(255, 75, 110, 255), width=lw)
        d.line([(0, hz), (S, hz)], fill=(255, 210, 63, 255), width=lw + 1)
    # the cartridge (with its yellow glow) on top
    a = art_small if simple else art
    bbox = a.getbbox()
    a = a.crop(bbox)
    scale = (0.86 if simple else 0.80) * S / max(a.size)
    a = a.resize((int(a.width * scale), int(a.height * scale)), Image.LANCZOS)
    img.alpha_composite(a, ((S - a.width) // 2, int(S * 0.47 - a.height / 2)))
    return img.resize((size, size), Image.LANCZOS) if S != size else img

def rounded(img, radius_ratio):
    S = img.width
    big = 4
    m = Image.new('L', (S * big, S * big), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, S * big - 1, S * big - 1], radius=int(S * big * radius_ratio), fill=255)
    m = m.resize((S, S), Image.LANCZOS)
    o = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    o.paste(img, (0, 0), m)
    return o

# Windows, Linux and inside the app: the tile fills the square, softly rounded
general = rounded(tile(1024), 0.18)
general.resize((512, 512), Image.LANCZOS).save(out / 'icon.png')

# macOS: Apple's layout is an 824 px rounded tile centred on a 1024 canvas, with a soft shadow
mac = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
t = rounded(tile(824), 0.225)
shadow = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
sm = Image.new('L', (1024, 1024), 0)
ImageDraw.Draw(sm).rounded_rectangle([100, 112, 924, 936], radius=int(824 * 0.225), fill=110)
shadow.putalpha(sm.filter(ImageFilter.GaussianBlur(14)))
mac.alpha_composite(shadow)
mac.alpha_composite(t, (100, 100))
mac.save(out / 'icon-mac.png')

# macOS .icns, written by hand so every size is drawn on its own (letting the build tool shrink one big PNG
# scrambled the small Finder icons). Each entry is a PNG in Apple's layout: the tile with its margin and shadow.
import io, struct
def mac_icon(px):
    if px >= 128:
        return mac.resize((px, px), Image.LANCZOS)
    # small sizes: a slightly bigger tile (less margin) with the simpler cartridge, so it stays readable
    c = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    inner = max(1, round(px * 0.88))
    t = rounded(tile(inner, simple=px <= 32), 0.225)
    c.alpha_composite(t, ((px - inner) // 2, (px - inner) // 2))
    return c
def png_bytes(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()
ICNS = [('icp4', 16), ('icp5', 32), ('icp6', 64), ('ic07', 128), ('ic08', 256), ('ic09', 512), ('ic10', 1024),
        ('ic11', 32), ('ic12', 64), ('ic13', 256), ('ic14', 512)]
body = b''
for tag, px in ICNS:
    data = png_bytes(mac_icon(px))
    body += tag.encode('ascii') + struct.pack('>I', len(data) + 8) + data
(out / 'icon.icns').write_bytes(b'icns' + struct.pack('>I', len(body) + 8) + body)

# Windows .ico: detailed art for big sizes, the simpler cartridge for tiny ones
sizes = [16, 24, 32, 48, 64, 128, 256]
frames = [rounded(tile(s, simple=s <= 32), 0.18) for s in sizes]
frames[-1].save(out / 'icon.ico', sizes=[(s, s) for s in sizes], append_images=frames[:-1])
print('icons written to', out)
