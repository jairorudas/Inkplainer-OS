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
  const dimsOf = (kind, variant) => GEN[kind] ? (GEN[kind][variant] || Object.values(GEN[kind])[0]).dims : kind === 'circle' && !(RINGS[variant] || {}).oval ? [200, 200] : [400, 100];


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
    connector: {
      dots:         { dims: [400, 100], paths: () => [lin([40, 50], [360, 50], 40), dot(40, 50), dot(360, 50)] },
      'dot-arrow':  { dims: [400, 100], paths: () => [lin([40, 50], [366, 50], 40), dot(40, 50), poly([[342, 32], [368, 50], [342, 68]], 8)] },
      dimension:    { dims: [400, 100], paths: () => [lin([36, 50], [364, 50], 40), lin([36, 28], [36, 72], 8), lin([364, 28], [364, 72], 8)] },
      rings:        { dims: [400, 100], paths: (ww) => [lin([40 + 8 + ww / 2, 50], [360 - 8 - ww / 2, 50], 40), arc(40, 50, 8 + ww / 3, 8 + ww / 3, 0, 360, 24), arc(360, 50, 8 + ww / 3, 8 + ww / 3, 0, 360, 24)] },
      'curve-dots': { dims: [400, 100], paths: () => [bez([40, 72], [130, 6], [270, 96], [360, 28], 50), dot(40, 72), dot(360, 28)] },
      'elbow-dots': { dims: [400, 100], paths: () => [poly([[40, 74], [150, 74], [150, 26], [360, 26]], 24), dot(40, 74), dot(360, 26)] },
    },
  };
  const FLAT = ['box', 'brace', 'strike', 'mark', 'connector'];

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

  function strokeSVG(kind, variant, o) {
    o = o || {};
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
        for (let p = 0; p < (o2.dot ? 1 : pen.passes); p++) {
          let pts = o2.still ? o2.pts : wob(o2.pts, seed + k * 13 + p * 29, pen.wobble * .7);
          if (p) pts = pts.map(([x, y]) => [x, y + .8]);
          body += `<path d="${D(pts)}" fill="none" stroke="${color}" stroke-width="${f((o2.mul || 1) * (p ? ww * .8 : ww))}" stroke-opacity="${p ? pen.op * .75 : pen.op}" stroke-linecap="round" stroke-linejoin="round"${filt}/>`;
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
      connector: { label: 'connectors',     variants: Object.keys(GEN.connector), pens: ['pen', 'felt', 'pencil', 'brush', 'chalk', 'crayon'], width: [2, 16, 5] },
      circle: { label: 'circle & oval', variants: Object.keys(RINGS), pens: ['pen', 'felt', 'pencil', 'brush', 'chalk', 'crayon'], width: [2, 30, 6] },
      underline: { label: 'underline & lines', variants: Object.keys(UNDERLINE), pens: ['pen', 'felt', 'pencil', 'brush', 'chalk', 'crayon'], width: [2, 30, 7] },
    },
    dims: dimsOf,
    pens: PENS,
  };
})();
