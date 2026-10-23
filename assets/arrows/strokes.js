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
    return `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="100"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}"/></filter>`;
  }
  function grain(id, scale, dfreq, gfreq, a, b, seed) {
    return `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="100"><feTurbulence type="fractalNoise" baseFrequency="${dfreq}" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" result="d"/><feTurbulence type="fractalNoise" baseFrequency="${gfreq}" numOctaves="2" seed="${seed + 3}" result="g0"/><feColorMatrix in="g0" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${a} 0 0 0 ${b}" result="g"/><feComposite in="d" in2="g" operator="in"/></filter>`;
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

  function strokeSVG(kind, variant, o) {
    o = o || {};
    const color = o.color || '#111111', size = o.size || 400;
    const isH = kind === 'highlight';
    const penKey = o.pen || (isH ? 'chisel' : 'pen');
    const pen = PENS[penKey] || PENS[isH ? 'chisel' : 'pen'];
    const w = o.width || (isH ? 34 : 7);
    const def = (isH ? HIGHLIGHT : UNDERLINE)[variant] || (isH ? HIGHLIGHT.swipe : UNDERLINE.solid);
    const id = 'sf' + (++uid), seed = variant.length * 17 + penKey.length * 5 + 3;
    const defs = pen.filter ? pen.filter(id) : '';
    const filt = pen.filter ? ` filter="url(#${id})"` : '';
    const ww = w * pen.mul;
    let body = '';

    if (isH) {
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
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size / 4}" viewBox="0 0 400 100">${defs ? '<defs>' + defs + '</defs>' : ''}${body}</svg>`;
  }

  window.STROKES = {
    svg: strokeSVG,
    kinds: {
      highlight: { label: 'highlighter', variants: Object.keys(HIGHLIGHT), pens: ['chisel', 'round', 'hbrush', 'hcrayon'], width: [10, 80, 34] },
      underline: { label: 'underline & lines', variants: Object.keys(UNDERLINE), pens: ['pen', 'felt', 'pencil', 'brush', 'chalk', 'crayon'], width: [2, 30, 7] },
    },
    pens: PENS,
  };
})();
