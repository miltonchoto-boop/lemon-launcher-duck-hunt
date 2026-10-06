// Procedurally painted textures (canvas) for the lemon, mallard plumage, feathers, grass and particles.
import * as THREE from 'three';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
const rnd = (a, b) => a + Math.random() * (b - a);

function tex(c, { srgb = true, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// ---------- Lemon peel ----------
export function makeLemonTextures() {
  const W = 512, H = 256;
  const [c, x] = canvas(W, H);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#c9b81c'); g.addColorStop(0.1, '#f0d21c'); g.addColorStop(0.5, '#f7da22'); g.addColorStop(0.9, '#f0d21c'); g.addColorStop(1, '#c2b31e');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 2500; i++) {
    const l = rnd(-1, 1);
    x.fillStyle = l > 0 ? `rgba(255,240,120,${rnd(0.03, 0.12)})` : `rgba(190,150,0,${rnd(0.03, 0.1)})`;
    x.beginPath(); x.arc(rnd(0, W), rnd(0, H), rnd(1, 7), 0, 7); x.fill();
  }
  // tiny oil glands
  for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(170,130,0,${rnd(0.05, 0.18)})`; x.fillRect(rnd(0, W), rnd(0, H), 1.2, 1.2); }
  const color = tex(c);

  // bump (pores)
  const [b, y] = canvas(W, H);
  y.fillStyle = '#909090'; y.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    const r = rnd(0.8, 2.6);
    const gr = y.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, 'rgba(20,20,20,0.75)'); gr.addColorStop(1, 'rgba(20,20,20,0)');
    y.save(); y.translate(rnd(0, W), rnd(0, H)); y.fillStyle = gr; y.beginPath(); y.arc(0, 0, r, 0, 7); y.fill(); y.restore();
  }
  for (let i = 0; i < 400; i++) { y.fillStyle = `rgba(255,255,255,${rnd(0.03, 0.08)})`; y.beginPath(); y.arc(rnd(0, W), rnd(0, H), rnd(4, 14), 0, 7); y.fill(); }
  const bump = tex(b, { srgb: false });
  return { color, bump };
}

// ---------- Mallard plumage ----------
function vermiculate(x, W, H, y0, y1, base, line, n) {
  x.fillStyle = base; x.fillRect(0, y0, W, y1 - y0);
  x.strokeStyle = line; x.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const sx = rnd(0, W), sy = rnd(y0, y1); x.globalAlpha = rnd(0.25, 0.6);
    x.beginPath(); x.moveTo(sx, sy);
    const len = rnd(10, 26);
    for (let k = 1; k <= 6; k++) x.lineTo(sx + (len * k) / 6, sy + Math.sin(k * 1.7 + sx) * 1.3);
    x.stroke();
  }
  x.globalAlpha = 1;
}

function scallops(x, W, y0, y1, base, edge, dark, rowH, w) {
  x.fillStyle = base; x.fillRect(0, y0, W, y1 - y0);
  let row = 0;
  for (let yy = y0; yy < y1 + rowH; yy += rowH) {
    for (let xx = (row % 2) * w * 0.5 - w; xx < W + w; xx += w) {
      const jx = xx + rnd(-2, 2), jy = yy + rnd(-2, 2);
      x.fillStyle = edge; x.beginPath(); x.ellipse(jx, jy, w * 0.55, rowH * 0.9, 0, 0, Math.PI); x.fill();
      x.fillStyle = dark; x.beginPath(); x.ellipse(jx, jy - 1, w * 0.42, rowH * 0.7, 0, 0, Math.PI); x.fill();
    }
    row++;
  }
}

export function makeDuckTextures() {
  const out = {};
  // Drake body: brown-gray back, finely vermiculated gray flanks, pale belly. Canvas top = sphere top (back).
  {
    const W = 512, H = 512; const [c, x] = canvas(W, H);
    vermiculate(x, W, H, 0, H, '#97968f', '#4a4944', 6000);
    let g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(92,78,58,0.95)'); g.addColorStop(0.22, 'rgba(110,96,76,0.6)'); g.addColorStop(0.36, 'rgba(110,96,76,0)');
    g.addColorStop(0.75, 'rgba(230,228,220,0)'); g.addColorStop(1, 'rgba(232,230,222,0.85)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    out.drakeBody = tex(c);
  }
  // Drake chest: chestnut with fine scallops
  {
    const W = 256, H = 256; const [c, x] = canvas(W, H);
    scallops(x, W, 0, H, '#5a2c18', '#7a4228', '#5c2d19', 9, 16);
    out.drakeChest = tex(c);
  }
  // Hen body: mottled brown, dark feather centers with buff edges
  {
    const W = 512, H = 512; const [c, x] = canvas(W, H);
    x.fillStyle = '#9a7a52'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) {
      const px = rnd(0, W), py = rnd(0, H), s = rnd(7, 15), a = rnd(-0.4, 0.4);
      x.fillStyle = `rgb(${rnd(190, 215)|0},${rnd(160, 180)|0},${rnd(115, 135)|0})`;
      x.beginPath(); x.ellipse(px, py, s, s * 0.62, a, 0, 7); x.fill();
      x.fillStyle = `rgb(${rnd(60, 85)|0},${rnd(42, 56)|0},${rnd(26, 36)|0})`;
      x.beginPath(); x.ellipse(px, py, s * 0.7, s * 0.36, a, 0, 7); x.fill();
    }
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(60,44,28,0.35)'); g.addColorStop(0.4, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(210,190,150,0.45)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    out.henBody = tex(c);
  }
  // Hen head: fine streaks, dark crown & eye stripe
  {
    const W = 256, H = 256; const [c, x] = canvas(W, H);
    x.fillStyle = '#b08f66'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(70,50,30,${rnd(0.2, 0.5)})`; x.fillRect(rnd(0, W), rnd(0, H), rnd(2, 5), 1); }
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(60,42,25,0.9)'); g.addColorStop(0.28, 'rgba(60,42,25,0.6)'); g.addColorStop(0.4, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    out.henHead = tex(c);
  }
  // Wings: u = span (root->tip), v = chord (leading->trailing)
  const wing = (hen) => {
    const W = 512, H = 256; const [c, x] = canvas(W, H);
    const cov = hen ? '#86694a' : '#6f685d', prim = hen ? '#5e4a35' : '#4a4540';
    let g = x.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, cov); g.addColorStop(0.45, cov); g.addColorStop(0.62, prim); g.addColorStop(1, prim);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // covert rows
    for (let r = 0; r < 5; r++) {
      const yy = 20 + r * 22;
      for (let xx = 0; xx < W * 0.6; xx += 14) {
        x.fillStyle = hen ? `rgba(200,170,120,${rnd(0.2, 0.4)})` : `rgba(185,180,170,${rnd(0.15, 0.3)})`;
        x.beginPath(); x.ellipse(xx + rnd(-2, 2), yy, 8, 12, 0.3, 0, Math.PI); x.fill();
      }
    }
    // speculum: white - blue - white bands near trailing edge of inner wing
    const sy = H * 0.66;
    x.fillStyle = '#f2f2ee'; x.fillRect(0, sy - 12, W * 0.5, 7);
    const sg = x.createLinearGradient(0, sy - 5, 0, sy + 26); sg.addColorStop(0, '#3346c9'); sg.addColorStop(0.5, '#4b2fb0'); sg.addColorStop(1, '#2338a8');
    x.fillStyle = sg; x.fillRect(0, sy - 5, W * 0.5, 31);
    x.fillStyle = '#f2f2ee'; x.fillRect(0, sy + 26, W * 0.5, 8);
    x.fillStyle = hen ? '#6b553e' : '#6e665c'; x.fillRect(0, sy + 34, W * 0.5, H - sy - 34);
    // flight-feather separations: lines along chord, slanting toward tip
    x.strokeStyle = 'rgba(25,20,15,0.55)'; x.lineWidth = 1.5;
    for (let i = 0; i < 26; i++) {
      const u = (i / 26) * W; x.beginPath(); x.moveTo(u, H * 0.42); x.lineTo(u + 18 + (u / W) * 40, H); x.stroke();
    }
    x.strokeStyle = 'rgba(255,255,255,0.12)'; x.lineWidth = 1;
    for (let i = 0; i < 26; i++) { const u = (i / 26) * W + 4; x.beginPath(); x.moveTo(u, H * 0.42); x.lineTo(u + 18 + (u / W) * 40, H); x.stroke(); }
    return tex(c);
  };
  out.drakeWing = wing(false);
  out.henWing = wing(true);
  return out;
}

// Single feather with alpha (white, tinted per instance)
export function makeFeatherTexture() {
  const W = 64, H = 192; const [c, x] = canvas(W, H);
  x.translate(W / 2, H);
  x.fillStyle = '#ffffff';
  x.beginPath(); x.moveTo(0, -4);
  x.bezierCurveTo(26, -50, 22, -150, 0, -188);
  x.bezierCurveTo(-22, -150, -26, -50, 0, -4); x.fill();
  // barbs
  x.strokeStyle = 'rgba(120,120,120,0.35)'; x.lineWidth = 1;
  for (let i = 0; i < 40; i++) { const yy = -10 - i * 4.3; x.beginPath(); x.moveTo(0, yy); x.lineTo(16, yy - 10); x.moveTo(0, yy); x.lineTo(-16, yy - 10); x.stroke(); }
  // shaft
  x.strokeStyle = 'rgba(90,90,90,0.8)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -184); x.stroke();
  // fluffy base
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 30; i++) { x.beginPath(); x.arc(rnd(-14, 14), rnd(-10, -40), rnd(1, 3), 0, 7); x.fill(); }
  const t = tex(c); return t;
}

// Soft round particle sprite
export function makeSoftDot() {
  const S = 64; const [c, x] = canvas(S, S);
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return tex(c, { srgb: false });
}

// Grass clump card (alpha-tested)
export function makeGrassBlades() {
  const W = 256, H = 256; const [c, x] = canvas(W, H);
  for (let i = 0; i < 70; i++) {
    const bx = rnd(10, W - 10), h = rnd(H * 0.45, H * 0.98), lean = rnd(-40, 40), w = rnd(3, 7);
    const g = x.createLinearGradient(0, H, 0, H - h);
    const tone = rnd(0, 1);
    g.addColorStop(0, '#2c4515'); g.addColorStop(0.5, tone > 0.5 ? '#5d8a2a' : '#6f9532'); g.addColorStop(1, tone > 0.7 ? '#a7b45a' : '#86a63e');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(bx - w, H); x.quadraticCurveTo(bx + lean * 0.3, H - h * 0.6, bx + lean, H - h); x.quadraticCurveTo(bx + lean * 0.3 + w * 0.5, H - h * 0.6, bx + w, H); x.fill();
  }
  return tex(c);
}

// Metal brushed roughness/bump for the launcher
export function makeBrushed() {
  const W = 256, H = 256; const [c, x] = canvas(W, H);
  x.fillStyle = '#888'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},0.04)`; x.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'; x.fillRect(0, rnd(0, H), W, rnd(0.5, 1.5)); }
  for (let i = 0; i < 60; i++) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.beginPath(); x.arc(rnd(0, W), rnd(0, H), rnd(1, 4), 0, 7); x.fill(); }
  return tex(c, { srgb: false, repeat: [1, 3] });
}

// Painted decal band texture (lime body with yellow lemon stripe) for the launcher tube
export function makeLauncherPaint() {
  const W = 512, H = 512; const [c, x] = canvas(W, H);
  x.fillStyle = '#4a6e19'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 3000; i++) { x.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'; x.fillRect(rnd(0, W), rnd(0, H), rnd(1, 3), rnd(1, 3)); }
  // chipped paint edges
  for (let i = 0; i < 70; i++) { x.fillStyle = 'rgba(160,160,150,0.6)'; x.beginPath(); x.ellipse(rnd(0, W), rnd(0, H), rnd(1, 4), rnd(1, 2.5), rnd(0, 3), 0, 7); x.fill(); }
  // yellow stripe (around tube: v direction is along tube length)
  x.fillStyle = '#f2cf12'; x.fillRect(0, H * 0.18, W, H * 0.07);
  x.fillStyle = '#f2cf12'; x.fillRect(0, H * 0.28, W, H * 0.025);
  x.fillStyle = '#1a2a08'; x.font = 'bold 34px Trebuchet MS, sans-serif'; x.textAlign = 'center';
  x.save(); x.translate(W * 0.25, H * 0.6); x.rotate(-Math.PI / 2); x.fillStyle = 'rgba(242,207,18,0.9)'; x.fillText('LEMON-1', 0, 0); x.restore();
  return tex(c);
}
