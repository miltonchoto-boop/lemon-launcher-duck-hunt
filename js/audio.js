// All sound effects are synthesized live with the Web Audio API (no audio files).
export class Sfx {
  constructor() {
    this.ctx = null; this.master = null; this.ambient = null;
    const v = parseFloat(localStorage.getItem('lemonVol')); this.volume = isNaN(v) ? 1.0 : v;
    this.muted = localStorage.getItem('lemonMuted') === '1';
  }
  _gain() { return this.muted ? 0 : this.volume * 1.35; } // master raised (was 0.8)
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v)); localStorage.setItem('lemonVol', this.volume);
    if (this.muted && v > 0) { this.muted = false; localStorage.setItem('lemonMuted', '0'); }
    if (this.master) this.master.gain.setTargetAtTime(this._gain(), this.ctx.currentTime, 0.05);
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this._gain();
    // compressor + makeup gain = louder overall without clipping
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    const makeup = this.ctx.createGain(); makeup.gain.value = 1.6;
    this.master.connect(comp); comp.connect(makeup); makeup.connect(this.ctx.destination);
    // shared noise buffer
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbient();
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('lemonMuted', this.muted ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(this._gain(), this.ctx.currentTime, 0.05);
    return this.muted;
  }

  _noiseSrc() { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; return s; }
  _env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }

  fire() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    // pneumatic "pop": noise burst through bandpass
    const n = this._noiseSrc(); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(1400, t); bp.frequency.exponentialRampToValueAtTime(500, t + 0.15); bp.Q.value = 0.9;
    const g = c.createGain(); this._env(g, t, 0.004, 0.9, 0.18);
    n.connect(bp); bp.connect(g); g.connect(this.master); n.start(t, Math.random()); n.stop(t + 0.3);
    // low thump
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.16);
    const g2 = c.createGain(); this._env(g2, t, 0.005, 0.9, 0.17);
    o.connect(g2); g2.connect(this.master); o.start(t); o.stop(t + 0.25);
    // whoosh tail
    const n2 = this._noiseSrc(); const hp = c.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.setValueAtTime(3500, t + 0.03); hp.frequency.exponentialRampToValueAtTime(900, t + 0.4); hp.Q.value = 2;
    const g3 = c.createGain(); g3.gain.setValueAtTime(0.0001, t); g3.gain.exponentialRampToValueAtTime(0.18, t + 0.06); g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    n2.connect(hp); hp.connect(g3); g3.connect(this.master); n2.start(t, Math.random()); n2.stop(t + 0.45);
  }

  quack(pitch = 1, delay = 0) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    const one = (t0, p) => {
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(520 * p, t0); o.frequency.linearRampToValueAtTime(400 * p, t0 + 0.05); o.frequency.linearRampToValueAtTime(300 * p, t0 + 0.17);
      const vib = c.createOscillator(); vib.frequency.value = 38; const vg = c.createGain(); vg.gain.value = 25 * p; vib.connect(vg); vg.connect(o.frequency);
      const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1050; f1.Q.value = 4;
      const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2300; f2.Q.value = 5;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(1.6, t0 + 0.015); g.gain.setValueAtTime(1.4, t0 + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.setValueAtTime(260 * p, t0); o2.frequency.linearRampToValueAtTime(170 * p, t0 + 0.17);
      const f3 = c.createBiquadFilter(); f3.type = 'bandpass'; f3.frequency.value = 650; f3.Q.value = 3; const g3 = c.createGain(); g3.gain.value = 0.5;
      o2.connect(f3); f3.connect(g3); g3.connect(g);
      // raspy nasal breath
      const n = this._noiseSrc(); const nb = c.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = 1700; nb.Q.value = 2; const ng = c.createGain(); ng.gain.value = 0.35;
      n.connect(nb); nb.connect(ng); ng.connect(g);
      const mix = c.createGain(); mix.gain.value = 1.1;
      const pan = c.createStereoPanner ? c.createStereoPanner() : null;
      o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g);
      if (pan) { pan.pan.value = (Math.random() - 0.5) * 1.2; g.connect(pan); pan.connect(mix); } else g.connect(mix);
      mix.connect(this.master);
      o.start(t0); vib.start(t0); o2.start(t0); n.start(t0, Math.random()); o.stop(t0 + 0.22); vib.stop(t0 + 0.22); o2.stop(t0 + 0.22); n.stop(t0 + 0.22);
    };
    const t = c.currentTime + delay;
    one(t, pitch); one(t + 0.19, pitch * 0.93);
    if (Math.random() < 0.5) one(t + 0.38, pitch * 0.88);
  }

  bonk() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(1100, t); o.frequency.exponentialRampToValueAtTime(320, t + 0.09);
    const g = c.createGain(); this._env(g, t, 0.002, 0.9, 0.12); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.16);
    // reward sparkle (score pickup)
    [1568, 2093].forEach((f, i) => { const s = c.createOscillator(); s.type = 'sine'; s.frequency.value = f; const sg = c.createGain(); this._env(sg, t + 0.06 + i * 0.07, 0.004, 0.22, 0.18); s.connect(sg); sg.connect(this.master); s.start(t + 0.06 + i * 0.07); s.stop(t + 0.35 + i * 0.07); });
    // juicy squish
    const n = this._noiseSrc(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.25);
    const g2 = c.createGain(); this._env(g2, t, 0.01, 0.5, 0.25); n.connect(lp); lp.connect(g2); g2.connect(this.master); n.start(t, Math.random()); n.stop(t + 0.3);
  }

  splash(vol = 0.5) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const n = this._noiseSrc(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2500, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.5);
    const g = c.createGain(); this._env(g, t, 0.01, vol * 1.4, 0.55); n.connect(lp); lp.connect(g); g.connect(this.master); n.start(t, Math.random()); n.stop(t + 0.7);
    // low "plunk"
    const o = c.createOscillator(); o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.15);
    const og = c.createGain(); this._env(og, t, 0.004, vol * 0.8, 0.16); o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.22);
    // falling droplets
    for (let i = 0; i < 6; i++) this._drop(t + 0.12 + Math.random() * 0.5, vol * 0.35);
  }

  _drop(t, v) {
    const c = this.ctx; const o = c.createOscillator(); o.type = 'sine';
    const f = 900 + Math.random() * 1400; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.04);
    const g = c.createGain(); this._env(g, t, 0.002, v, 0.05); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.08);
  }

  // short soft click for menu buttons / UI
  ui() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.05);
    const g = c.createGain(); this._env(g, t, 0.003, 0.35, 0.08); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.12);
  }

  thud() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const g = c.createGain(); this._env(g, t, 0.003, 0.7, 0.14); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.2);
    // grassy rustle on impact
    const n = this._noiseSrc(); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.8;
    const g2 = c.createGain(); this._env(g2, t, 0.005, 0.3, 0.2); n.connect(bp); bp.connect(g2); g2.connect(this.master); n.start(t, Math.random()); n.stop(t + 0.3);
  }

  reload() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    [0, 0.5, 0.9].forEach((dt, i) => {
      const t = c.currentTime + dt;
      const n = this._noiseSrc(); const hp = c.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = i === 2 ? 1800 : 3200; hp.Q.value = 3;
      const g = c.createGain(); this._env(g, t, 0.002, 0.5, 0.06); n.connect(hp); hp.connect(g); g.connect(this.master); n.start(t, Math.random()); n.stop(t + 0.1);
    });
  }

  empty() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const n = this._noiseSrc(); const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000;
    const g = c.createGain(); this._env(g, t, 0.002, 0.3, 0.04); n.connect(hp); hp.connect(g); g.connect(this.master); n.start(t); n.stop(t + 0.08);
  }

  chime(up = true) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    const notes = up ? [523, 659, 784, 1047] : [440, 392, 330, 262];
    notes.forEach((f, i) => {
      const t = c.currentTime + i * 0.12;
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = c.createGain(); this._env(g, t, 0.01, 0.35, 0.35); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.4);
    });
  }

  scopeIn(on = true) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    // mechanical click + lens slide whoosh
    const o = c.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(on ? 1800 : 1300, t); o.frequency.exponentialRampToValueAtTime(on ? 600 : 400, t + 0.03);
    const g = c.createGain(); this._env(g, t, 0.001, 0.35, 0.04); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.07);
    const n = this._noiseSrc(); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(on ? 600 : 2400, t); bp.frequency.exponentialRampToValueAtTime(on ? 2400 : 600, t + 0.18);
    const g2 = c.createGain(); this._env(g2, t + 0.02, 0.03, 0.22, 0.16); n.connect(bp); bp.connect(g2); g2.connect(this.master); n.start(t, Math.random()); n.stop(t + 0.25);
  }

  angryQuack() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    this.quack(0.72); this.quack(0.68, 0.09);
    // growly distorted honk underneath
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(190, t); o.frequency.linearRampToValueAtTime(120, t + 0.35);
    const ws = c.createWaveShaper(); const cur = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cur[i] = Math.tanh(x * 6); } ws.curve = cur;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const g = c.createGain(); this._env(g, t, 0.01, 0.45, 0.35); o.connect(ws); ws.connect(lp); lp.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.4);
  }

  ouch() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.3);
    const g = c.createGain(); this._env(g, t, 0.003, 1.2, 0.35); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.4);
    const n = this._noiseSrc(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g2 = c.createGain(); this._env(g2, t, 0.002, 0.7, 0.2); n.connect(lp); lp.connect(g2); g2.connect(this.master); n.start(t, Math.random()); n.stop(t + 0.3);
  }

  tick() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 1200;
    const g = c.createGain(); this._env(g, t, 0.002, 0.12, 0.05); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.08);
  }

  startAmbient() {
    const c = this.ctx;
    // soft wind bed
    const n = this._noiseSrc(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const g = c.createGain(); g.gain.value = 0.05;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.12; const lg = c.createGain(); lg.gain.value = 0.025; lfo.connect(lg); lg.connect(g.gain);
    n.connect(lp); lp.connect(g); g.connect(this.master); n.start(); lfo.start();
    // gentle water lapping: band-passed noise with slow swells
    const wn = this._noiseSrc(); const wb = c.createBiquadFilter(); wb.type = 'bandpass'; wb.frequency.value = 520; wb.Q.value = 0.7;
    const wg = c.createGain(); wg.gain.value = 0.045;
    const wl = c.createOscillator(); wl.frequency.value = 0.35; const wlg = c.createGain(); wlg.gain.value = 0.035; wl.connect(wlg); wlg.connect(wg.gain);
    wn.connect(wb); wb.connect(wg); wg.connect(this.master); wn.start(0, 0.7); wl.start();
    const lap = () => { if (!this.muted) for (let i = 0; i < 2 + Math.random() * 3; i++) this._drop(c.currentTime + Math.random() * 0.6, 0.04); setTimeout(lap, 900 + Math.random() * 2200); };
    setTimeout(lap, 1500);
    // distant duck chatter
    const far = () => { if (!this.muted) { const gq = this.master; this.master = this._far || (this._far = (() => { const f = c.createGain(); f.gain.value = 0.18; const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 1800; f.connect(lp2); lp2.connect(gq); return f; })()); this.quack(0.9 + Math.random() * 0.3); this.master = gq; } setTimeout(far, 7000 + Math.random() * 12000); };
    setTimeout(far, 5000);
    // occasional songbird chirps
    const chirp = () => {
      if (!this.muted) {
        const k = 2 + Math.floor(Math.random() * 4);
        const base = 2600 + Math.random() * 1800;
        for (let i = 0; i < k; i++) {
          const t = c.currentTime + i * (0.09 + Math.random() * 0.05);
          const o = c.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), t + 0.06);
          const gg = c.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.06, t + 0.01); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
          o.connect(gg); gg.connect(this.master); o.start(t); o.stop(t + 0.1);
        }
      }
      setTimeout(chirp, 1500 + Math.random() * 4500);
    };
    setTimeout(chirp, 2000);
  }
}
