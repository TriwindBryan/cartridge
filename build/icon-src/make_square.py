# Builds Fulton's square app icon (a rounded blue tile with a balloon lifting a cartridge).
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
    """The square artwork at size x size (no rounding yet): the balloon render, shrunk."""
    return (art_small if simple else art).resize((size, size), Image.LANCZOS)

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
def icns_rle(chan):
    # Apple's icon run-length packing: 0..127 = copy n+1 bytes, 128..255 = repeat the next byte n-125 times
    out = bytearray(); i = 0; n = len(chan)
    while i < n:
        run = 1
        while i + run < n and run < 130 and chan[i + run] == chan[i]: run += 1
        if run >= 3:
            out += bytes([run + 125, chan[i]]); i += run; continue
        j = i; lit = bytearray()
        while j < n and len(lit) < 128:
            if j + 2 < n and chan[j] == chan[j + 1] == chan[j + 2]: break
            lit.append(chan[j]); j += 1
        out += bytes([len(lit) - 1]) + lit; i = j
    return bytes(out)
def argb_bytes(im):
    # the 16 and 32 px sizes as raw ARGB, like Apple's own iconutil writes them: Finder's list view, the sidebar and
    # small Dock sizes draw these, and some macOS versions garble PNGs stored at these two sizes
    im = im.convert('RGBA')
    r, g, b, a = [bytes(c.getdata()) for c in im.split()]
    return b'ARGB' + b''.join(icns_rle(c) for c in (a, r, g, b))
ICNS = [('ic04', 16, 'argb'), ('ic05', 32, 'argb'), ('icp6', 64, 'png'), ('ic07', 128, 'png'), ('ic08', 256, 'png'), ('ic09', 512, 'png'), ('ic10', 1024, 'png'),
        ('ic11', 32, 'png'), ('ic12', 64, 'png'), ('ic13', 256, 'png'), ('ic14', 512, 'png')]
body = b''
for tag, px, kind in ICNS:
    data = argb_bytes(mac_icon(px)) if kind == 'argb' else png_bytes(mac_icon(px))
    body += tag.encode('ascii') + struct.pack('>I', len(data) + 8) + data
(out / 'icon.icns').write_bytes(b'icns' + struct.pack('>I', len(body) + 8) + body)

# Windows .ico: detailed art for big sizes, the simpler cartridge for tiny ones
sizes = [16, 24, 32, 48, 64, 128, 256]
frames = [rounded(tile(s, simple=s <= 32), 0.18) for s in sizes]
frames[-1].save(out / 'icon.ico', sizes=[(s, s) for s in sizes], append_images=frames[:-1])
print('icons written to', out)
