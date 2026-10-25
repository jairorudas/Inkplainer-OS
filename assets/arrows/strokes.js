// Highlighter + underline / line generator for the Arrows picker.
// strokeSVG(kind, variant, { color, width, pen, size }) -> SVG string (400x100 viewBox, transparent background)
//   kind: 'highlight' | 'underline'
(function () {
  const f = v => +v.toFixed(1);
  let uid = 0;

  function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function wob(pts, seed, amp) {
    const r = rng(seed), p = [r() * 6.28, r() * 6.28, r() * 6.28];
    return pts.map(([x, y], i) => {
      const t = i / (pts.length - 1);
      return [x + amp * .4 * Math.sin(t * 9 + p[0]), y + amp * (Math.sin(t * 7 + p[1]) + .5 * Math.sin(t * 17 + p[2]))];
    });
  }
  const D = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join(' L');
  const sample = (fn, n = 140) => Array.from({ length: n }, (_, i) => fn(i / (n - 1)));
  const X0 = 24, X1 = 376, SPAN = X1 - X0;

  // ---- pens: SVG filters give the pencil / chalk / crayon grain and the dry-brush edge ----
  function rough(id, scale, freq, seed) {
    return `<filter id="${id}" filterUnits="userSpaceOnUse" x="-100" y="-100" width="700" height="700"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}"/></filter>`;
  }
  function grain(id, scale, dfreq, gfreq, a, b, seed) {
    return `<filter id="${id}" filterUnits="userSpaceOnUse" x="-100" y="-100" width="700" height="700"><feTurbulence type="fractalNoise" baseFrequency="${dfreq}" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" result="d"/><feTurbulence type="fractalNoise" baseFrequency="${gfreq}" numOctaves="2" seed="${seed + 3}" result="g0"/><feColorMatrix in="g0" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${a} 0 0 0 ${b}" result="g"/><feComposite in="d" in2="g" operator="in"/></filter>`;
  }
  const PENS = {
    // wobble = hand tremor, mul = width multiplier, op = opacity, passes = overlapped strokes (pencil / crayon look sketchy)
    pen:    { label: 'Pen',            wobble: .3,  mul: 1,    op: 1,   passes: 1 },
    felt:   { label: 'Felt-tip',       wobble: 1,   mul: 1.15, op: .9,  passes: 1 },
    pencil: { label: 'Pencil',         wobble: 1.2, mul: .75,  op: .95, passes: 2, filter: id => grain(id, 2.5, .06, .9, 2.6, -.75, 7) },
    brush:  { label: 'Dry brush',      wobble: 1.5, mul: 1.3,  op: 1,   passes: 1, filter: id => rough(id, 5, .04, 3) },
    chalk:  { label: 'Chalk',          wobble: 1.2, mul: 1.2,  op: .95, passes: 1, filter: id => grain(id, 3, .08, .55, 3.4, -1.25, 11) },
    crayon: { label: 'Crayon',         wobble: 1.3, mul: 1.35, op: .9,  passes: 2, filter: id => grain(id, 4, .05, .3, 3, -.95, 5) },
    // highlighter tips
    chisel: { label: 'Chisel (flat)',  wobble: .6,  mul: 1,    op: .5,  passes: 1, chisel: true },
    round:  { label: 'Round tip',      wobble: .6,  mul: 1,    op: .5,  passes: 1 },
    hbrush: { label: 'Dry brush',      wobble: 1.4, mul: 1,    op: .55, passes: 1, filter: id => rough(id, 7, .035, 5) },
    hcrayon:{ label: 'Wax crayon',     wobble: 1.3, mul: 1,    op: .6,  passes: 2, filter: id => grain(id, 4, .05, .3, 3, -.95, 9) },
  };

  // ---- underline / line centerlines (x from 24 to 376, y = 50) ----
  const wavyAmp = w => Math.min(11, 6 + w * .25);
  const UNDERLINE = {
    solid:      { pts: () => sample(t => [X0 + SPAN * t, 50], 60) },
    dotted:     { pts: () => sample(t => [X0 + SPAN * t, 50], 60), dash: w => `0.01 ${f(w * 2.1 + 3)}`, cap: 'round' },
    dashed:     { pts: () => sample(t => [X0 + SPAN * t, 50], 60), dash: w => `${f(w * 3.5 + 8)} ${f(w * 2 + 8)}`, cap: 'round' },
    'dash-dot': { pts: () => sample(t => [X0 + SPAN * t, 50], 60), dash: w => `${f(w * 3.5 + 8)} ${f(w * 1.6 + 6)} 0.01 ${f(w * 1.6 + 6)}`, cap: 'round' },
    double:     { double: true, pts: () => sample(t => [X0 + SPAN * t, 50], 60) },
    wavy:       { pts: w => sample(t => [X0 + SPAN * t, 50 + wavyAmp(w) * Math.sin(t * Math.PI * 2 * 12)], 220) },
    zigzag:     { pts: w => sample(t => { const k = (t * 14) % 1, a = wavyAmp(w); return [X0 + SPAN * t, 50 + a * (Math.abs(k * 2 - 1) * 2 - 1)]; }, 400) },
    swoosh:     { pts: () => sample(t => [X0 + SPAN * t, 62 - 16 * t - 7 * Math.sin(t * Math.PI)], 80) },
    'swoosh-2': { double: true, pts: () => sample(t => [X0 + SPAN * t, 56 - 10 * t - 5 * Math.sin(t * Math.PI)], 80) },
    scribble:   { pts: w => { const R = Math.max(9, wavyAmp(w) + 1); return sample(t => { const th = t * Math.PI * 2 * 9; return [X0 + SPAN * t - R * Math.sin(th) * .9, 50 - R * Math.cos(th) * .9]; }, 400); } },
  };

  // ---- highlighter swipes (a band centred on y = 50) ----
  const HIGHLIGHT = {
    swipe:  { pts: () => sample(t => [X0 - 4 + (SPAN + 8) * t, 50], 60) },
    tilt:   { pts: () => sample(t => [X0 - 4 + (SPAN + 8) * t, 55 - 10 * t], 60) },
    wavy:   { pts: () => sample(t => [X0 - 4 + (SPAN + 8) * t, 50 + 4 * Math.sin(t * Math.PI * 4)], 120) },
    'two-pass': { pts: () => sample(t => [X0 - 4 + (SPAN + 8) * t, 50], 60), twoPass: true },
    scribble:   { pts: () => sample(t => { const k = (t * 22) % 1; return [X0 + SPAN * t, 50 + (Math.abs(k * 2 - 1) * 2 - 1) * .5 * 1]; }, 500), fill: true },
  };

  // ---- hand-drawn rings: oval (wide, to circle a word / line of text) and circle ----
  // turns > 1 makes the pen overshoot and cross its own start, like a real hand-drawn loop; drift makes the
  // second lap land slightly outside the first instead of retracing it; tilt/start/dir vary the gesture.
  const RINGS = {
    oval:         { oval: true, turns: 1.08, drift: .07,  tilt: -1.5, start: -110, dir: 1 },
    'oval-loop':  { oval: true, turns: 2.08, drift: .12,  tilt: 1.5,  start: -80,  dir: 1 },
    'oval-open':  { oval: true, turns: .9,   drift: .04,  tilt: -2,   start: -60,  dir: 1 },
    'oval-tilt':  { oval: true, turns: 1.12, drift: .09,  tilt: -4.5, start: -120, dir: -1 },
    'oval-tight': { oval: true, turns: 1.06, drift: .05,  tilt: 1,    start: -150, dir: -1, ry: .8 },
    circle:       { turns: 1.08, drift: .07, tilt: 0,  start: -120, dir: 1 },
    'circle-loop':{ turns: 2.1,  drift: .11, tilt: 0,  start: -70,  dir: 1 },
    'circle-open':{ turns: .9,   drift: .04, tilt: 0,  start: -50,  dir: -1 },
    'circle-egg': { turns: 1.1,  drift: .08, tilt: -20, start: -140, dir: 1, squash: .88 },
    'circle-doodle': { turns: 3.05, drift: .16, tilt: 0, start: -100, dir: 1 },
  };
  const dimsOf = (kind, variant) => kind === 'paper' ? (PAPER[variant] || PAPER.cut).dims : GEN[kind] ? (GEN[kind][variant] || Object.values(GEN[kind])[0]).dims : kind === 'circle' && !(RINGS[variant] || {}).oval ? [200, 200] : [400, 100];


  // ---- shape kinds: boxes, braces/brackets, strike-outs, emphasis marks, connectors ----
  // Each variant: { dims: [w, h], paths: (ww, r) => [ pts | { pts, dot, mul, still } ] }  (ww = pen width, r = seeded rng)
  const lin = (a, b, n = 20) => Array.from({ length: n }, (_, i) => [a[0] + (b[0] - a[0]) * i / (n - 1), a[1] + (b[1] - a[1]) * i / (n - 1)]);
  const poly = (pts, n = 16) => pts.slice(1).reduce((acc, p, i) => acc.concat(lin(pts[i], p, n).slice(i ? 1 : 0)), []);
  const bez = (p0, p1, p2, p3, n = 28) => Array.from({ length: n }, (_, i) => { const t = i / (n - 1), u = 1 - t; return [u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0], u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]]; });
  const cat = (...a) => a.reduce((acc, x) => acc.concat(acc.length ? x.slice(1) : x), []);
  const arc = (cx, cy, rx, ry, a0, a1, n = 10) => Array.from({ length: n }, (_, i) => { const a = (a0 + (a1 - a0) * i / (n - 1)) * Math.PI / 180; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
  const dot = (x, y, mul = 2.4) => ({ pts: [[x, y], [x + .1, y]], dot: true, mul, still: true });
  const jit = (r, a = 4) => (r() - .5) * a;

  // box = four overshooting strokes, like drawing a rectangle with a marker
  function boxLines(W, H, ww, r) {
    const m = ww / 2 + 6, x0 = m, x1 = W - m, y0 = m, y1 = H - m, os = 5 + r() * 4;
    return [
      lin([x0 - os, y0 + jit(r)], [x1 + os * .6, y0 + jit(r)]),
      lin([x1 + jit(r), y0 - os * .6], [x1 + jit(r), y1 + os]),
      lin([x1 + os, y1 + jit(r)], [x0 - os * .6, y1 + jit(r)]),
      lin([x0 + jit(r), y1 + os * .6], [x0 + jit(r), y0 - os]),
    ];
  }
  // one continuous rounded loop that overlaps its own start
  function boxRound(W, H, ww, r, over = 26) {
    const m = ww / 2 + 6, x0 = m, x1 = W - m, y0 = m, y1 = H - m, c = Math.min(22, (y1 - y0) / 3), sx = x0 + c + 12;
    return [cat(
      lin([sx, y0], [x1 - c, y0]), arc(x1 - c, y0 + c, c, c, -90, 0), lin([x1, y0 + c], [x1, y1 - c]),
      arc(x1 - c, y1 - c, c, c, 0, 90), lin([x1 - c, y1], [x0 + c, y1]), arc(x0 + c, y1 - c, c, c, 90, 180),
      lin([x0, y1 - c], [x0, y0 + c]), arc(x0 + c, y0 + c, c, c, 180, 270), lin([x0 + c, y0 - 1.5], [sx + over, y0 - 3]),
    )];
  }
  function boxCorners(W, H, ww, r) {
    const m = ww / 2 + 6, x0 = m, x1 = W - m, y0 = m, y1 = H - m, l = Math.min(34, (y1 - y0) * .45, (x1 - x0) * .3);
    return [
      poly([[x0 + l, y0], [x0, y0], [x0, y0 + l]]), poly([[x1 - l, y0], [x1, y0], [x1, y0 + l]]),
      poly([[x1 - l, y1], [x1, y1], [x1, y1 - l]]), poly([[x0 + l, y1], [x0, y1], [x0, y1 - l]]),
    ];
  }
  // curly / square / round brackets, drawn facing right in a 100x200 box (x -> 100 - x faces left;
  // [y*2, 100 - x] lays them across a 400x100 box)
  const SH = {
    brace:   () => cat(bez([12, 12], [40, 12], [45, 22], [45, 52]), bez([45, 52], [45, 82], [50, 95], [80, 100]), bez([80, 100], [50, 105], [45, 118], [45, 148]), bez([45, 148], [45, 178], [40, 188], [12, 188])),
    bracket: () => poly([[28, 12], [74, 12], [74, 188], [28, 188]], 24),
    paren:   () => bez([28, 12], [92, 60], [92, 140], [28, 188], 40),
  };
  const mirror = pts => pts.map(([x, y]) => [100 - x, y]);
  const across = pts => pts.map(([x, y]) => [y * 2, 100 - x]);
  const shapeVar = (name, mode) => ({
    dims: mode === 'top' || mode === 'bottom' ? [400, 100] : [100, 200],
    paths: () => { const b = SH[name](); return [mode === 'r' ? b : mode === 'l' ? mirror(b) : mode === 'top' ? across(b) : across(mirror(b))]; },
  });

  const strikeLine = (tilt, n = 1) => (ww, r) => Array.from({ length: n }, (_, k) => lin([22, 50 + tilt + (k - (n - 1) / 2) * (ww * 1.6 + 8)], [378, 50 - tilt + (k - (n - 1) / 2) * (ww * 1.6 + 8) + jit(r, 4)]));
  const markDot = (x, y) => dot(x, y, 2.2);


  // ---- speech bubbles (320x200 box; the tail points to the lower left, mirror = lower right) ----
  const BW = 320, BH = 200;
  const mirrorX = pts => pts.map(([x, y]) => [BW - x, y]);
  function bubOval(ww, r, mir) {
    const m = ww / 2 + 7, cx = BW / 2, cy = 80, rx = BW / 2 - m, ry = 74 - m + 4;
    const on = d => [cx + rx * Math.cos(d * Math.PI / 180), cy + ry * Math.sin(d * Math.PI / 180)];
    const A = on(104), B = on(138), tip = [58 + jit(r, 6), BH - m - 2];
    const body = arc(cx, cy, rx, ry, 138, 138 + 360 - 34 + 6, 90); // from B round to A, a little overshoot
    const path = cat(body, lin(A, tip, 10), lin(tip, B, 10));
    return [mir ? mirrorX(path) : path];
  }
  function bubRect(ww, r, mir) {
    const m = ww / 2 + 7, x0 = m, x1 = BW - m, y0 = m, y1 = 150, c = 28;
    const path = cat(
      lin([x0 + c + 10, y0], [x1 - c, y0]), arc(x1 - c, y0 + c, c, c, -90, 0), lin([x1, y0 + c], [x1, y1 - c]), arc(x1 - c, y1 - c, c, c, 0, 90),
      lin([x1 - c, y1], [x0 + 110, y1]), lin([x0 + 110, y1], [x0 + 34 + jit(r, 6), BH - m - 2], 10), lin([x0 + 34, BH - m - 2], [x0 + 62, y1], 10), lin([x0 + 62, y1], [x0 + c, y1]),
      arc(x0 + c, y1 - c, c, c, 90, 180), lin([x0, y1 - c], [x0, y0 + c]), arc(x0 + c, y0 + c, c, c, 180, 270), lin([x0 + c, y0 - 1], [x0 + c + 24, y0 - 2.5], 6));
    return [mir ? mirrorX(path) : path];
  }
  const dashW = ww => `${f(ww * 3 + 6)} ${f(ww * 2 + 6)}`;


  // ---- editorial kit (inspired by hand-made explainer posters): marker bands, note cards, number badges, accents ----
  const rot = (pts, deg, cx, cy) => { const a = deg * Math.PI / 180, c = Math.cos(a), s2 = Math.sin(a); return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s2, cy + (x - cx) * s2 + (y - cy) * c]); };
  const INK = '#111111';
  // a rectangle "painted" with overlapping marker passes: the overlaps give the streaky look of a real marker
  function markerFill(x0, y0, x1, y1, ww, r, extra = {}) {
    const h = y1 - y0, pw = Math.max(6, ww * 1.1), n = Math.max(2, Math.round(h / (pw * .72)) + 1);
    return Array.from({ length: n }, (_, i) => {
      const y = y0 + pw / 2 + (h - pw) * (n === 1 ? .5 : i / (n - 1));
      return { pts: lin([x0 + jit(r, 10), y + jit(r, 2)], [x1 + jit(r, 10), y + jit(r, 4)], 24), op: .86, single: true, cap: 'butt', w: pw, wob: .5, ...extra };
    });
  }
  const sketchOutline = (x0, y0, x1, y1, r, color = '#6b7280') =>
    [0, 1].flatMap(k => boxLines2(x0 - k * 2, y0 - k * 2, x1 + k * 2, y1 + k * 2, r).map(pts => ({ pts, color, w: 2.2, op: .7 - k * .2, single: true, wob: .35 })));
  function boxLines2(x0, y0, x1, y1, r) {
    const os = 4 + r() * 4;
    return [lin([x0 - os, y0 + jit(r)], [x1 + os * .6, y0 + jit(r)]), lin([x1 + jit(r), y0 - os * .6], [x1 + jit(r), y1 + os]),
            lin([x1 + os, y1 + jit(r)], [x0 - os * .6, y1 + jit(r)]), lin([x0 + jit(r), y1 + os * .6], [x0 + jit(r), y0 - os])];
  }
  const band = (W, H, tilt = 0) => (ww, r) => { const m = 8; const out = markerFill(m + 6, m, W - m - 6, H - m, ww, r); return tilt ? out.map(it => ({ ...it, pts: rot(it.pts, tilt, W / 2, H / 2) })) : out; };
  const card = (W, H, tilt, tape) => (ww, r) => {
    const x0 = 22, y0 = 22, x1 = W - 22, y1 = H - 22;
    let items = [...markerFill(x0, y0, x1, y1, Math.min(ww, 30), r), ...sketchOutline(x0 - 4, y0 - 4, x1 + 4, y1 + 4, r)];
    if (tape) items.push(...markerFill(W / 2 - 34, 6, W / 2 + 34, 34, 12, r, { color: '#fde68a', op: .8 }).map(it => ({ ...it, pts: rot(it.pts, -4, W / 2, 20) })));
    return tilt ? items.map(it => ({ ...it, pts: rot(it.pts, tilt, W / 2, H / 2) })) : items;
  };

  // digits as pen strokes in a 100x140 box
  const DIGITS = {
    0: () => [arc(50, 70, 30, 55, -90, 275, 40)],
    1: () => [lin([32, 40], [55, 16], 8), lin([55, 16], [55, 126], 16)],
    2: () => [cat(bez([22, 42], [24, 4], [80, 4], [78, 44], 14), bez([78, 44], [76, 72], [30, 96], [22, 126], 14), lin([22, 126], [82, 126], 8))],
    3: () => [cat(bez([22, 30], [30, 4], [78, 4], [75, 40], 14), bez([75, 40], [73, 58], [52, 66], [42, 68], 10), bez([42, 68], [82, 68], [86, 116], [50, 128], 14), bez([50, 128], [34, 132], [22, 120], [20, 104], 8))],
    4: () => [lin([66, 126], [66, 16], 12), lin([66, 16], [18, 92], 12), lin([18, 92], [86, 92], 8)],
    5: () => [cat(lin([76, 16], [32, 16], 8), lin([32, 16], [27, 64], 8), bez([27, 64], [46, 50], [84, 58], [80, 92], 14), bez([80, 92], [78, 126], [36, 136], [20, 112], 14))],
    6: () => [cat(bez([72, 16], [34, 24], [22, 70], [24, 100], 14), arc(50, 100, 27, 27, 180, 540, 30))],
    7: () => [lin([22, 16], [80, 16], 8), lin([80, 16], [42, 128], 14)],
    8: () => [arc(50, 40, 24, 25, 90, 450, 26), arc(50, 96, 29, 31, -90, 270, 28)],
    9: () => [cat(arc(50, 44, 28, 29, 20, 380, 30), bez([77, 52], [78, 84], [66, 114], [32, 126], 14))],
  };
  const digitPaths = (d, cx, cy, s) => DIGITS[d]().map(pts => pts.map(([x, y]) => [cx + (x - 50) * s, cy + (y - 70) * s]));
  // a disc scribbled in with a spiral marker pass, an ink ring around it and the number on top
  function badge(d, filled) {
    return (ww, r) => {
      const cx = 80, cy = 80, R = 56, items = [];
      if (filled) {
        const fw = 15, turns = R / (fw * .8), n = 420;
        items.push({ pts: Array.from({ length: n }, (_, i) => { const t = i / (n - 1), a = t * turns * Math.PI * 2, rr = R * t; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; }), still: true, single: true, w: fw, op: .93, cap: 'round' });
      }
      const ring = arc(cx, cy, R + 4, R + 4, -110, 270 + 20, 70);
      items.push({ pts: ring, color: filled ? INK : undefined, w: Math.max(3, ww * .7), single: true, wob: .6 });
      digitPaths(d, cx, cy, .55).forEach(pts => items.push({ pts, color: filled ? INK : undefined, w: Math.max(3, ww * .9), single: true, wob: .35 }));
      return items;
    };
  }
  const BADGES = {};
  for (let d = 1; d <= 9; d++) { BADGES['badge-' + d] = { dims: [160, 160], paths: badge(d, true) }; }
  for (let d = 1; d <= 9; d++) { BADGES['ring-' + d] = { dims: [160, 160], paths: badge(d, false) }; }

  const rayLine = (cx, cy, deg, r1, r2) => { const a = deg * Math.PI / 180; return lin([cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)], [cx + r2 * Math.cos(a), cy + r2 * Math.sin(a)], 6); };

  const GEN = {
    box: {
      box:           { dims: [400, 100], paths: (ww, r) => boxLines(400, 100, ww, r) },
      'box-round':   { dims: [400, 100], paths: (ww, r) => boxRound(400, 100, ww, r) },
      'box-double':  { dims: [400, 100], paths: (ww, r) => boxLines(400, 100, ww, r).concat(boxLines(400, 100, ww, r).map(p => p.map(([x, y]) => [x + jit(r, 5), y + jit(r, 5)]))) },
      'box-corners': { dims: [400, 100], paths: (ww, r) => boxCorners(400, 100, ww, r) },
      square:        { dims: [200, 200], paths: (ww, r) => boxLines(200, 200, ww, r) },
      'square-round':{ dims: [200, 200], paths: (ww, r) => boxRound(200, 200, ww, r, 34) },
      'square-corners': { dims: [200, 200], paths: (ww, r) => boxCorners(200, 200, ww, r) },
    },
    brace: {
      'brace-right': shapeVar('brace', 'r'), 'brace-left': shapeVar('brace', 'l'), 'brace-top': shapeVar('brace', 'top'), 'brace-bottom': shapeVar('brace', 'bottom'),
      'bracket-right': shapeVar('bracket', 'r'), 'bracket-left': shapeVar('bracket', 'l'), 'bracket-top': shapeVar('bracket', 'top'), 'bracket-bottom': shapeVar('bracket', 'bottom'),
      'paren-right': shapeVar('paren', 'r'), 'paren-left': shapeVar('paren', 'l'),
    },
    strike: {
      line:    { dims: [400, 100], paths: strikeLine(3) },
      double:  { dims: [400, 100], paths: strikeLine(2, 2) },
      wavy:    { dims: [400, 100], paths: () => [Array.from({ length: 200 }, (_, i) => { const t = i / 199; return [22 + 356 * t, 50 + 8 * Math.sin(t * Math.PI * 2 * 11)]; })] },
      scratch: { dims: [400, 100], paths: (ww, r) => { const a = Math.min(30, 40 - ww / 2); return [poly(Array.from({ length: 17 }, (_, i) => [24 + 352 * i / 16, 50 + (i % 2 ? a : -a) + jit(r, 5)]), 10)]; } },
      scribble:{ dims: [400, 100], paths: () => [Array.from({ length: 360 }, (_, i) => { const t = i / 359, th = t * Math.PI * 2 * 10; return [24 + 352 * t - 12 * Math.sin(th), 50 - 12 * Math.cos(th)]; })] },
      slash:   { dims: [200, 200], paths: (ww, r) => [lin([36 + jit(r), 164 + jit(r)], [164 + jit(r), 36 + jit(r)])] },
    },
    mark: {
      check:    { dims: [200, 200], paths: () => [cat(bez([38, 108], [52, 118], [66, 134], [80, 152], 12), bez([80, 152], [104, 98], [134, 62], [168, 38], 20))] },
      cross:    { dims: [200, 200], paths: (ww, r) => [lin([44, 44 + jit(r)], [158, 158]), lin([158, 42], [42 + jit(r), 158 + jit(r)])] },
      plus:     { dims: [200, 200], paths: (ww, r) => [lin([100 + jit(r), 36], [100, 164 + jit(r)]), lin([36, 100 + jit(r)], [164 + jit(r), 100])] },
      asterisk: { dims: [200, 200], paths: () => [lin([100, 36], [100, 164]), lin([45, 68], [155, 132]), lin([155, 68], [45, 132])] },
      exclaim:  { dims: [200, 200], paths: () => [bez([100, 28], [96, 70], [104, 100], [100, 128], 24), markDot(100, 164)] },
      question: { dims: [200, 200], paths: () => [cat(bez([62, 70], [58, 24], [142, 24], [138, 70], 20), bez([138, 70], [136, 100], [100, 100], [100, 128], 20)), markDot(100, 166)] },
      heart:    { dims: [200, 200], paths: () => [Array.from({ length: 120 }, (_, i) => { const t = Math.PI + (i / 119) * Math.PI * 2.04; return [100 + 5 * 16 * Math.pow(Math.sin(t), 3) * .98, 98 - 5 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * .98]; })] },
      burst:    { dims: [200, 200], paths: (ww, r) => Array.from({ length: 10 }, (_, i) => { const a = (i * 36 + jit(r, 10)) * Math.PI / 180, r1 = 38 + jit(r, 6), r2 = 84 - (i % 2) * 14 + jit(r, 8); return lin([100 + r1 * Math.cos(a), 100 + r1 * Math.sin(a)], [100 + r2 * Math.cos(a), 100 + r2 * Math.sin(a)], 8); }) },
      sparks:   { dims: [200, 200], paths: () => [-60, -20, 20].map(d => { const a = d * Math.PI / 180; return lin([60 + 38 * Math.cos(a), 100 + 38 * Math.sin(a)], [60 + 84 * Math.cos(a), 100 + 84 * Math.sin(a)], 8); }).concat([-20 + 180, -60 + 180, 20 + 180].map(d => { const a = d * Math.PI / 180; return lin([140 + 38 * Math.cos(a), 100 + 38 * Math.sin(a)], [140 + 84 * Math.cos(a), 100 + 84 * Math.sin(a)], 8); })) },
    },
    bubble: {
      'speech':        { dims: [BW, BH], paths: (ww, r) => bubOval(ww, r, false) },
      'speech-right':  { dims: [BW, BH], paths: (ww, r) => bubOval(ww, r, true) },
      'speech-box':    { dims: [BW, BH], paths: (ww, r) => bubRect(ww, r, false) },
      'speech-box-right': { dims: [BW, BH], paths: (ww, r) => bubRect(ww, r, true) },
      'whisper':       { dims: [BW, BH], paths: (ww, r) => bubOval(ww, r, false).map(pts => ({ pts, dash: dashW })) },
    },
    band: {
      band:         { dims: [400, 100], paths: band(400, 100) },
      'band-tilt':  { dims: [400, 100], paths: band(400, 100, -2.5) },
      'band-short': { dims: [300, 90],  paths: band(300, 90) },
      'band-tall':  { dims: [400, 150], paths: band(400, 150) },
      'band-label': { dims: [260, 80],  paths: band(260, 80, 1.5) },
      card:         { dims: [300, 200], paths: card(300, 200, 0, false) },
      'card-tilt':  { dims: [300, 200], paths: card(300, 200, -3, false) },
      'card-tape':  { dims: [300, 200], paths: card(300, 200, 1.5, true) },
      'card-wide':  { dims: [400, 130], paths: card(400, 130, 0, false) },
      'card-small': { dims: [260, 110], paths: card(260, 110, -2, false) },
    },
    number: BADGES,
    accent: {
      'rays-ring':  { dims: [200, 200], paths: (ww, r) => Array.from({ length: 12 }, (_, i) => rayLine(100, 100, i * 30 + jit(r, 6), 60 + jit(r, 4), 90 + jit(r, 8))) },
      'rays-fan':   { dims: [200, 200], paths: (ww, r) => Array.from({ length: 5 }, (_, i) => rayLine(60, 150, -80 + i * 17, 70 + jit(r, 4), 110 + jit(r, 14))) },
      'rays-corner':{ dims: [200, 200], paths: (ww, r) => [-60, -30, 0].map(d => rayLine(40, 160, d - 20, 60, 100 + jit(r, 10))) },
      'ticks-sides':{ dims: [400, 100], paths: (ww, r) => [-26, 0, 26].flatMap(d => [rayLine(92, 50, d + 180, 28, 62 + jit(r, 8)), rayLine(308, 50, d, 28, 62 + jit(r, 8))]) },
      'ticks-trio': { dims: [200, 200], paths: (ww, r) => [-38, 0, 38].map(d => rayLine(46, 100, d, 40, 86 + jit(r, 10))) },
      crown:        { dims: [200, 200], paths: () => [poly([[34, 152], [26, 70], [66, 108], [100, 46], [134, 108], [174, 70], [166, 152], [34, 152]], 10)] },
      checkbox:     { dims: [200, 200], paths: (ww, r) => [...boxLines2(46, 56, 154, 164, r), cat(bez([68, 108], [82, 118], [92, 134], [100, 148], 12), bez([100, 148], [118, 98], [140, 54], [178, 26], 20))] },
      'big-x':      { dims: [200, 200], paths: (ww, r) => [lin([30, 36 + jit(r)], [172, 168 + jit(r)]), lin([172, 34 + jit(r)], [28 + jit(r), 170])] },
      underline:    { dims: [400, 100], paths: (ww, r) => [lin([30, 52 + jit(r, 2)], [370, 48 + jit(r, 2)], 30), lin([60, 70 + jit(r, 2)], [330, 67 + jit(r, 2)], 30)].map((pts, i) => ({ pts, w: i ? Math.max(2, ww * .6) : ww })) },
    },
    connector: {
      dots:         { dims: [400, 100], paths: () => [lin([40, 50], [360, 50], 40), dot(40, 50), dot(360, 50)] },
      'dot-arrow':  { dims: [400, 100], paths: () => [lin([40, 50], [366, 50], 40), dot(40, 50), poly([[342, 32], [368, 50], [342, 68]], 8)] },
      dimension:    { dims: [400, 100], paths: () => [lin([36, 50], [364, 50], 40), lin([36, 28], [36, 72], 8), lin([364, 28], [364, 72], 8)] },
      rings:        { dims: [400, 100], paths: (ww) => [lin([40 + 8 + ww / 2, 50], [360 - 8 - ww / 2, 50], 40), arc(40, 50, 8 + ww / 3, 8 + ww / 3, 0, 360, 24), arc(360, 50, 8 + ww / 3, 8 + ww / 3, 0, 360, 24)] },
      'curve-dots': { dims: [400, 100], paths: () => [bez([40, 72], [130, 6], [270, 96], [360, 28], 50), dot(40, 72), dot(360, 28)] },
      'elbow-dots': { dims: [400, 100], paths: () => [poly([[40, 74], [150, 74], [150, 26], [360, 26]], 24), dot(40, 74), dot(360, 26)] },
    },
  };

  function ringPts(def, ww, seed) {
    const [W, H] = def.oval ? [400, 100] : [200, 200], cx = W / 2, cy = H / 2;
    const margin = ww / 2 + 5, drift = def.drift;
    const rx = (W / 2 - margin) / (1 + drift), ry = ((H / 2 - margin) / (1 + drift)) * (def.ry || 1) * (def.squash || 1);
    const r = rng(seed), p = [r() * 6.28, r() * 6.28], q = [r() * 6.28, r() * 6.28];
    const tilt = def.tilt * Math.PI / 180, a0 = def.start * Math.PI / 180, total = def.turns * Math.PI * 2;
    const n = Math.round(160 * def.turns);
    return Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n, th = a0 + def.dir * total * t;
      // radius grows along the stroke (spiral) with a little low-frequency wander, like an unsteady hand
      const k = 1 + drift * t + .018 * Math.sin(th * 2 + p[0]) + .012 * Math.sin(th * 3 + p[1]);
      const x = rx * k * Math.cos(th), y = ry * k * Math.sin(th) + (def.oval ? 0 : 0);
      return [cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)];
    });
  }

  const darken = hex => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.substr(i, 2), 16) * .55).toString(16).padStart(2, '0')).join('');
  // sticker = the drawn strokes re-inked as fat shapes: shadow, white die-cut border, dark outline, color fill
  function stickerize(body, color, border) {
    const re = (col, add) => body.replace(/stroke="#[0-9a-fA-F]{3,6}"/g, `stroke="${col}"`).replace(/stroke-width="([\d.]+)"/g, (m, n) => `stroke-width="${f(+n + add)}"`).replace(/stroke-opacity="[\d.]+"/g, 'stroke-opacity="1"');
    return `<g transform="translate(0 4)" opacity=".22">${re('#000', border + 4)}</g>${re('#fff', border + 4)}${re(darken(color), 6)}${re(color, 0)}`;
  }


  // ---- cut-paper backgrounds: sheets to write on top of (scissor cuts, torn edges, strips, notes, tape) ----
  // Filled shapes, not strokes: shadow + (white fibres on torn edges) + paper colour + texture + edge line.
  // `width` = roughness of the cut / tear, `pen` = paper texture, `color` = the paper.
  const mix = (hex, to, k) => { const h = hex.replace('#', ''), t = to.replace('#', ''); return '#' + [0, 2, 4].map(i => Math.round(parseInt(h.substr(i, 2), 16) * (1 - k) + parseInt(t.substr(i, 2), 16) * k).toString(16).padStart(2, '0')).join(''); };
  const polyStr = pts => pts.map(p => f(p[0]) + ',' + f(p[1])).join(' ');
  const jpt = (r, amp) => (r() * 2 - 1) * amp;
  const rotP = (pts, deg, cx, cy) => { const a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a); return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * sn, cy + (x - cx) * sn + (y - cy) * c]); };
  // a straight edge p0 -> p1 made ragged; `inward` pushes the coloured paper back from the white torn fibres
  function tornEdge(p0, p1, amp, r, inward, rimW) {
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), n = Math.max(4, Math.round(len / 7)), dx = (p1[0] - p0[0]) / len, dy = (p1[1] - p0[1]) / len;
    const nx = -dy * inward, ny = dx * inward;                         // unit normal pointing into the sheet
    const outer = [], inner = []; let v = 0, w = 0;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = p0[0] + (p1[0] - p0[0]) * t, y = p0[1] + (p1[1] - p0[1]) * t;
      v = v * .55 + jpt(r, 1) * .45; w = w * .6 + jpt(r, 1) * .4;
      const o = v * amp, k = rimW * (.55 + .45 * Math.abs(w)) + w * amp * .5;
      outer.push([x + nx * o, y + ny * o]); inner.push([x + nx * (o + Math.max(1.5, k)), y + ny * (o + Math.max(1.5, k))]);
    }
    return { outer, inner };
  }
  const evenPoly = (cx, cy, rx, ry, n, amp, r) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [cx + Math.cos(a) * (rx + jpt(r, amp)), cy + Math.sin(a) * (ry + jpt(r, amp))]; });
  const M = 16;
  const PAPER = {
    cut: { dims: [400, 200], build: (W, H, R, r) => { const j = () => jpt(r, R * .5); return { sheets: [{ pts: [[M + j(), M + j()], [W - M - 40 + j(), M + j()], [W - M + j(), M + 34 + j()], [W - M + j(), H - M + j()], [M + 30 + j(), H - M + j()], [M + j(), H - M - 26 + j()]] }] }; } },
    'cut-wide': { dims: [400, 120], build: (W, H, R, r) => { const j = () => jpt(r, R * .4); return { sheets: [{ pts: [[M + j(), M + 8 + j()], [W - M + j(), M + j()], [W - M - 10 + j(), H - M + j()], [M + 12 + j(), H - M - 6 + j()]] }] }; } },
    strip: { dims: [400, 90], build: (W, H, R, r) => { const j = () => jpt(r, R * .3); return { sheets: [{ pts: [[M + 28 + j(), M + j()], [W - M + j(), M + j()], [W - M - 28 + j(), H - M + j()], [M + j(), H - M + j()]] }] }; } },
    banner: { dims: [400, 140], build: (W, H, R, r) => { const j = () => jpt(r, R * .3); return { sheets: [{ pts: [[M + j(), M + j()], [W - M + j(), M + j()], [W - M - 36 + j(), H / 2 + j()], [W - M + j(), H - M + j()], [M + j(), H - M + j()], [M + 36 + j(), H / 2 + j()]] }] }; } },
    ticket: { dims: [400, 140], build: (W, H, R, r) => {
      const nr = 14, rr = 16, cy = H / 2, ptsR = [], ptsL = [];
      for (let i = 0; i <= nr; i++) { const a = -Math.PI / 2 + Math.PI * i / nr; ptsR.push([W - M - Math.cos(a) * rr, cy + Math.sin(a) * rr]); ptsL.push([M + Math.cos(a) * rr, cy - Math.sin(a) * rr]); }
      return { sheets: [{ pts: [[M, M], [W - M, M], [W - M, cy - rr], ...ptsR, [W - M, cy + rr], [W - M, H - M], [M, H - M], [M, cy + rr], ...ptsL, [M, cy - rr]].map(([x, y]) => [x + jpt(r, R * .15), y + jpt(r, R * .15)]) }] }; } },
    note: { dims: [240, 240], build: (W, H, R, r) => { const j = () => jpt(r, R * .25), fold = 46; const a = [W - M, H - M - fold], b = [W - M - fold, H - M];
      return { sheets: [{ pts: [[M + j(), M + j()], [W - M + j(), M + j()], [a[0] + j(), a[1]], [b[0], b[1] + j()], [M + j(), H - M + j()]], fold: [a, b, [W - M - fold, H - M - fold]] }] }; } },
    'torn-bottom': { dims: [400, 200], build: (W, H, R, r) => { const amp = 2 + R * .8, e = tornEdge([W - M, H - M], [M, H - M], amp, r, -1, 5 + R * .25), t = M + jpt(r, 1.5);
      return { sheets: [{ pts: [[M, t], [W - M, t], ...e.inner], rim: [[M - 1, t - 1], [W - M + 1, t - 1], ...e.outer] }] }; } },
    'torn-top': { dims: [400, 200], build: (W, H, R, r) => { const amp = 2 + R * .8, e = tornEdge([M, M], [W - M, M], amp, r, 1, 5 + R * .25), b = H - M + jpt(r, 1.5);
      return { sheets: [{ pts: [...e.inner, [W - M, b], [M, b]], rim: [...e.outer, [W - M + 1, b + 1], [M - 1, b + 1]] }] }; } },
    'torn-all': { dims: [400, 220], build: (W, H, R, r) => { const amp = 2 + R * .7, rim = 4 + R * .2, T = tornEdge([M, M], [W - M, M], amp, r, 1, rim), Rr = tornEdge([W - M, M], [W - M, H - M], amp, r, 1, rim), B = tornEdge([W - M, H - M], [M, H - M], amp, r, 1, rim), L = tornEdge([M, H - M], [M, M], amp, r, 1, rim);
      return { sheets: [{ pts: [...T.inner, ...Rr.inner, ...B.inner, ...L.inner], rim: [...T.outer, ...Rr.outer, ...B.outer, ...L.outer] }] }; } },
    zigzag: { dims: [400, 160], build: (W, H, R, r) => { const step = 18, d = 7, n = Math.floor((W - 2 * M) / step), top = [], bot = [];
      for (let i = 0; i <= n; i++) { const x = M + i * (W - 2 * M) / n; top.push([x, M + (i % 2 ? d : 0)]); bot.push([x, H - M - (i % 2 ? d : 0)]); }
      return { sheets: [{ pts: [...top, ...bot.reverse()].map(([x, y]) => [x + jpt(r, R * .12), y + jpt(r, R * .12)]) }] }; } },
    scrap: { dims: [300, 220], build: (W, H, R, r) => ({ sheets: [{ pts: evenPoly(W / 2, H / 2, W / 2 - M - 4, H / 2 - M - 4, 7, 6 + R * 1.2, r).map(([x, y]) => [x, y]) }] }) },
    'circle-cut': { dims: [260, 260], build: (W, H, R, r) => ({ sheets: [{ pts: evenPoly(W / 2, H / 2, W / 2 - M - 4, H / 2 - M - 4, 16, 2 + R * .5, r) }] }) },
    layered: { dims: [400, 220], build: (W, H, R, r) => { const j = () => jpt(r, R * .4), mk = (dx, dy, ins) => [[M + ins + dx + j(), M + ins + dy + j()], [W - M - ins + dx + j(), M + ins + dy + j()], [W - M - ins + dx + j(), H - M - ins + dy + j()], [M + ins + dx + j(), H - M - ins + dy + j()]];
      return { sheets: [{ pts: rotP(mk(0, 6, 4), -3.5, W / 2, H / 2), tone: .14 }, { pts: rotP(mk(0, -4, 16), 1.8, W / 2, H / 2) }] }; } },
    taped: { dims: [400, 200], build: (W, H, R, r) => { const j = () => jpt(r, R * .45), pts = [[M + 8 + j(), M + 12 + j()], [W - M - 8 + j(), M + 12 + j()], [W - M - 8 + j(), H - M + j()], [M + 8 + j(), H - M + j()]];
      const tape = (cx, cy, deg) => rotP([[cx - 34, cy - 12], [cx + 34, cy - 12], [cx + 34, cy + 12], [cx - 34, cy + 12]], deg, cx, cy);
      return { sheets: [{ pts }], tapes: [tape(M + 26, M + 14, -34), tape(W - M - 26, M + 14, 34)] }; } },
  };
  const PAPER_TEXTURES = { plain: 'Plain', grain: 'Fine grain', kraft: 'Kraft fibres', lined: 'Notebook lines', grid: 'Squared', dots: 'Dotted' };

  function paperSVG(variant, o) {
    const def = PAPER[variant] || PAPER.cut, [W, H] = def.dims, size = o.size || 400, color = o.color || '#fff7e6', tex = o.pen || 'plain';
    const R = Math.max(0, Math.min(20, o.width == null ? 8 : o.width)), id = 'pp' + (++uid);
    let seed = 7; for (const ch of variant) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const scene = def.build(W, H, R, rng(seed));
    const edge = mix(color, '#000000', .28);
    let defs = `<filter id="${id}sh" x="-10%" y="-10%" width="125%" height="135%"><feGaussianBlur stdDeviation="3.2"/></filter>`;
    if (tex === 'grain') defs += `<filter id="${id}t" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .42 -.1"/></filter>`;
    if (tex === 'kraft') defs += `<filter id="${id}t" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".022 .55" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 .25  0 0 0 0 .14  0 0 0 0 .05  0 0 0 .75 -.22"/></filter><filter id="${id}t2" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="2"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .35 -.1"/></filter>`;
    if (tex === 'lined') defs += `<pattern id="${id}p" width="40" height="24" patternUnits="userSpaceOnUse" y="14"><line x1="0" y1="23" x2="40" y2="23" stroke="#7d98cf" stroke-opacity=".6" stroke-width="1.6"/></pattern>`;
    if (tex === 'grid') defs += `<pattern id="${id}p" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#7d98cf" stroke-opacity=".5" stroke-width="1.2"/></pattern>`;
    if (tex === 'dots') defs += `<pattern id="${id}p" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1.7" fill="#6b7280" fill-opacity=".55"/></pattern>`;
    let body = '';
    scene.sheets.forEach((sh, i) => {
      const c = sh.tone ? mix(color, '#000000', sh.tone) : color, cp = `${id}c${i}`;
      defs += `<clipPath id="${cp}"><polygon points="${polyStr(sh.pts)}"/></clipPath>`;
      body += `<polygon points="${polyStr(sh.rim || sh.pts)}" transform="translate(3 6)" fill="#000" fill-opacity=".3" filter="url(#${id}sh)"/>`;
      if (sh.rim) body += `<polygon points="${polyStr(sh.rim)}" fill="#fffdf6" stroke="${mix('#fffdf6', '#000000', .12)}" stroke-width=".8" stroke-linejoin="round"/>`;
      body += `<polygon points="${polyStr(sh.pts)}" fill="${c}" stroke="${edge}" stroke-opacity=".5" stroke-width="1.1" stroke-linejoin="round"/>`;
      const over = [];
      if (tex === 'grain') over.push(`<rect width="${W}" height="${H}" filter="url(#${id}t)"/>`);
      if (tex === 'kraft') over.push(`<rect width="${W}" height="${H}" filter="url(#${id}t)"/>`, `<rect width="${W}" height="${H}" filter="url(#${id}t2)"/>`);
      if (tex === 'lined' || tex === 'grid' || tex === 'dots') over.push(`<rect width="${W}" height="${H}" fill="url(#${id}p)"/>`);
      if (tex === 'lined') over.push(`<line x1="${W * .13}" y1="0" x2="${W * .13}" y2="${H}" stroke="#e07a7a" stroke-opacity=".7" stroke-width="1.6"/>`);
      if (over.length) body += `<g clip-path="url(#${cp})">${over.join('')}</g>`;
      if (sh.fold) body += `<polygon points="${polyStr(sh.fold)}" fill="${mix(c, '#000000', .16)}" stroke="${edge}" stroke-opacity=".5" stroke-width="1" stroke-linejoin="round"/>`;
    });
    (scene.tapes || []).forEach(t => { body += `<polygon points="${polyStr(t)}" fill="#f1e3a6" fill-opacity=".82" stroke="#c9b66a" stroke-opacity=".6" stroke-width="1"/>`; });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${f(size * H / W)}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`;
  }

  function strokeSVG(kind, variant, o) {
    o = o || {};
    if (kind === 'paper') return paperSVG(variant, o);
    const color = o.color || '#111111', size = o.size || 400;
    const isH = kind === 'highlight', isRing = kind === 'circle', isGen = !!GEN[kind];
    const sticker = !!o.sticker && !isH;
    const penKey = sticker ? 'pen' : (o.pen || (isH ? 'chisel' : 'pen'));
    const pen = PENS[penKey] || PENS[isH ? 'chisel' : 'pen'];
    const w = o.width || (isH ? 34 : 7);
    const def = isGen ? (GEN[kind][variant] || Object.values(GEN[kind])[0]) : isRing ? (RINGS[variant] || RINGS.oval) : (isH ? HIGHLIGHT : UNDERLINE)[variant] || (isH ? HIGHLIGHT.swipe : UNDERLINE.solid);
    const [VW, VH] = dimsOf(kind, variant);
    const id = 'sf' + (++uid), seed = variant.length * 17 + penKey.length * 5 + 3;
    const defs = pen.filter ? pen.filter(id) : '';
    const filt = pen.filter ? ` filter="url(#${id})"` : '';
    const ww = sticker ? w * 1.3 + 3 : w * pen.mul;
    const lw = sticker ? ww + 16 : ww; // width the shapes lay themselves out for (leaves room for the sticker border)
    let body = '';

    if (isGen) {
      const r = rng(seed * 7 + 1);
      def.paths(lw, r).forEach((it, k) => {
        const o2 = it.pts ? it : { pts: it };
        // per-item overrides: color (fixed ink / paper tones), w (absolute width), op, cap, single (one pass, e.g. marker fills)
        for (let p = 0; p < (o2.dot || o2.single ? 1 : pen.passes); p++) {
          let pts = o2.still ? o2.pts : wob(o2.pts, seed + k * 13 + p * 29, pen.wobble * (o2.wob == null ? .7 : o2.wob));
          if (p) pts = pts.map(([x, y]) => [x, y + .8]);
          const sw = o2.w != null ? o2.w : (o2.mul || 1) * (p ? ww * .8 : ww), op = o2.op != null ? o2.op : (p ? pen.op * .75 : pen.op);
          body += `<path d="${D(pts)}" fill="none" stroke="${o2.color || color}" stroke-width="${f(sw)}" stroke-opacity="${op}" stroke-linecap="${o2.cap || 'round'}" stroke-linejoin="round"${o2.dash ? ` stroke-dasharray="${o2.dash(ww)}"` : ''}${filt}/>`;
        }
      });
    } else if (isRing) {
      for (let p = 0; p < pen.passes; p++) {
        const pts = wob(ringPts(def, lw, seed + p * 31), seed + p * 7, pen.wobble * .6).map(([x, y]) => [x, y + (p ? .8 : 0)]);
        body += `<path d="${D(pts)}" fill="none" stroke="${color}" stroke-width="${f(p ? ww * .8 : ww)}" stroke-opacity="${p ? pen.op * .75 : pen.op}" stroke-linecap="round" stroke-linejoin="round"${filt}/>`;
      }
    } else if (isH) {
      let bands = [{ pts: def.pts(w), dy: 0, x: 0, op: pen.op }];
      if (def.twoPass) bands = [{ pts: def.pts(w), dy: -w * .16, x: 6, op: pen.op * .8 }, { pts: def.pts(w), dy: w * .16, x: -6, op: pen.op * .8 }];
      for (const b of bands) {
        let pts = wob(b.pts, seed + b.dy, pen.wobble).map(([x, y]) => [x + b.x * (x < 200 ? 1 : -1) * .5, y + b.dy]);
        if (pen.chisel && !def.fill) {
          // flat marker tip: a band with slanted ends
          const s = Math.min(14, ww * .3), top = pts.map(([x, y]) => [x, y - ww / 2]), bot = pts.map(([x, y]) => [x, y + ww / 2]);
          top[0][0] += s; bot[0][0] -= s; top[top.length - 1][0] += s; bot[bot.length - 1][0] -= s;
          body += `<polygon points="${[...top, ...bot.reverse()].map(p => f(p[0]) + ',' + f(p[1])).join(' ')}" fill="${color}" fill-opacity="${b.op}" stroke="${color}" stroke-opacity="${b.op}" stroke-width="1.5" stroke-linejoin="round"${filt}/>`;
        } else if (def.fill) {
          // scribbled-in highlight: zigzag back and forth across the band
          const half = ww / 2, zz = wob(def.pts(w).map(([x, y]) => [x, 50 + (y - 50) * 2 * half]), seed, pen.wobble);
          body += `<path d="${D(zz)}" fill="none" stroke="${color}" stroke-opacity="${b.op}" stroke-width="${f(Math.max(6, ww * .3))}" stroke-linecap="round" stroke-linejoin="round"${filt}/>`;
        } else {
          body += `<path d="${D(pts)}" fill="none" stroke="${color}" stroke-opacity="${b.op}" stroke-width="${f(ww)}" stroke-linecap="${pen.chisel ? 'butt' : 'round'}" stroke-linejoin="round"${filt}/>`;
        }
      }
    } else {
      const offs = def.double ? [-(w * 1.1 + 3), w * 1.1 + 3] : [0];
      const sw = def.double ? ww * .75 : ww;
      offs.forEach((dy, k) => {
        for (let p = 0; p < pen.passes; p++) {
          const pts = wob(def.pts(w), seed + k * 13 + p * 29, pen.wobble).map(([x, y]) => [x, y + dy + (p ? .9 : 0)]);
          const dash = def.dash ? ` stroke-dasharray="${def.dash(ww)}"` : '';
          body += `<path d="${D(pts)}" fill="none" stroke="${color}" stroke-width="${f(p ? sw * .8 : sw)}" stroke-opacity="${p ? pen.op * .75 : pen.op}" stroke-linecap="round" stroke-linejoin="round"${dash}${filt}/>`;
        }
      });
    }
    if (sticker) body = stickerize(body, color, 16);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${f(size * VH / VW)}" viewBox="0 0 ${VW} ${VH}">${defs ? '<defs>' + defs + '</defs>' : ''}${body}</svg>`;
  }

  window.STROKES = {
    svg: strokeSVG,
    kinds: {
      highlight: { label: 'highlighter', variants: Object.keys(HIGHLIGHT), pens: ['chisel', 'round', 'hbrush', 'hcrayon'], width: [10, 80, 34] },
      box:       { label: 'box',            variants: Object.keys(GEN.box),       pens: ['pen', 'felt', 'pencil', 'brush', 'chalk', 'crayon'], width: [2, 20, 5] },
      brace:     { label: 'braces',         variants: Object.keys(GEN.brace),     pens: ['pen', 'felt', 'pencil', 'brush', 'chalk', 'crayon'], width: [2, 18, 5] },
      strike:    { label: 'strike-out',     variants: Object.keys(GEN.strike),    pens: ['pen', 'felt', 'pencil', 'brush', 'chalk', 'crayon'], width: [2, 24, 6] },
      mark:      { label: 'marks',          variants: Object.keys(GEN.mark),      pens: ['pen', 'felt', 'pencil', 'brush', 'chalk', 'crayon'], width: [3, 24, 8] },
      bubble:    { label: 'speech bubbles', variants: Object.keys(GEN.bubble),    pens: ['pen', 'felt', 'pencil', 'brush', 'chalk', 'crayon'], width: [2, 16, 5] },
      paper:     { label: 'cut paper', variants: Object.keys(PAPER), pens: Object.keys(PAPER_TEXTURES), penLabels: PAPER_TEXTURES, widthLabel: 'Roughness', penLabel: 'Texture', noSticker: true, width: [0, 20, 8], color: '#fff7e6' },
      band:      { label: 'bands & cards', variants: Object.keys(GEN.band),   pens: ['brush', 'felt', 'chalk', 'crayon', 'pencil', 'pen'], width: [12, 48, 26] },
      number:    { label: 'numbers',        variants: Object.keys(GEN.number), pens: ['pen', 'felt', 'brush', 'pencil', 'chalk', 'crayon'], width: [3, 20, 8] },
      accent:    { label: 'accents',        variants: Object.keys(GEN.accent), pens: ['pen', 'felt', 'brush', 'pencil', 'chalk', 'crayon'], width: [2, 18, 6] },
      connector: { label: 'connectors',     variants: Object.keys(GEN.connector), pens: ['pen', 'felt', 'pencil', 'brush', 'chalk', 'crayon'], width: [2, 16, 5] },
      circle: { label: 'circle & oval', variants: Object.keys(RINGS), pens: ['pen', 'felt', 'pencil', 'brush', 'chalk', 'crayon'], width: [2, 30, 6] },
      underline: { label: 'underline & lines', variants: Object.keys(UNDERLINE), pens: ['pen', 'felt', 'pencil', 'brush', 'chalk', 'crayon'], width: [2, 30, 7] },
    },
    dims: dimsOf,
    pens: PENS,
  };
})();
