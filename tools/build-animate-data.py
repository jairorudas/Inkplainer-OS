#!/usr/bin/env python3
"""Turn animate.css (4.1.1, MIT, (c) 2020 Daniel Eden) into animate-css-data.js.

The canvas cannot run CSS animations, so each @keyframes block is converted into plain data that
index.html interpolates itself:  the transform list per keyframe, opacity per keyframe, the easing
between keyframes, the transform-origin and the default duration from the class rule.

Usage:  python3 tools/build-animate-data.py path/to/animate.css > animate-css-data.js
"""
import json, re, sys

css = open(sys.argv[1], encoding='utf-8').read()
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)

def block_end(s, start):
    depth = 0
    for i in range(start, len(s)):
        if s[i] == '{': depth += 1
        elif s[i] == '}':
            depth -= 1
            if depth == 0: return i
    raise ValueError('unbalanced braces')

# ── keyframes (only the unprefixed ones) ──
kf = {}
for m in re.finditer(r'(?<!-webkit-)@keyframes\s+([\w]+)\s*\{', css):
    name = m.group(1); open_i = m.end() - 1; close_i = block_end(css, open_i)
    body = css[open_i + 1:close_i]
    frames = []
    for fm in re.finditer(r'([^{}]+)\{([^{}]*)\}', body):
        sels, decls = fm.group(1), fm.group(2)
        d = {}
        for dm in re.finditer(r'(?<!-)(?<![\w-])([a-z-]+)\s*:\s*([^;]+);?', decls):
            if dm.group(1).startswith('-webkit-'): continue
            d[dm.group(1)] = dm.group(2).strip()
        for sel in sels.split(','):
            sel = sel.strip()
            t = 0 if sel == 'from' else 100 if sel == 'to' else float(sel.rstrip('%'))
            frames.append((t, d))
    kf[name] = sorted(frames, key=lambda x: x[0])

# ── class rules: origin + duration factor ──
cls = {}
for m in re.finditer(r'\.animate__(\w+)\s*\{([^{}]*)\}', css):
    name, decls = m.group(1), m.group(2)
    if name not in kf: continue
    c = cls.setdefault(name, {})
    om = re.search(r'(?<!-webkit-)transform-origin:\s*([^;]+);', decls)
    if om and 'origin' not in c: c['origin'] = om.group(1).strip()
    dm = re.search(r'(?<!-webkit-)animation-duration:\s*calc\(var\(--animate-duration\)\s*\*\s*([\d.]+)\)', decls)
    if dm: c['dur'] = float(dm.group(1))

ORIGIN = {'left': 0, 'center': .5, 'right': 1, 'top': 0, 'bottom': 1}
def origin(s):
    parts = (s or 'center').split()
    if len(parts) == 1: parts = parts * 2 if parts[0] == 'center' else ([parts[0], 'center'] if parts[0] in ('left', 'right') else ['center', parts[0]])
    a, b = parts[0], parts[1]
    if a in ('top', 'bottom'): a, b = b, a          # "top center" -> x center, y top
    return [ORIGIN.get(a, .5), ORIGIN.get(b, .5)]

def num(v): return float(v)
def lenval(tok):
    m = re.fullmatch(r'(-?[\d.]+)(px|%|deg)?', tok.strip())
    if not m: raise ValueError('length ' + tok)
    return float(m.group(1)), (1 if m.group(2) == '%' else 0)

def parse_transform(val):
    ops = []
    for fm in re.finditer(r'(\w+)\(([^)]*)\)', val):
        fn, args = fm.group(1), [a.strip() for a in fm.group(2).split(',')]
        if fn == 'translate3d':
            (x, xu), (y, yu), (z, _) = lenval(args[0]), lenval(args[1]), lenval(args[2])
            ops.append(['T', x, xu, y, yu, z])
        elif fn == 'translateX': x, xu = lenval(args[0]); ops.append(['T', x, xu, 0, 0, 0])
        elif fn == 'translateY': y, yu = lenval(args[0]); ops.append(['T', 0, 0, y, yu, 0])
        elif fn == 'scale3d': ops.append(['S', num(args[0]), num(args[1])])
        elif fn == 'scale': ops.append(['S', num(args[0]), num(args[1]) if len(args) > 1 else num(args[0])])
        elif fn == 'scaleX': ops.append(['S', num(args[0]), 1.0])
        elif fn == 'scaleY': ops.append(['S', 1.0, num(args[0])])
        elif fn == 'rotate': ops.append(['R', lenval(args[0])[0]])
        elif fn == 'rotate3d':
            x, y, z = num(args[0]), num(args[1]), num(args[2]); deg = lenval(args[3])[0]
            ops.append(['R' if z else 'RY' if y else 'RX', deg * (z if z else y if y else x)])
        elif fn == 'rotateY': ops.append(['RY', lenval(args[0])[0]])
        elif fn == 'rotateX': ops.append(['RX', lenval(args[0])[0]])
        elif fn == 'skewX': ops.append(['KX', lenval(args[0])[0]])
        elif fn == 'skewY': ops.append(['KY', lenval(args[0])[0]])
        elif fn == 'perspective': ops.append(['P', lenval(args[0])[0]])
        else: raise ValueError('transform function ' + fn)
    return ops

def ease(v):
    if v is None: return None
    m = re.fullmatch(r'cubic-bezier\(([^)]*)\)', v)
    if m: return [float(x) for x in m.group(1).split(',')]
    return {'linear': [0, 0, 1, 1], 'ease': [.25, .1, .25, 1], 'ease-in': [.42, 0, 1, 1], 'ease-out': [0, 0, .58, 1], 'ease-in-out': [.42, 0, .58, 1]}[v]

ATTN = ['bounce', 'flash', 'pulse', 'rubberBand', 'shakeX', 'shakeY', 'headShake', 'swing', 'tada', 'wobble', 'jello', 'heartBeat']
def category(n):
    if n in ATTN: return 'Attention seekers'
    if n == 'flip' or n.startswith('flip'): return 'Flippers'
    if n.startswith('back'): return 'Back'
    if n.startswith('bounce'): return 'Bouncing'
    if n.startswith('fade'): return 'Fading'
    if n.startswith('lightSpeed'): return 'Light speed'
    if n.startswith('rotate'): return 'Rotating'
    if n.startswith('zoom'): return 'Zooming'
    if n.startswith('slide'): return 'Sliding'
    return 'Specials'                                # hinge, jackInTheBox, rollIn, rollOut
def role(n):
    if re.search(r'Out', n) or n == 'hinge': return 'out'      # ends with the image gone
    if re.search(r'In([A-Z]|$)', n): return 'in'
    return 'attn'

out = {}
for name, frames in kf.items():
    tr, op = [], []
    for t, d in frames:
        e = ease(d.get('animation-timing-function'))
        if 'transform' in d: tr.append({'t': t / 100, 'e': e, 'o': parse_transform(d['transform'])})
        if 'opacity' in d: op.append({'t': t / 100, 'e': e, 'v': float(d['opacity'])})
    c = cls.get(name, {})
    out[name] = {'c': category(name), 'r': role(name), 'd': c.get('dur', 1.0), 'org': origin(c.get('origin')), 'tr': tr, 'op': op}

def compact(o):
    return json.dumps(o, separators=(',', ':'))

sys.stdout.write('''// Generated by tools/build-animate-data.py from animate.css 4.1.1 -- do not edit by hand.
// animate.css: MIT License, Copyright (c) 2020 Daniel Eden, https://animate.style/
// Each entry: c=category, r=role (attn|in|out), d=default duration factor (x1 s), org=transform-origin [x,y],
// tr=transform keyframes [{t,e:cubic-bezier|null,o:[ops]}], op=opacity keyframes [{t,e,v}].
// ops: T x xUnit(0=px,1=%) y yUnit z | S sx sy | R deg | RX deg | RY deg | KX deg | KY deg | P px
window.ANIMATE_CSS = ''' + compact(out) + ';\n')
sys.stderr.write('%d animations\n' % len(out))
