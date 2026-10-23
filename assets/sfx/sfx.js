// Sound-effects library for the timeline. Writing and page-flip sounds are real CC0 recordings
// (assets/sfx/audio, credits in assets/sfx/CREDITS.md); chimes, pops and clicks are synthesized with Web Audio.
//   SFX.list                   -> [{ id, group, name, desc, dur }]
//   await SFX.render(id)       -> AudioBuffer (cached)
//   SFX.wav(audioBuffer)       -> Blob (16-bit PCM WAV, what the timeline stores and exports)
(function () {
  const SR = 44100;

  function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function noise(ctx, dur, seed) {
    const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0), r = rng(seed);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b; return s;
  }
  const filt = (ctx, type, f, q = 1) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const gain = (ctx, v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };

  // Hand-writing: a run of short strokes of filtered noise, each with its own loudness and tone.
  function writing(ctx, o) {
    const r = rng(o.seed), n = noise(ctx, o.dur, o.seed + 1), bp = filt(ctx, 'bandpass', o.freq, o.q), g = gain(ctx, 0);
    chain(n, filt(ctx, 'highpass', o.hp), bp, g, ctx.destination); n.start();
    const sq = o.squeak ? (() => { const osc = ctx.createOscillator(), sg = gain(ctx, 0); osc.type = 'triangle'; osc.frequency.value = o.squeak; chain(osc, filt(ctx, 'bandpass', o.squeak, 6), sg, ctx.destination); osc.start(); return { osc, sg }; })() : null;
    let t = .05;
    while (t < o.dur - .25) {
      const len = o.min + r() * (o.max - o.min), peak = o.gain * (.55 + r() * .45), f0 = o.freq * (.8 + r() * .5), f1 = o.freq * (.8 + r() * .5);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + .02);
      g.gain.linearRampToValueAtTime(peak * (.5 + r() * .5), t + len * .55); g.gain.linearRampToValueAtTime(0, t + len);
      bp.frequency.setValueAtTime(f0, t); bp.frequency.linearRampToValueAtTime(f1, t + len);
      if (sq) {
        sq.sg.gain.setValueAtTime(0, t); sq.sg.gain.linearRampToValueAtTime(o.squeakGain * (.4 + r() * .6), t + len * .3); sq.sg.gain.linearRampToValueAtTime(0, t + len);
        sq.osc.frequency.setValueAtTime(o.squeak * (.9 + r() * .2), t); sq.osc.frequency.linearRampToValueAtTime(o.squeak * (.85 + r() * .3), t + len);
      }
      t += len + o.gap * (.4 + r() * 1.2);
    }
  }
  // a short decaying sine / triangle tone
  function tone(ctx, f, t, len, vol, type = 'sine', f2) {
    const o = ctx.createOscillator(), g = gain(ctx, 0); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + len);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    chain(o, g, ctx.destination); o.start(t); o.stop(t + len + .02);
  }

  const DEFS = [
    // Real recordings (CC0, see assets/sfx/CREDITS.md): `src` is fetched and decoded instead of synthesized.
    { id: 'writing-1', group: 'Writing', name: 'Writing on paper 1', desc: 'Pencil / marker on paper', dur: 3.5, src: 'assets/sfx/audio/writing-1.mp3' },
    { id: 'writing-2', group: 'Writing', name: 'Writing on paper 2', desc: 'Pencil / marker on paper', dur: 3.5, src: 'assets/sfx/audio/writing-2.mp3' },
    { id: 'writing-3', group: 'Writing', name: 'Writing on paper 3', desc: 'Faster strokes on paper', dur: 3.5, src: 'assets/sfx/audio/writing-3.mp3' },
    { id: 'scribble', group: 'Writing', name: 'Pencil scribble', desc: 'Pencil on cardboard', dur: 3.5, src: 'assets/sfx/audio/scribble.mp3' },
    { id: 'pencil-short', group: 'Writing', name: 'Short pencil stroke', desc: 'One quick line', dur: 1.07, src: 'assets/sfx/audio/pencil-short.mp3' },
    { id: 'page-flip-1', group: 'Motion', name: 'Page flip 1', desc: 'Book page turning', dur: .75, src: 'assets/sfx/audio/page-flip-1.mp3' },
    { id: 'page-flip-2', group: 'Motion', name: 'Page flip 2', desc: 'Book page turning', dur: 1.11, src: 'assets/sfx/audio/page-flip-2.mp3' },
    { id: 'page-flip-3', group: 'Motion', name: 'Page flip 3', desc: 'Book page turning', dur: 1.09, src: 'assets/sfx/audio/page-flip-3.mp3' },
    { id: 'pop', group: 'Pops & clicks', name: 'Pop', desc: 'Soft bubble pop, for items appearing', dur: .25,
      fn: ctx => { tone(ctx, 700, 0, .14, .7, 'sine', 160); const n = noise(ctx, .02, 51), g = gain(ctx, .3); chain(n, filt(ctx, 'highpass', 2500), g, ctx.destination); n.start(); g.gain.exponentialRampToValueAtTime(.001, .02); } },
    { id: 'click', group: 'Pops & clicks', name: 'Click', desc: 'Light tick, for buttons and steps', dur: .12,
      fn: ctx => { tone(ctx, 1900, 0, .045, .5, 'square'); const n = noise(ctx, .01, 52), g = gain(ctx, .4); chain(n, filt(ctx, 'highpass', 3000), g, ctx.destination); n.start(); } },
    { id: 'ding', group: 'Chimes', name: 'Ding', desc: 'Bell, to highlight a point', dur: 1.6,
      fn: ctx => { tone(ctx, 1318.5, 0, 1.5, .55); tone(ctx, 2637, 0, .8, .22); tone(ctx, 3951, 0, .4, .08); } },
    { id: 'success', group: 'Chimes', name: 'Success chime', desc: 'Rising four-note arpeggio', dur: 1.4,
      fn: ctx => [1046.5, 1318.5, 1568, 2093].forEach((f, i) => { tone(ctx, f, i * .11, i === 3 ? .9 : .35, .38, 'triangle'); tone(ctx, f * 2, i * .11, .25, .08); }) },
    { id: 'sparkle', group: 'Chimes', name: 'Sparkle', desc: 'Twinkle, for reveals', dur: 1.2,
      fn: ctx => { const r = rng(61); for (let i = 0; i < 14; i++) tone(ctx, 2200 + r() * 4200, i * .06 + r() * .03, .22 + r() * .2, .13 * (1 - i / 18), 'sine'); } },
    { id: 'buzz', group: 'Chimes', name: 'Wrong buzz', desc: 'Two low buzzes, for a mistake', dur: .7,
      fn: ctx => [0, .3].forEach(t => { const o = ctx.createOscillator(), g = gain(ctx, 0), lp = filt(ctx, 'lowpass', 900); o.type = 'sawtooth'; o.frequency.value = 130;
        chain(o, lp, g, ctx.destination); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.35, t + .02); g.gain.setValueAtTime(.35, t + .2); g.gain.linearRampToValueAtTime(0, t + .24); o.start(t); o.stop(t + .26); }) },
  ];

  const cache = new Map();
  async function render(id) {
    if (cache.has(id)) return cache.get(id);
    const d = DEFS.find(x => x.id === id); if (!d) throw new Error('unknown sound ' + id);
    let buf;
    if (d.src) {
      const res = await fetch(d.src); if (!res.ok) throw new Error('could not load ' + d.src);
      buf = await new OfflineAudioContext(1, 1, SR).decodeAudioData(await res.arrayBuffer());
    } else {
      const ctx = new OfflineAudioContext(1, Math.ceil(SR * d.dur), SR);
      d.fn(ctx);
      buf = await ctx.startRendering();
      // normalise to a comfortable peak and fade the last few ms so nothing clicks at the end
      const data = buf.getChannelData(0); let m = 0; for (let i = 0; i < data.length; i++) m = Math.max(m, Math.abs(data[i]));
      const k = m > 0 ? .8 / m : 1, fade = Math.min(data.length, Math.floor(SR * .012));
      for (let i = 0; i < data.length; i++) data[i] *= k * (i > data.length - fade ? (data.length - i) / fade : 1);
    }
    cache.set(id, buf); return buf;
  }
  function wav(buf) {
    const d = buf.getChannelData(0), n = d.length, out = new DataView(new ArrayBuffer(44 + n * 2));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
    return new Blob([out.buffer], { type: 'audio/wav' });
  }

  window.SFX = { list: DEFS.map(({ id, group, name, desc, dur }) => ({ id, group, name, desc, dur })), render, wav };
})();
