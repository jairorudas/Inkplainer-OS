#!/usr/bin/env python3
"""Generates the Inkplainer arrow pack.

Output (relative to the repo root):
  assets/arrows/<style>/<style>-<shape>.svg   ready-to-upload SVGs (default colors)
  assets/arrows/arrows-data.js                templates with %C% / %INK% placeholders,
                                              used by assets/arrows/index.html to recolor

Run:  python3 tools/build-arrows.py
Each SVG has an explicit width/height, so it also works as an image layer in
Inkplainer (the app rasterizes images, which is why colors are baked in rather
than using currentColor).
"""
import json, math, os, random

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'arrows')
S = 200  # viewBox size
N = 64   # samples per centerline


# ---------- centerlines: functions t(0..1) -> (x, y), travelling to the right ----------
def lerp(a, b, t): return a + (b - a) * t

def _bez(p0, p1, p2, p3):
    def f(t):
        u = 1 - t
        return (u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
                u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1])
    return f

PATHS = {
    'straight': lambda t: (lerp(20, 172, t), 100),
    'curve':    _bez((20, 150), (60, 40), (120, 30), (172, 80)),
    's-curve':  _bez((20, 150), (90, 150), (110, 50), (172, 50)),
    'u-turn':   _bez((30, 40), (200, 10), (200, 190), (40, 160)),
    'wavy':     lambda t: (lerp(20, 172, t), 100 + 24 * math.sin(t * math.pi * 4)),
    'circle':   lambda t: (100 + 66 * math.cos(math.radians(200 + 280 * t)),
                           100 + 66 * math.sin(math.radians(200 + 280 * t))),
    'down-up':  _bez((20, 60), (80, 190), (120, 190), (172, 60)),
}

def loop(t):
    # prolate cycloid: travels right and ties a loop in the middle
    th = t * math.pi * 2
    return (22 + 148 * t + 30 * math.sin(th), 138 - 36 * (1 - math.cos(th)))
PATHS['loop'] = loop

def elbow(t):
    pts = [(24, 150), (24, 52), (172, 52)]
    segs = [math.dist(pts[0], pts[1]), math.dist(pts[1], pts[2])]
    d = t * sum(segs)
    if d <= segs[0]:
        k = d / segs[0]; return (lerp(24, 24, k), lerp(150, 52, k))
    k = (d - segs[0]) / segs[1]; return (lerp(24, 172, k), 52)
PATHS['elbow'] = elbow

def zig(t):
    k = t * 4
    seg = int(min(k, 3.999)); f = k - seg
    ys = [100, 58, 142, 58, 100]
    return (lerp(22, 172, t), lerp(ys[seg], ys[seg + 1], f))
PATHS['zigzag'] = zig

DOUBLE = {'double'}
PATHS['double'] = PATHS['straight']

SHAPES = list(PATHS.keys())


# ---------- hand wobble ----------
def wobble(pts, seed, amp):
    r = random.Random(seed)
    ph = [r.uniform(0, 6.28) for _ in range(3)]
    fr = [r.uniform(1.2, 2.2), r.uniform(2.8, 4.2), r.uniform(5, 7)]
    out = []
    for i, (x, y) in enumerate(pts):
        t = i / (len(pts) - 1)
        # tiny perpendicular-ish jitter, fading at the ends so the arrow keeps its tip
        j = amp * (math.sin(fr[0]*t*6.28 + ph[0]) + .5*math.sin(fr[1]*t*6.28 + ph[1]) + .25*math.sin(fr[2]*t*6.28 + ph[2]))
        j2 = amp * (math.cos(fr[1]*t*6.28 + ph[2]) + .5*math.sin(fr[2]*t*6.28 + ph[0]))
        out.append((x + j * .6, y + j2 * .6))
    return out

def sample(shape, seed=None, amp=0.0):
    f = PATHS[shape]
    pts = [f(i / (N - 1)) for i in range(N)]
    if amp and seed is not None:
        pts = wobble(pts, seed, amp)
    return pts

def f1(v): return ('%.1f' % v).rstrip('0').rstrip('.')
def path_d(pts):
    return 'M' + ' L'.join(f'{f1(x)} {f1(y)}' for x, y in pts)

def end_dir(pts, end=True):
    if end:
        (x0, y0), (x1, y1) = pts[-4], pts[-1]
    else:
        (x0, y0), (x1, y1) = pts[3], pts[0]
    return math.atan2(y1 - y0, x1 - x0)

def trim(pts, tip_len, end=True):
    """drop samples that sit under a filled head"""
    tip = pts[-1] if end else pts[0]
    keep = [p for p in (pts if end else pts[::-1]) if math.dist(p, tip) > tip_len]
    return keep if end else keep[::-1]

def head_pts(tip, ang, size, spread=28):
    a1, a2 = ang + math.pi - math.radians(spread), ang + math.pi + math.radians(spread)
    return (tip[0] + size * math.cos(a1), tip[1] + size * math.sin(a1)), tip, \
           (tip[0] + size * math.cos(a2), tip[1] + size * math.sin(a2))

def tri_pts(tip, ang, size, spread=32):
    l, t, r = head_pts(tip, ang, size, spread)
    return [l, t, r]

def poly(pts): return ' '.join(f'{f1(x)},{f1(y)}' for x, y in pts)

def ends(shape, pts):
    out = [(pts[-1], end_dir(pts, True))]
    if shape in DOUBLE:
        out.append((pts[0], end_dir(pts, False)))
    return out


# ---------- styles ----------
def marker(shape, seed):
    pts = sample(shape, seed, 2.2)
    w = 9
    g = [f'<path d="{path_d(pts)}" fill="none" stroke="%C%" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>']
    for k, (tip, ang) in enumerate(ends(shape, pts)):
        l, t, r = head_pts(tip, ang + (0.05 if k == 0 else -0.04), 34, 30)
        g.append(f'<path d="M{f1(l[0])} {f1(l[1])} L{f1(t[0])} {f1(t[1])} L{f1(r[0])} {f1(r[1])}" fill="none" stroke="%C%" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')
    return ''.join(g)

def sketch(shape, seed):
    g = []
    for k in range(2):
        pts = sample(shape, seed + k * 11, 3.2)
        sw = 4.2 if k == 0 else 3
        op = '' if k == 0 else ' opacity=".8"'
        g.append(f'<path d="{path_d(pts)}" fill="none" stroke="%C%" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"{op}/>')
        for j, (tip, ang) in enumerate(ends(shape, pts)):
            l, t, r = head_pts(tip, ang + (k - .5) * .12, 30 + k * 4, 30)
            g.append(f'<path d="M{f1(l[0])} {f1(l[1])} L{f1(t[0])} {f1(t[1])} L{f1(r[0])} {f1(r[1])}" fill="none" stroke="%C%" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"{op}/>')
    return ''.join(g)

def dashed(shape, seed):
    pts = sample(shape, seed, 1.2)
    g = [f'<path d="{path_d(pts)}" fill="none" stroke="%C%" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 15"/>']
    for tip, ang in ends(shape, pts):
        l, t, r = head_pts(tip, ang, 32, 30)
        g.append(f'<path d="M{f1(l[0])} {f1(l[1])} L{f1(t[0])} {f1(t[1])} L{f1(r[0])} {f1(r[1])}" fill="none" stroke="%C%" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>')
    return ''.join(g)

def dashes(shape, seed):
    pts = sample(shape, seed, 1.2)
    g = [f'<path d="{path_d(pts)}" fill="none" stroke="%C%" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="16 14"/>']
    for tip, ang in ends(shape, pts):
        l, t, r = head_pts(tip, ang, 32, 30)
        g.append(f'<path d="M{f1(l[0])} {f1(l[1])} L{f1(t[0])} {f1(t[1])} L{f1(r[0])} {f1(r[1])}" fill="none" stroke="%C%" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>')
    return ''.join(g)

def brush(shape, seed):
    """tapered ink stroke (thin tail -> thick) with a filled head"""
    pts = sample(shape, seed, 1.6)
    hl = 38
    body = trim(pts, hl * .55)
    if shape in DOUBLE:
        body = trim(body, hl * .55, end=False)
    n = len(body)
    left, right = [], []
    for i, (x, y) in enumerate(body):
        a = end_dir([body[max(0, i-1)]] * 3 + [body[min(n-1, i+1)]] * 2, True) if n > 1 else 0
        t = i / (n - 1)
        wdt = (lerp(1.5, 9, t) if shape not in DOUBLE else 3 + 6 * math.sin(t * math.pi) ** .6)
        nx, ny = -math.sin(a), math.cos(a)
        left.append((x + nx * wdt, y + ny * wdt)); right.append((x - nx * wdt, y - ny * wdt))
    g = [f'<polygon points="{poly(left + right[::-1])}" fill="%C%" stroke="%C%" stroke-width="2" stroke-linejoin="round"/>']
    for tip, ang in ends(shape, pts):
        g.append(f'<polygon points="{poly(tri_pts(tip, ang, hl, 30))}" fill="%C%" stroke="%C%" stroke-width="4" stroke-linejoin="round"/>')
    return ''.join(g)

def sticker(shape, seed):
    """fat cartoon arrow: shadow + white die-cut border + dark outline + color fill"""
    pts = sample(shape, None, 0)
    hl = 56
    body = trim(pts, hl * .5)
    if shape in DOUBLE:
        body = trim(body, hl * .5, end=False)
    hs = [(t, a) for t, a in ends(shape, pts)]
    def layer(extra, color, dy=0, op=None):
        o = f' opacity="{op}"' if op else ''
        tr = f' transform="translate(0 {dy})"' if dy else ''
        s = f'<g{tr}{o}>'
        s += f'<path d="{path_d(body)}" fill="none" stroke="{color}" stroke-width="{26 + extra}" stroke-linecap="round" stroke-linejoin="round"/>'
        for tip, ang in hs:
            s += f'<polygon points="{poly(tri_pts(tip, ang, hl, 36))}" fill="{color}" stroke="{color}" stroke-width="{extra}" stroke-linejoin="round"/>'
        return s + '</g>'
    return (layer(30, '#000', 5, '.22') + layer(30, '#fff') + layer(8, '%INK%') + layer(0, '%C%') +
            # glossy highlight along the body
            f'<path d="{path_d(body)}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" transform="translate(-2 -6)"/>')

STYLES = {
    'marker':  (marker,  'Marker – hand-drawn felt-tip line'),
    'sketch':  (sketch,  'Sketch – thin, double pencil pass'),
    'brush':   (brush,   'Brush – tapered ink stroke'),
    'dotted':  (dashed,  'Dotted – dot trail'),
    'dashed':  (dashes,  'Dashed – dash trail'),
    'sticker': (sticker, 'Sticker – fat arrow with white die-cut border'),
}


# ---------- geometric one-offs (no centerline) ----------
def block(c, kind):
    if kind == 'block':      return f'<polygon points="20,76 110,76 110,40 182,100 110,160 110,124 20,124" fill="{c}" stroke="{c}" stroke-width="6" stroke-linejoin="round"/>'
    if kind == 'outline':    return f'<polygon points="22,78 108,78 108,42 178,100 108,158 108,122 22,122" fill="none" stroke="{c}" stroke-width="9" stroke-linejoin="round"/>'
    if kind == 'chevron':    return f'<polygon points="22,40 104,40 178,100 104,160 22,160 96,100" fill="{c}" stroke="{c}" stroke-width="6" stroke-linejoin="round"/>'
    if kind == 'chevron-line': return f'<path d="M70 38 L132 100 L70 162" fill="none" stroke="{c}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>'
    if kind == 'double-chevron': return f'<path d="M36 44 L92 100 L36 156 M96 44 L152 100 L96 156" fill="none" stroke="{c}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>'
    if kind == 'triangle':   return f'<polygon points="40,36 176,100 40,164" fill="{c}" stroke="{c}" stroke-width="8" stroke-linejoin="round"/>'
    if kind == 'pill':       return f'<path d="M20 80 H116 V44 L180 100 L116 156 V120 H20 Z" fill="{c}" stroke="{c}" stroke-width="12" stroke-linejoin="round"/>'
    if kind == 'bar':        return f'<path d="M24 100 H168 M120 52 L168 100 L120 148" fill="none" stroke="{c}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>'
    if kind == 'bar-hand':   return f'<path d="M24 102 C70 96 120 104 168 98 M128 56 C146 74 158 88 170 98 C158 112 144 126 126 144" fill="none" stroke="{c}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>'
    if kind == 'circle':     return f'<circle cx="100" cy="100" r="74" fill="{c}"/><path d="M60 100 H138 M108 66 L142 100 L108 134" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>'
    if kind == 'circle-outline': return f'<circle cx="100" cy="100" r="72" fill="none" stroke="{c}" stroke-width="9"/><path d="M60 100 H138 M108 66 L142 100 L108 134" fill="none" stroke="{c}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>'
    return ''

def sticker_block(kind):
    shapes = {
        'block':   '<polygon points="20,76 110,76 110,40 182,100 110,160 110,124 20,124" ',
        'chevron': '<polygon points="22,40 104,40 178,100 104,160 22,160 96,100" ',
        'bubble':  '<path d="M26 100 C26 60 60 44 100 44 L112 44 L112 24 L184 100 L112 176 L112 156 L100 156 C60 156 26 140 26 100 Z" ',
    }
    s = shapes[kind]
    def lay(extra, col, dy=0, op=''):
        tr = f' transform="translate(0 {dy})"' if dy else ''
        o = f' opacity="{op}"' if op else ''
        return f'<g{tr}{o}>{s}fill="{col}" stroke="{col}" stroke-width="{extra}" stroke-linejoin="round"/></g>'
    return lay(26, '#000', 5, '.22') + lay(26, '#fff') + lay(8, '%INK%') + lay(0, '%C%')

GEOM = ['block', 'outline', 'chevron', 'chevron-line', 'double-chevron', 'triangle', 'pill', 'bar', 'bar-hand', 'circle', 'circle-outline']
STICKER_GEOM = ['block', 'chevron', 'bubble']


# ---------- output ----------
def darken(hexc, f=.55):
    h = hexc.lstrip('#')
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return '#%02x%02x%02x' % (int(r*f), int(g*f), int(b*f))

def wrap(inner, c, ink):
    inner = inner.replace('%C%', c).replace('%INK%', ink)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 {S} {S}">'
            f'{inner}</svg>\n')

DEFAULTS = {'marker': '#111111', 'sketch': '#111111', 'brush': '#111111', 'dotted': '#111111',
            'dashed': '#111111', 'sticker': '#ff5a4f', 'geometric': '#111111'}

def main():
    manifest = {}
    count = 0
    def emit(style, name, tpl, label):
        nonlocal count
        d = os.path.join(ROOT, style)
        os.makedirs(d, exist_ok=True)
        c = DEFAULTS[style]
        with open(os.path.join(d, f'{style}-{name}.svg'), 'w') as fh:
            fh.write(wrap(tpl, c, darken(c)))
        manifest.setdefault(style, {'label': label, 'default': c, 'items': {}})['items'][name] = tpl
        count += 1

    for si, (style, (fn, label)) in enumerate(STYLES.items()):
        for k, shape in enumerate(SHAPES):
            if style == 'sticker' and shape == 'loop':
                continue  # a fat stroke swallows the loop
            emit(style, shape, fn(shape, 100 * si + k + 3), label)
    for kind in GEOM:
        emit('geometric', kind, block('%C%', kind).replace('#fff', '#fff'), 'Geometric – clean solid & outline shapes')
    for kind in STICKER_GEOM:
        emit('sticker', f'{kind}-fat', sticker_block(kind), STYLES['sticker'][1])

    os.makedirs(ROOT, exist_ok=True)
    with open(os.path.join(ROOT, 'arrows-data.js'), 'w') as fh:
        fh.write('// generated by tools/build-arrows.py — do not edit\n')
        fh.write('window.ARROW_PACK = ' + json.dumps(manifest, separators=(',', ':')) + ';\n')
    print(f'wrote {count} arrows to {os.path.normpath(ROOT)}')

if __name__ == '__main__':
    main()
