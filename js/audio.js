// All sound effects are synthesized live with the Web Audio API (no audio files).
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; this.master = null; this.ambient = null; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(this.ctx.destination);
    // shared noise buffer
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbient();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
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
      const mix = c.createGain(); mix.gain.value = 0.9;
      o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(mix); mix.connect(this.master);
      o.start(t0); vib.start(t0); o.stop(t0 + 0.22); vib.stop(t0 + 0.22);
    };
    const t = c.currentTime + delay;
    one(t, pitch); one(t + 0.2, pitch * 0.93);
  }

  bonk() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(1100, t); o.frequency.exponentialRampToValueAtTime(320, t + 0.09);
    const g = c.createGain(); this._env(g, t, 0.002, 0.7, 0.12); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.16);
    // juicy squish
    const n = this._noiseSrc(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.25);
    const g2 = c.createGain(); this._env(g2, t, 0.01, 0.5, 0.25); n.connect(lp); lp.connect(g2); g2.connect(this.master); n.start(t, Math.random()); n.stop(t + 0.3);
  }

  splash(vol = 0.5) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const n = this._noiseSrc(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2500, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.5);
    const g = c.createGain(); this._env(g, t, 0.01, vol, 0.5); n.connect(lp); lp.connect(g); g.connect(this.master); n.start(t, Math.random()); n.stop(t + 0.6);
  }

  thud() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const g = c.createGain(); this._env(g, t, 0.003, 0.35, 0.12); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.2);
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
    // occasional songbird chirps
    const chirp = () => {
      if (!this.muted) {
        const k = 2 + Math.floor(Math.random() * 4);
        const base = 2600 + Math.random() * 1800;
        for (let i = 0; i < k; i++) {
          const t = c.currentTime + i * (0.09 + Math.random() * 0.05);
          const o = c.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), t + 0.06);
          const gg = c.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.035, t + 0.01); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
          o.connect(gg); gg.connect(this.master); o.start(t); o.stop(t + 0.1);
        }
      }
      setTimeout(chirp, 2500 + Math.random() * 6000);
    };
    setTimeout(chirp, 2000);
  }
}
