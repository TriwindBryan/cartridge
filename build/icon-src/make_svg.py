# Generates the Cartridge icon SVGs. Run: python3 make_svg.py && python3 render.py . && python3 make_square.py . ..
def svg(L, R, T, B, glow=26, tight=9, small=False, view='0 0 512 512'):
    cx = (L + R) / 2; W = R - L
    cl, cr = L + W * 0.13, R - W * 0.13          # connector
    cb = B + 48                                   # connector bottom
    lx, lw = L + W * 0.10, W * 0.80               # label recess
    ly, lh = T + 128, B - T - 156
    ix, iy, iw, ih = lx + 10, ly + 12, lw - 20, lh - 24   # label art
    sun_r = iw * 0.27; sun_y = iy + ih * 0.62; hz = iy + ih * 0.68
    ridges = ''.join(f'<line x1="{L+40}" y1="{T+34+i*24}" x2="{R-40}" y2="{T+34+i*24}"/>' for i in range(3))
    hi = ''.join(f'<line x1="{L+40}" y1="{T+28+i*24}" x2="{R-40}" y2="{T+28+i*24}"/>' for i in range(3))
    pins = ''.join(f'<rect x="{cl+10+i*((cr-cl-20)/9)}" y="{B+12}" width="{(cr-cl-20)/9-6:.1f}" height="26" rx="2"/>' for i in range(9))
    grid = '' if small else (
        f'<g stroke="#ff4b6e" stroke-width="2.5" opacity=".9">'
        + ''.join(f'<line x1="{ix}" y1="{hz+d}" x2="{ix+iw}" y2="{hz+d}"/>' for d in (9, 22, 42))
        + ''.join(f'<line x1="{cx+o}" y1="{hz}" x2="{cx+o*3.2}" y2="{iy+ih}"/>' for o in (-75, -40, 0, 40, 75)) + '</g>'
        + f'<circle cx="{ix+34}" cy="{iy+28}" r="3" fill="#fff"/><circle cx="{ix+iw-36}" cy="{iy+40}" r="2.4" fill="#fff"/><circle cx="{cx+38}" cy="{iy+18}" r="2" fill="#fff"/>')
    stripes = ''.join(f'<rect x="{cx-sun_r}" y="{sun_y-sun_r*0.42+i*sun_r*0.17}" width="{2*sun_r}" height="{4+i*1.6}"/>' for i in range(3))
    shell = (f'M{L} {T+20} Q{L} {T} {L+20} {T} H{R-20} Q{R} {T} {R} {T+20} V{B-14} Q{R} {B} {R-14} {B} H{cr} V{cb-14} '
             f'Q{cr} {cb} {cr-14} {cb} H{cl+14} Q{cl} {cb} {cl} {cb-14} V{B} H{L+14} Q{L} {B} {L} {B-14} Z')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" width="512" height="512">
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5a44"/><stop offset=".45" stop-color="#d8211f"/><stop offset="1" stop-color="#7c0b10"/></linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb08a"/><stop offset="1" stop-color="#5a060a"/></linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14071f"/><stop offset=".55" stop-color="#4a0c2a"/><stop offset="1" stop-color="#c8161d"/></linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a0"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff7b1c"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6b0"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#c47a00"/></linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{glow}"/></filter>
    <filter id="glowTight" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="{tight}"/></filter>
    <clipPath id="lab"><rect x="{ix}" y="{iy}" width="{iw}" height="{ih}" rx="12"/></clipPath>
    <path id="shell" d="{shell}"/>
  </defs>
  <use href="#shell" fill="#ffc400" filter="url(#glow)"/>
  <use href="#shell" fill="#ffd23f" opacity=".8" filter="url(#glow)"/>
  <use href="#shell" fill="none" stroke="#fff08a" stroke-width="{22 if not small else 26}" filter="url(#glowTight)"/>
  <use href="#shell" fill="url(#body)" stroke="url(#edge)" stroke-width="6"/>
  {'' if small else f'<g stroke="#ff8a6a" stroke-width="3" stroke-linecap="round" opacity=".6">{hi}</g>'}
  <g stroke="#5a060a" stroke-width="{8 if not small else 11}" stroke-linecap="round" opacity=".55">{ridges}</g>
  <rect x="{lx}" y="{ly}" width="{lw}" height="{lh}" rx="20" fill="#4a0508" opacity=".75"/>
  <g clip-path="url(#lab)">
    <rect x="{ix}" y="{iy}" width="{iw}" height="{ih}" fill="url(#sky)"/>
    <circle cx="{cx}" cy="{sun_y}" r="{sun_r}" fill="url(#sun)"/>
    <g fill="#4a0c2a">{stripes}</g>
    <rect x="{ix}" y="{hz}" width="{iw}" height="{iy+ih-hz}" fill="#2a0612"/>
    {grid}
  </g>
  <rect x="{ix}" y="{iy}" width="{iw}" height="{ih}" rx="12" fill="none" stroke="#ffd23f" stroke-width="{4 if not small else 7}"/>
  <rect x="{cl+4}" y="{B+8}" width="{cr-cl-8}" height="34" rx="5" fill="#3a0306"/>
  <g fill="url(#gold)">{pins}</g>
  <path d="M{L+10} {T+16} Q{L+10} {T+10} {L+18} {T+10} H{L+W*0.62} L{L+W*0.1} {ly+40} H{L+10} Z" fill="url(#gloss)"/>
</svg>'''
# full icon: cartridge 330 wide inside a square, room for the glow
open('cartridge-icon.svg', 'w').write(svg(91, 421, 44, 418))
# 16-48 px: fill more of the square, fewer details
open('cartridge-icon-small.svg', 'w').write(svg(91, 421, 44, 418, glow=18, tight=8, small=True, view='56 14 400 484'))
