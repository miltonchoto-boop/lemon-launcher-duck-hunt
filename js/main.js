// Lemon Launcher: Duck Hunt — main game module.
import * as THREE from 'three';
import { buildWorld, terrainHeight, POND, PLAYER_BOUNDS } from './world.js';
import { createDuck, flapDuck } from './duck.js';
import { makeLemonTextures, makeFeatherTexture, makeSoftDot, makeBrushed, makeLauncherPaint } from './textures.js';
import { Sfx } from './audio.js';

// ======================= constants =======================
const ROUND_TIME = 60;
const MAG_SIZE = 8;
const RELOAD_TIME = 1.25;
const FIRE_COOLDOWN = 0.28;
const LEMON_SPEED = 72;
const LEMON_GRAVITY = 4.0;
const DUCK_SCALE = 2.3;
const HIT_RADIUS = 1.6;
const EYE_HEIGHT = 1.7;
const BEST_KEY = 'lemonLauncherDuckHunt.best';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ======================= renderer / scene =======================
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.55;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.03, 12000);
camera.rotation.order = 'YXZ';
scene.add(camera);

const manager = new THREE.LoadingManager();
const loader = new THREE.TextureLoader(manager);
manager.onProgress = (_u, done, total) => { $('load-bar').style.width = `${(done / total) * 100}%`; };

const world = buildWorld(renderer, scene, loader);
const sfx = new Sfx();

// ======================= launcher (first-person weapon) =======================
const launcher = new THREE.Group();
const launcherRest = new THREE.Vector3(0.3, -0.29, -0.52);
launcher.position.copy(launcherRest);
camera.add(launcher);
const muzzle = new THREE.Object3D();
let loadedLemon;
{
  const paint = makeLauncherPaint(), brushed = makeBrushed();
  const bodyMat = new THREE.MeshPhysicalMaterial({ map: paint, roughnessMap: brushed, roughness: 0.6, metalness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const steel = new THREE.MeshPhysicalMaterial({ color: 0x8c8f93, metalness: 1, roughness: 0.32, roughnessMap: brushed });
  const gunmetal = new THREE.MeshPhysicalMaterial({ color: 0x2c2f33, metalness: 0.9, roughness: 0.42, roughnessMap: brushed });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.92 });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd8b04a, metalness: 1, roughness: 0.28 });
  const inside = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.9, side: THREE.BackSide });
  const yellow = new THREE.MeshPhysicalMaterial({ color: 0xf2cf12, roughness: 0.4, clearcoat: 0.8 });

  const L = 1.05, R = 0.058;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 40, 1, true), bodyMat); tube.rotation.x = Math.PI / 2; launcher.add(tube);
  const tubeIn = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.86, R * 0.86, L, 24, 1, true), inside); tubeIn.rotation.x = Math.PI / 2; launcher.add(tubeIn);
  // flared muzzle bell (front, -z) and venturi (rear, +z)
  const lathe = (pts, mat, z, flip) => {
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 40);
    const m = new THREE.Mesh(g, mat); m.rotation.x = flip ? Math.PI / 2 : -Math.PI / 2; m.position.z = z; m.material.side = THREE.DoubleSide; launcher.add(m); return m;
  };
  lathe([[R * 0.98, 0], [R * 1.12, 0.03], [R * 1.25, 0.09], [R * 1.42, 0.14], [R * 1.4, 0.152], [R * 0.9, 0.152]], steel.clone(), -L / 2, false);
  lathe([[R * 0.98, 0], [R * 1.05, 0.04], [R * 1.5, 0.14], [R * 1.65, 0.2], [R * 1.6, 0.21], [R * 1.2, 0.21]], gunmetal.clone(), L / 2, true);
  // clamp rings
  for (const z of [-0.36, -0.05, 0.3]) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.1, R * 1.1, 0.035, 40), steel); ring.rotation.x = Math.PI / 2; ring.position.z = z; launcher.add(ring); }
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.05, 40), yellow); stripe.rotation.x = Math.PI / 2; stripe.position.z = -0.44; launcher.add(stripe);
  // pistol grip + trigger guard + foregrip
  const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.1, 6, 12), rubber); grip.position.set(0, -0.12, 0.12); grip.rotation.x = 0.28; launcher.add(grip);
  const gripMount = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.12), gunmetal); gripMount.position.set(0, -0.065, 0.1); launcher.add(gripMount);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 8, 20, Math.PI), gunmetal); guard.position.set(0, -0.09, 0.04); guard.rotation.set(0, Math.PI / 2, Math.PI); launcher.add(guard);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.03, 0.01), brass); trigger.position.set(0, -0.085, 0.045); trigger.rotation.x = 0.3; launcher.add(trigger);
  const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.07, 6, 12), rubber); fore.position.set(0, -0.1, -0.22); launcher.add(fore);
  const foreMount = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.06), gunmetal); foreMount.position.set(0, -0.065, -0.22); launcher.add(foreMount);
  // optic on the left/top so it does not block the view
  const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.14), gunmetal); sightBase.position.set(-0.05, 0.065, -0.05); launcher.add(sightBase);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 24), gunmetal); scope.rotation.x = Math.PI / 2; scope.position.set(-0.05, 0.1, -0.05); launcher.add(scope);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.019, 24), new THREE.MeshPhysicalMaterial({ color: 0x0c1626, metalness: 0.3, roughness: 0.05, clearcoat: 1, iridescence: 0.6 }));
  lens.position.set(-0.05, 0.1, 0.0201); launcher.add(lens);
  // shoulder pad
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.16), rubber); pad.position.set(0, -0.07, 0.36); launcher.add(pad);
  muzzle.position.set(0, 0, -L / 2 - 0.16); launcher.add(muzzle);
  launcher.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
}

// ======================= lemon projectile =======================
const lemonTex = makeLemonTextures();
const lemonGeo = (() => {
  const g = new THREE.SphereGeometry(1, 36, 28);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = Math.abs(y);
    const pinch = 1 - 0.08 * Math.pow(t, 4);
    y = y * 1.22 + Math.sign(y) * 0.2 * Math.pow(t, 10); // pointed nub at each end
    p.setXYZ(i, x * pinch, y, z * pinch);
  }
  g.computeVertexNormals();
  g.scale(0.085, 0.085, 0.085);
  return g;
})();
const lemonMat = new THREE.MeshPhysicalMaterial({
  map: lemonTex.color, bumpMap: lemonTex.bump, bumpScale: 1.2, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.35, sheen: 0.2, sheenColor: new THREE.Color(0xfff2a0),
});
loadedLemon = new THREE.Mesh(lemonGeo, lemonMat);
loadedLemon.rotation.x = Math.PI / 2; loadedLemon.scale.setScalar(0.62); loadedLemon.position.set(0, 0, -0.5);
launcher.add(loadedLemon);

const lemons = [];
const UP = new THREE.Vector3(0, 1, 0);

// ======================= particles =======================
const softDot = makeSoftDot();
class ParticleSystem {
  constructor(cap) {
    this.cap = cap; this.i = 0;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
    this.p = Array.from({ length: cap }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, s0: 0, s1: 0, a0: 0, g: 0, drag: 0 }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: softDot }, uScale: { value: 400 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 pcolor; uniform float uScale; varying vec3 vC; varying float vA;
        void main(){ vC = pcolor; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA;
        void main(){ float a = texture2D(map, gl_PointCoord).a * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC, a); }`,
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false; this.geo = geo;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, color, a0 = 1, g = 0, drag = 0) {
    const k = this.i; this.i = (this.i + 1) % this.cap;
    const p = this.p[k]; p.life = life; p.max = life; p.vx = vx; p.vy = vy; p.vz = vz; p.s0 = s0; p.s1 = s1; p.a0 = a0; p.g = g; p.drag = drag;
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.col[k * 3] = color.r; this.col[k * 3 + 1] = color.g; this.col[k * 3 + 2] = color.b;
  }
  update(dt) {
    for (let k = 0; k < this.cap; k++) {
      const p = this.p[k];
      if (p.life <= 0) { this.alpha[k] = 0; this.size[k] = 0; continue; }
      p.life -= dt;
      const t = 1 - p.life / p.max;
      const f = Math.max(0, 1 - p.drag * dt);
      p.vx *= f; p.vy = p.vy * f - p.g * dt; p.vz *= f;
      this.pos[k * 3] += p.vx * dt; this.pos[k * 3 + 1] += p.vy * dt; this.pos[k * 3 + 2] += p.vz * dt;
      this.size[k] = p.s0 + (p.s1 - p.s0) * t;
      this.alpha[k] = p.a0 * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
    }
    for (const n of ['position', 'pcolor', 'size', 'alpha']) this.geo.attributes[n].needsUpdate = true;
  }
}
const particles = new ParticleSystem(3000);

// Feathers: instanced tumbling feather cards
const FEATHER_CAP = 500;
const featherTex = makeFeatherTexture();
const featherMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.2), new THREE.MeshStandardMaterial({ map: featherTex, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.8 }), FEATHER_CAP);
featherMesh.frustumCulled = false; featherMesh.castShadow = false;
scene.add(featherMesh);
const feathers = Array.from({ length: FEATHER_CAP }, () => ({ life: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), s: 1, ph: 0 }));
let featherIdx = 0;
const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
for (let i = 0; i < FEATHER_CAP; i++) { featherMesh.setMatrixAt(i, zeroM); featherMesh.setColorAt(i, new THREE.Color(1, 1, 1)); }
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
const drakeFeatherCols = [0x9c9b95, 0xb5b3ac, 0xe8e6df, 0x6b3a22, 0x0e5228, 0x55504a, 0xf0efe8].map((c) => new THREE.Color(c));
const henFeatherCols = [0x9a7a52, 0x6b5238, 0xc9a877, 0x4a3420, 0xe0cfa9].map((c) => new THREE.Color(c));
function emitFeathers(pos, n, hen, baseVel) {
  const cols = hen ? henFeatherCols : drakeFeatherCols;
  for (let i = 0; i < n; i++) {
    const f = feathers[featherIdx]; const k = featherIdx; featherIdx = (featherIdx + 1) % FEATHER_CAP;
    f.life = rand(3.5, 6); f.max = f.life; f.pos.copy(pos);
    f.vel.set(rand(-1, 1), rand(-0.4, 1.2), rand(-1, 1)).normalize().multiplyScalar(rand(2, 7));
    if (baseVel) f.vel.addScaledVector(baseVel, 0.25);
    f.rot.set(rand(0, 6), rand(0, 6), rand(0, 6)); f.spin.set(rand(-6, 6), rand(-6, 6), rand(-6, 6)); f.s = rand(1.2, 2.4); f.ph = rand(0, 6);
    featherMesh.setColorAt(k, cols[(Math.random() * cols.length) | 0]);
  }
  featherMesh.instanceColor.needsUpdate = true;
}
function updateFeathers(dt, time) {
  for (let i = 0; i < FEATHER_CAP; i++) {
    const f = feathers[i];
    if (f.life <= 0) continue;
    f.life -= dt;
    const drag = Math.max(0, 1 - 2.6 * dt);
    f.vel.multiplyScalar(drag); f.vel.y -= 1.4 * dt;
    if (f.vel.y < -0.7) f.vel.y = -0.7; // gentle terminal fall
    f.pos.addScaledVector(f.vel, dt);
    f.pos.x += Math.sin(time * 2.2 + f.ph) * 0.5 * dt; f.pos.z += Math.cos(time * 1.7 + f.ph) * 0.4 * dt;
    const ground = groundOrWater(f.pos.x, f.pos.z) + 0.02;
    if (f.pos.y < ground) { f.pos.y = ground; f.vel.set(0, 0, 0); f.spin.multiplyScalar(0.9); }
    f.rot.x += f.spin.x * dt; f.rot.y += f.spin.y * dt; f.rot.z += f.spin.z * dt;
    const sc = f.s * (f.life < 0.6 ? f.life / 0.6 : 1);
    tmpQ.setFromEuler(f.rot); tmpS.set(sc, sc, sc);
    tmpM.compose(f.pos, tmpQ, tmpS);
    featherMesh.setMatrixAt(i, f.life > 0 ? tmpM : zeroM);
  }
  featherMesh.instanceMatrix.needsUpdate = true;
}

const C = (hex) => new THREE.Color(hex);
const JUICE = [C(0xfff27a), C(0xffe23a), C(0xfff9c8), C(0xf6d000)];
const MIST = C(0xfffbe0), WATER_WHITE = C(0xe8f2f4), DUST = C(0x9c8a64), SMOKE = C(0xdedad0);

function juiceBurst(p, vel, scale = 1) {
  for (let i = 0; i < 70 * scale; i++) {
    tmpV.set(rand(-1, 1), rand(-0.6, 1), rand(-1, 1)).normalize().multiplyScalar(rand(2, 9));
    if (vel) tmpV.addScaledVector(vel, 0.06);
    particles.emit(p.x, p.y, p.z, tmpV.x, tmpV.y, tmpV.z, rand(0.5, 1.1), rand(0.12, 0.24), rand(0.05, 0.1), JUICE[(Math.random() * 4) | 0], 1, 9, 0.6);
  }
  for (let i = 0; i < 18 * scale; i++) {
    tmpV.set(rand(-1, 1), rand(-0.5, 1), rand(-1, 1)).multiplyScalar(rand(0.5, 2.5));
    particles.emit(p.x, p.y, p.z, tmpV.x, tmpV.y, tmpV.z, rand(0.7, 1.4), rand(0.5, 0.9), rand(2.2, 3.8), MIST, 0.5, -0.2, 1.5);
  }
}
function waterSplash(p, big = 1) {
  for (let i = 0; i < 60 * big; i++) {
    const a = rand(0, 6.28), r = rand(0.5, 3) * big;
    particles.emit(p.x, 0.1, p.z, Math.cos(a) * r, rand(2.5, 6) * Math.sqrt(big), Math.sin(a) * r, rand(0.6, 1.2), rand(0.07, 0.14), rand(0.04, 0.08), WATER_WHITE, 0.9, 12, 0.3);
  }
  for (let i = 0; i < 10 * big; i++) {
    const a = rand(0, 6.28);
    particles.emit(p.x + Math.cos(a) * 0.4, 0.15, p.z + Math.sin(a) * 0.4, Math.cos(a) * 1.2, 0.3, Math.sin(a) * 1.2, rand(0.8, 1.4), 0.4, 2.2 * big, WATER_WHITE, 0.35, 0, 1.5);
  }
}
function dustPuff(p) {
  for (let i = 0; i < 14; i++) {
    const a = rand(0, 6.28);
    particles.emit(p.x, p.y + 0.1, p.z, Math.cos(a) * rand(0.5, 2), rand(0.3, 1.2), Math.sin(a) * rand(0.5, 2), rand(0.6, 1.2), 0.3, 1.4, DUST, 0.4, -0.1, 1.8);
  }
}

function groundOrWater(x, z) {
  const h = terrainHeight(x, z);
  return Math.hypot(x - POND.x, z - POND.z) < POND.r + 2 ? Math.max(h, 0.02) : h;
}

// ======================= ducks =======================
const ducks = [];
function spawnDuck(attract = false, force = null) {
  const lvl = attract ? 1 : game.level;
  const hen = force && force.hen !== undefined ? force.hen : Math.random() < 0.35;
  const mesh = createDuck(hen);
  mesh.scale.setScalar(DUCK_SCALE * rand(0.92, 1.08));
  scene.add(mesh);
  const speedMul = 1 + 0.13 * (lvl - 1);
  const d = {
    mesh, hen, t: 0, state: 'fly', hit: false, flap: rand(0, 6), flapRate: rand(10.5, 13), speed: rand(8.5, 12.5) * speedMul,
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), prevHeading: null, roll: 0, quackT: rand(1, 4), attract,
  };
  const r = Math.random();
  const types = lvl >= 3 ? [['cross', 0.3], ['weave', 0.22], ['takeoff', 0.18], ['circle', 0.15], ['swoop', 0.15]] : [['cross', 0.42], ['weave', 0.18], ['takeoff', 0.22], ['circle', 0.1], ['swoop', 0.08]];
  let acc = 0; d.type = 'cross';
  for (const [t, w] of types) { acc += w; if (r < acc) { d.type = t; break; } }
  const dir = Math.random() < 0.5 ? 1 : -1;
  if (d.type === 'cross' || d.type === 'weave' || d.type === 'swoop') {
    d.p0 = new THREE.Vector3(-dir * 130, rand(8, 24), rand(-70, -8));
    d.dir = new THREE.Vector3(dir, 0, rand(-0.25, 0.25)).normalize();
    d.bobA = rand(0.4, 1.5); d.bobW = rand(0.5, 1.2);
    if (d.type === 'swoop') { d.p0.y = rand(18, 30); d.swoopT = 140 / d.speed * rand(0.4, 0.6); d.swoopD = d.p0.y - rand(4, 7); }
  } else if (d.type === 'takeoff') {
    const a = rand(0, 6.28), rr = rand(0, POND.r - 8);
    d.p0 = new THREE.Vector3(POND.x + Math.cos(a) * rr, 0.15, POND.z + Math.sin(a) * rr * 0.8);
    const h = rand(-Math.PI * 0.95, -Math.PI * 0.05); // generally away from the player
    d.dir = new THREE.Vector3(Math.cos(h), 0, Math.sin(h));
    d.climb = rand(16, 30);
    if (!attract) setTimeout(() => sfx.splash(0.25), 0);
    waterSplash(d.p0, 0.6);
    d.flapRate = 15;
  } else if (d.type === 'circle') {
    d.R = rand(35, 60); d.H = rand(12, 22); d.a0 = rand(0, 6.28); d.cdir = dir; d.exitT = rand(10, 16);
  }
  if (force) { // used by automated tests: a straight crossing flight from a given point
    d.type = 'cross'; d.p0 = new THREE.Vector3(force.x, force.y, force.z); d.dir = new THREE.Vector3(force.dx, 0, force.dz).normalize();
    d.speed = force.speed; d.bobA = force.bob ?? 0.5; d.bobW = 1;
  }
  pathPos(d, 0, d.pos); mesh.position.copy(d.pos);
  ducks.push(d);
  return d;
}

function pathPos(d, t, out) {
  switch (d.type) {
    case 'cross':
      return out.copy(d.p0).addScaledVector(d.dir, d.speed * t).setY(d.p0.y + Math.sin(t * d.bobW) * d.bobA);
    case 'weave': {
      out.copy(d.p0).addScaledVector(d.dir, d.speed * t);
      out.x += -d.dir.z * Math.sin(t * 0.9) * 9; out.z += d.dir.x * Math.sin(t * 0.9) * 9;
      out.y = d.p0.y + Math.sin(t * 1.4) * 3;
      return out;
    }
    case 'swoop': {
      out.copy(d.p0).addScaledVector(d.dir, d.speed * t);
      out.y = d.p0.y - d.swoopD * Math.exp(-Math.pow((t - d.swoopT) / 2.2, 2));
      return out;
    }
    case 'takeoff': {
      const horiz = d.speed * (t - (1 - Math.exp(-0.9 * t)) / 0.9);
      out.copy(d.p0).addScaledVector(d.dir, horiz);
      out.y = 0.15 + d.climb * (1 - Math.exp(-0.32 * t)) + 0.6 * t;
      return out;
    }
    case 'circle': {
      const R = d.R + Math.max(0, t - d.exitT) * d.speed * 0.9;
      const a = d.a0 + d.cdir * (d.speed * t) / R;
      return out.set(POND.x + Math.cos(a) * R, d.H + Math.sin(t * 0.7) * 2 + Math.max(0, t - d.exitT) * 1.2, POND.z + Math.sin(a) * R * 0.8);
    }
  }
  return out;
}

const tmpLook = new THREE.Vector3();
function updateDucks(dt) {
  for (let i = ducks.length - 1; i >= 0; i--) {
    const d = ducks[i];
    d.t += dt;
    if (d.state === 'fly') {
      const prev = tmpV2.copy(d.pos);
      pathPos(d, d.t, d.pos);
      d.vel.copy(d.pos).sub(prev).divideScalar(Math.max(dt, 1e-4));
      // takeoff: water spray while skimming the surface
      if (d.type === 'takeoff' && d.pos.y < 1.2 && Math.random() < 0.6) particles.emit(d.pos.x, 0.1, d.pos.z, rand(-1, 1), rand(1, 3), rand(-1, 1), 0.7, 0.1, 0.05, WATER_WHITE, 0.8, 9, 0.3);
      d.flap += dt * d.flapRate;
      flapDuck(d.mesh, d.flap, d.type === 'takeoff' && d.t < 2 ? 1.25 : 1);
      if (!d.attract) { d.quackT -= dt; if (d.quackT < 0) { d.quackT = rand(5, 12); if (d.pos.distanceTo(camera.position) < 70) sfx.quack(rand(0.95, 1.15)); } }
    } else if (d.state === 'tumble') {
      d.vel.y -= 9.8 * dt;
      d.pos.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.spin.x * dt; d.mesh.rotation.z += d.spin.z * dt;
      d.flap += dt * 30; flapDuck(d.mesh, d.flap, 1.3);
      const g = groundOrWater(d.pos.x, d.pos.z);
      if (d.pos.y < g + 0.35) {
        d.pos.y = g + 0.35;
        const onWater = Math.hypot(d.pos.x - POND.x, d.pos.z - POND.z) < POND.r;
        if (onWater) { waterSplash(d.pos, 1.3); sfx.splash(0.6); } else { dustPuff(d.pos); emitFeathers(d.pos, 8, d.hen); sfx.thud(); }
        d.state = 'dazed'; d.dazedT = 0.9; d.vel.set(0, 0, 0);
        d.mesh.rotation.set(0, d.mesh.rotation.y, 0);
      }
      d.mesh.position.copy(d.pos);
      continue;
    } else if (d.state === 'dazed') {
      d.dazedT -= dt;
      d.mesh.rotation.z = Math.sin(d.t * 14) * 0.35; // shakes it off
      flapDuck(d.mesh, d.t * 8, 0.3);
      if (d.dazedT < 0) startFlyoff(d, true);
      d.mesh.position.copy(d.pos);
      continue;
    } else if (d.state === 'flyoff') {
      d.vel.y += (d.climbAcc || 2) * dt;
      d.vel.y = Math.min(d.vel.y, 9);
      d.pos.addScaledVector(d.vel, dt);
      d.flap += dt * d.flapRate; flapDuck(d.mesh, d.flap, 1.1);
    }
    // orient along velocity with banking
    if (d.vel.lengthSq() > 0.01) {
      tmpLook.copy(d.pos).add(d.vel);
      d.mesh.position.copy(d.pos);
      d.mesh.lookAt(tmpLook);
      const heading = Math.atan2(d.vel.x, d.vel.z);
      if (d.prevHeading !== null) {
        let dh = heading - d.prevHeading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        d.roll += (clamp(-dh / Math.max(dt, 1e-3) * 0.6, -0.9, 0.9) - d.roll) * Math.min(1, dt * 4);
      }
      d.prevHeading = heading;
      let r = d.roll; if (d.state === 'flyoff') r += Math.sin(d.t * 9) * 0.45; // dizzy wobble
      d.mesh.rotateZ(r);
    }
    const far = Math.hypot(d.pos.x, d.pos.z) > 260 || d.pos.y > 120 || d.t > 45;
    if (far) { scene.remove(d.mesh); ducks.splice(i, 1); }
  }
}

function startFlyoff(d, fromGround) {
  d.state = 'flyoff';
  const away = tmpV.copy(d.pos).sub(camera.position).setY(0).normalize();
  if (!isFinite(away.x)) away.set(0, 0, -1);
  away.applyAxisAngle(UP, rand(-0.6, 0.6));
  d.vel.copy(away).multiplyScalar(d.speed * 1.5);
  d.vel.y = fromGround ? 5 : 3;
  d.climbAcc = 2.5;
  d.flapRate = 17;
  d.prevHeading = null;
  if (fromGround) { waterSplash(d.pos, 0.5); sfx.quack(1.25); }
}

function hitDuck(d, lemon) {
  d.hit = true;
  const hitPos = d.pos.clone();
  juiceBurst(hitPos, lemon.vel, 1);
  emitFeathers(hitPos, 34, d.hen, d.vel);
  sfx.bonk(); sfx.quack(rand(1.2, 1.4), 0.05);
  if (Math.random() < 0.55) {
    d.state = 'tumble';
    d.vel.multiplyScalar(0.3).addScaledVector(lemon.vel, 0.05); d.vel.y = rand(3, 5);
    d.spin = new THREE.Vector3(rand(4, 8) * (Math.random() < 0.5 ? 1 : -1), 0, rand(3, 7));
  } else startFlyoff(d, false);

  if (game.state !== 'playing') return;
  const dist = hitPos.distanceTo(camera.position);
  game.combo += 1;
  const mult = Math.min(5, game.combo);
  const pts = Math.round((100 + Math.round(dist) * 2) * mult);
  game.score += pts; game.hits += 1; game.totalHits += 1;
  const words = ['BONK!', 'SQUEEZED!', 'JUICY!', 'ZEST!', 'SPLAT!', 'QUACK!', 'SOUR POWER!'];
  showPopup(hitPos, `+${pts}`, mult > 1 ? `${words[(Math.random() * words.length) | 0]} x${mult}` : words[(Math.random() * words.length) | 0]);
  const hm = $('hitmarker'); hm.classList.add('show'); setTimeout(() => hm.classList.remove('show'), 90);
  if (game.hits === game.quota) { banner('Quota reached!', 'Keep bonking for bonus points'); sfx.chime(true); }
}

// ======================= popups / banner =======================
const popups = $('popups');
function showPopup(worldPos, text, sub) {
  const v = worldPos.clone().project(camera);
  if (v.z > 1) return;
  const el = document.createElement('div'); el.className = 'popup';
  el.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
  el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`; el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
  popups.appendChild(el); setTimeout(() => el.remove(), 1250);
}
let bannerTimer = 0;
function banner(text, sub, secs = 2) {
  const b = $('banner'); b.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`; b.classList.remove('hidden');
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  bannerTimer = secs;
}

// ======================= game state =======================
const game = {
  state: 'loading', score: 0, level: 1, hits: 0, totalHits: 0, quota: 8, time: ROUND_TIME, ammo: MAG_SIZE, reloading: 0, cooldown: 0,
  shots: 0, combo: 1, best: Number(localStorage.getItem(BEST_KEY) || 0), spawnT: 0, betweenT: 0,
};
game.combo = 0;
const player = { x: 0, z: 22, yaw: 0, pitch: 0.12, bob: 0 };
const keys = {};
const recoil = { z: 0, rx: 0, vz: 0, vrx: 0 };

function levelParams(l) {
  return { quota: 6 + 2 * l, maxDucks: Math.min(11, 3 + l), spawnEvery: Math.max(0.45, 1.7 - 0.16 * (l - 1)) };
}
function clearDucks() { for (const d of ducks) scene.remove(d.mesh); ducks.length = 0; }
function setScreen(id) {
  for (const s of ['screen-start', 'screen-pause', 'screen-over', 'screen-loading']) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', !(game.state === 'playing' || game.state === 'paused' || game.state === 'between'));
}

function startGame() {
  sfx.init();
  clearDucks();
  for (const l of lemons) scene.remove(l.mesh); lemons.length = 0;
  Object.assign(game, { score: 0, level: 1, hits: 0, totalHits: 0, shots: 0, combo: 0, ammo: MAG_SIZE, reloading: 0, cooldown: 0 });
  player.x = 0; player.z = 22; player.yaw = 0; player.pitch = 0.12;
  beginRound();
  requestLock();
}
function beginRound() {
  const p = levelParams(game.level);
  game.quota = p.quota; game.hits = 0; game.time = ROUND_TIME; game.spawnT = 0.5; game.state = 'playing';
  setScreen(null);
  banner(`Level ${game.level}`, `Bonk ${game.quota} ducks in ${ROUND_TIME} seconds!`, 2.4);
  buildAmmoIcons();
}
function endRound() {
  if (game.hits >= game.quota) {
    game.state = 'between'; game.betweenT = 3.2;
    const bonus = game.time > 0 ? 0 : 250 * game.level;
    game.score += bonus;
    banner(`Level ${game.level} complete!`, `+${bonus} bonus • get ready for level ${game.level + 1}`, 3);
    sfx.chime(true);
  } else gameOver();
}
function gameOver() {
  game.state = 'gameover';
  sfx.chime(false);
  const newBest = game.score > game.best;
  if (newBest) { game.best = game.score; localStorage.setItem(BEST_KEY, String(game.best)); }
  $('over-title').textContent = game.level > 1 ? `Great run! Level ${game.level}` : "Time's up!";
  $('over-score').textContent = game.score; $('over-level').textContent = game.level; $('over-ducks').textContent = game.totalHits;
  $('over-acc').textContent = accuracy() + '%'; $('over-best').textContent = game.best;
  $('over-newbest').classList.toggle('hidden', !newBest);
  if (document.pointerLockElement) document.exitPointerLock();
  setScreen('screen-over');
}
function pause() {
  if (game.state !== 'playing' && game.state !== 'between') return;
  game.prevState = game.state; game.state = 'paused';
  setScreen('screen-pause');
}
function resume() {
  if (game.state !== 'paused') return;
  game.state = game.prevState || 'playing';
  setScreen(null);
  sfx.init();
  requestLock();
}
function toTitle() {
  game.state = 'title'; clearDucks();
  if (document.pointerLockElement) document.exitPointerLock();
  $('start-best').textContent = game.best;
  setScreen('screen-start');
}
const accuracy = () => (game.shots ? Math.round((game.totalHits / game.shots) * 100) : 0);

// ======================= firing =======================
const camDir = new THREE.Vector3(), muzzlePos = new THREE.Vector3();
function fire() {
  if (game.state !== 'playing') return;
  if (game.reloading > 0 || game.cooldown > 0) return;
  if (game.ammo <= 0) { sfx.empty(); startReload(); return; }
  game.ammo--; game.shots++; game.cooldown = FIRE_COOLDOWN;
  camera.updateMatrixWorld(true);
  camera.getWorldDirection(camDir);
  muzzle.getWorldPosition(muzzlePos);
  const aim = camera.position.clone().addScaledVector(camDir, 55);
  const dir = aim.sub(muzzlePos).normalize();
  const mesh = new THREE.Mesh(lemonGeo, lemonMat);
  mesh.castShadow = true;
  mesh.position.copy(muzzlePos);
  scene.add(mesh);
  lemons.push({ mesh, vel: dir.multiplyScalar(LEMON_SPEED), prev: muzzlePos.clone(), life: 5, spin: rand(8, 16), spinA: 0 });
  // muzzle puff
  for (let i = 0; i < 16; i++) {
    tmpV.copy(camDir).multiplyScalar(rand(1, 5)).add(new THREE.Vector3(rand(-0.8, 0.8), rand(-0.3, 0.8), rand(-0.8, 0.8)));
    particles.emit(muzzlePos.x, muzzlePos.y, muzzlePos.z, tmpV.x, tmpV.y, tmpV.z, rand(0.3, 0.7), 0.08, rand(0.4, 0.7), SMOKE, 0.18, -0.3, 2.5);
  }
  recoil.vz += 2.6; recoil.vrx += 7;
  player.pitch += 0.012;
  sfx.fire();
  updateAmmo();
  if (game.ammo === 0) setTimeout(() => { if (game.ammo === 0) startReload(); }, 350);
}
function startReload() {
  if (game.reloading > 0 || game.ammo === MAG_SIZE || game.state !== 'playing') return;
  game.reloading = RELOAD_TIME;
  sfx.reload();
  updateAmmo();
}

const segClosest = new THREE.Vector3();
function updateLemons(dt) {
  for (let i = lemons.length - 1; i >= 0; i--) {
    const L = lemons[i];
    L.prev.copy(L.mesh.position);
    L.vel.y -= LEMON_GRAVITY * dt;
    L.mesh.position.addScaledVector(L.vel, dt);
    L.life -= dt;
    // orient long axis along flight, with spin
    L.spinA += L.spin * dt;
    tmpV.copy(L.vel).normalize();
    L.mesh.quaternion.setFromUnitVectors(UP, tmpV);
    L.mesh.rotateY(L.spinA);
    // trail
    const p = L.mesh.position;
    for (let k = 0; k < 2; k++) {
      const f = k / 2;
      particles.emit(p.x - L.vel.x * dt * f, p.y - L.vel.y * dt * f, p.z - L.vel.z * dt * f, rand(-0.2, 0.2), rand(-0.1, 0.2), rand(-0.2, 0.2), 0.35, 0.16, 0.38, k ? MIST : JUICE[0], 0.5, 0, 1);
    }
    // collision with ducks (swept segment vs sphere)
    let hit = null;
    const seg = tmpV2.copy(p).sub(L.prev); const segLen2 = seg.lengthSq();
    for (const d of ducks) {
      if (d.hit || d.state !== 'fly') continue;
      const tt = segLen2 > 0 ? clamp(tmpV.copy(d.pos).sub(L.prev).dot(seg) / segLen2, 0, 1) : 0;
      segClosest.copy(L.prev).addScaledVector(seg, tt);
      if (segClosest.distanceToSquared(d.pos) < HIT_RADIUS * HIT_RADIUS) { hit = d; break; }
    }
    if (hit) { hitDuck(hit, L); removeLemon(i); continue; }
    const g = groundOrWater(p.x, p.z);
    if (p.y < g + 0.05) {
      const onWater = Math.hypot(p.x - POND.x, p.z - POND.z) < POND.r;
      if (onWater) { waterSplash(p, 0.5); } else { juiceBurst(p, null, 0.3); }
      if (game.state === 'playing') game.combo = 0;
      removeLemon(i); continue;
    }
    if (L.life <= 0 || p.y > 400) { if (game.state === 'playing') game.combo = 0; removeLemon(i); }
  }
}
function removeLemon(i) { scene.remove(lemons[i].mesh); lemons.splice(i, 1); }

// ======================= input =======================
let locked = false;
function requestLock() {
  if (isTouch) return;
  try {
    const r = canvas.requestPointerLock && canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => { $('lock-hint').classList.remove('hidden'); });
  } catch (e) { $('lock-hint').classList.remove('hidden'); }
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  $('lock-hint').classList.toggle('hidden', locked || game.state !== 'playing' || isTouch);
  if (!locked && (game.state === 'playing' || game.state === 'between')) pause();
});
document.addEventListener('pointerlockerror', () => { $('lock-hint').classList.remove('hidden'); });
document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  look(e.movementX, e.movementY);
});
function look(dx, dy, sens = 0.0021) {
  player.yaw -= dx * sens;
  player.pitch = clamp(player.pitch - dy * sens, -0.35, 1.35);
}
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || isTouch) return;
  if (game.state === 'playing') { if (!locked) requestLock(); else fire(); }
});
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyM') sfx.toggleMute();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (game.state === 'paused') { if (e.code === 'KeyP') resume(); } else pause(); }
  if (e.code === 'Space' && game.state === 'playing') { fire(); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

$('btn-play').addEventListener('click', startGame);
$('btn-replay').addEventListener('click', startGame);
$('btn-resume').addEventListener('click', resume);
$('btn-quit').addEventListener('click', toTitle);
$('btn-title').addEventListener('click', toTitle);

// ---------- touch fallback ----------
const isTouch = matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window;
const joy = { x: 0, y: 0, id: null };
if (isTouch) {
  $('touch').classList.remove('hidden');
  let lookId = null, lx = 0, ly = 0;
  canvas.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; } }, { passive: true });
  canvas.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) { look(t.clientX - lx, t.clientY - ly, 0.005); lx = t.clientX; ly = t.clientY; } }, { passive: true });
  canvas.addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; }, { passive: true });
  const jb = $('joy'), knob = $('joy-knob');
  const jmove = (t) => { const r = jb.getBoundingClientRect(); const dx = clamp((t.clientX - r.left - 60) / 50, -1, 1), dy = clamp((t.clientY - r.top - 60) / 50, -1, 1); joy.x = dx; joy.y = dy; knob.style.transform = `translate(${dx * 35}px,${dy * 35}px)`; };
  jb.addEventListener('touchstart', (e) => { e.preventDefault(); joy.id = e.changedTouches[0].identifier; jmove(e.changedTouches[0]); });
  jb.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === joy.id) jmove(t); });
  jb.addEventListener('touchend', (e) => { e.preventDefault(); joy.x = joy.y = 0; joy.id = null; knob.style.transform = ''; });
  $('t-fire').addEventListener('touchstart', (e) => { e.preventDefault(); fire(); });
  $('t-reload').addEventListener('touchstart', (e) => { e.preventDefault(); startReload(); });
  $('t-pause').addEventListener('touchstart', (e) => { e.preventDefault(); pause(); });
}

// ======================= HUD =======================
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function buildAmmoIcons() {
  const box = $('hud-ammo-icons'); box.innerHTML = '';
  for (let i = 0; i < MAG_SIZE; i++) { const d = document.createElement('div'); d.className = 'ammo-lemon'; box.appendChild(d); }
  updateAmmo();
}
function updateAmmo() {
  const icons = $('hud-ammo-icons').children;
  for (let i = 0; i < icons.length; i++) icons[i].classList.toggle('empty', i >= game.ammo);
  $('hud-reload').classList.toggle('hidden', game.reloading <= 0);
  $('hud-ammo-hint').classList.toggle('hidden', game.reloading > 0);
  loadedLemon.visible = game.ammo > 0 && game.reloading <= 0;
}
function updateHUD() {
  setText('hud-score', String(game.score));
  setText('hud-best', String(Math.max(game.best, game.score)));
  setText('hud-level', String(game.level));
  setText('hud-timer', String(Math.ceil(Math.max(0, game.time))));
  setText('hud-hits', String(game.hits));
  setText('hud-quota', String(game.quota));
  setText('hud-combo', 'x' + Math.max(1, Math.min(5, game.combo)));
  setText('hud-acc', accuracy() + '%');
  $('hud-timer').classList.toggle('low', game.time <= 10 && game.state === 'playing');
}

// ======================= main loop =======================
let last = performance.now(), elapsed = 0, lastTick = 0;
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  particles.mat.uniforms.uScale.value = (window.innerHeight * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
window.addEventListener('resize', resize); resize();

function updatePlayer(dt) {
  let fx = 0, fz = 0;
  if (keys.KeyW || keys.ArrowUp) fz -= 1; if (keys.KeyS || keys.ArrowDown) fz += 1;
  if (keys.KeyA || keys.ArrowLeft) fx -= 1; if (keys.KeyD || keys.ArrowRight) fx += 1;
  fx += joy.x; fz += joy.y;
  const len = Math.hypot(fx, fz);
  let moving = false;
  if (len > 0.05) {
    const sp = (keys.ShiftLeft ? 7.5 : 5) * dt / Math.max(1, len);
    const s = Math.sin(player.yaw), c = Math.cos(player.yaw);
    player.x += (fx * c + fz * s) * sp; player.z += (-fx * s + fz * c) * sp;
    player.x = clamp(player.x, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX); player.z = clamp(player.z, PLAYER_BOUNDS.minZ, PLAYER_BOUNDS.maxZ);
    moving = true; player.bob += dt * 9;
  }
  const bobY = moving ? Math.sin(player.bob) * 0.04 : 0;
  camera.position.set(player.x, terrainHeight(player.x, player.z) + EYE_HEIGHT + bobY, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  return moving;
}

function updateLauncher(dt, moving) {
  // damped springs for recoil
  recoil.vz += (-recoil.z * 180 - recoil.vz * 18) * dt; recoil.z += recoil.vz * dt;
  recoil.vrx += (-recoil.rx * 160 - recoil.vrx * 16) * dt; recoil.rx += recoil.vrx * dt;
  const sway = moving ? Math.sin(player.bob) : 0;
  let reloadDip = 0;
  if (game.reloading > 0) { const k = 1 - game.reloading / RELOAD_TIME; reloadDip = Math.sin(k * Math.PI); }
  launcher.position.set(launcherRest.x + sway * 0.012, launcherRest.y + Math.abs(sway) * 0.01 - reloadDip * 0.18 + Math.sin(elapsed * 1.6) * 0.003, launcherRest.z + recoil.z * 0.06);
  launcher.rotation.set(recoil.rx * 0.05 + reloadDip * 0.5, 0.04, reloadDip * 0.6);
}

function update(dt) {
  if (game.state !== 'paused') elapsed += dt;
  world.water.material.uniforms.time.value = elapsed * 0.5;
  world.wind.value = elapsed;
  if (world.sky.material.uniforms.time) world.sky.material.uniforms.time.value = elapsed;

  if (game.state === 'title' || game.state === 'loading') {
    // attract mode: slow cinematic look around with ducks flying
    player.yaw = Math.sin(elapsed * 0.05) * 0.5; player.pitch = 0.15 + Math.sin(elapsed * 0.08) * 0.05;
    updatePlayer(dt);
    if (ducks.length < 4 && Math.random() < dt * 0.8) spawnDuck(true);
    updateDucks(dt);
    launcher.visible = false;
  } else if (game.state !== 'paused') {
    launcher.visible = true;
    const moving = updatePlayer(dt);
    updateLauncher(dt, moving);
    if (game.state === 'playing') {
      game.time -= dt;
      if (game.time <= 5 && Math.ceil(game.time) !== lastTick && game.time > 0) { lastTick = Math.ceil(game.time); sfx.tick(); }
      game.cooldown -= dt;
      if (game.reloading > 0) { game.reloading -= dt; if (game.reloading <= 0) { game.reloading = 0; game.ammo = MAG_SIZE; updateAmmo(); } }
      const p = levelParams(game.level);
      game.spawnT -= dt;
      const active = ducks.filter((d) => d.state === 'fly').length;
      if (game.spawnT <= 0 && active < p.maxDucks) { spawnDuck(); game.spawnT = p.spawnEvery * rand(0.7, 1.3); }
      if (game.time <= 0) { game.time = 0; endRound(); }
    } else if (game.state === 'between') {
      game.betweenT -= dt;
      if (game.betweenT <= 0) { game.level++; game.ammo = MAG_SIZE; game.reloading = 0; beginRound(); }
    }
    updateDucks(dt);
    updateLemons(dt);
  }
  if (game.state !== 'paused') {
    particles.update(dt);
    updateFeathers(dt, elapsed);
    if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) $('banner').classList.add('hidden'); }
  }
}

// Adaptive resolution keeps the frame rate smooth on modest laptops.
const maxPR = Math.min(window.devicePixelRatio, 1.5);
let pr = maxPR, ftAvg = 16, ftN = 0;
function adaptQuality(frameMs) {
  ftAvg += (frameMs - ftAvg) * 0.05; ftN++;
  if (ftN < 90) return;
  ftN = 0;
  if (ftAvg > 24 && pr > 0.75) { pr = Math.max(0.75, pr - 0.15); renderer.setPixelRatio(pr); resize(); }
  else if (ftAvg < 13 && pr < maxPR) { pr = Math.min(maxPR, pr + 0.1); renderer.setPixelRatio(pr); resize(); }
}

function render() {
  // keep sun shadow frustum centred on the player
  world.sun.position.copy(camera.position).addScaledVector(world.sunDir, 150);
  world.sun.target.position.copy(camera.position).add(new THREE.Vector3(0, 0, -25));
  updateHUD();
  renderer.render(scene, camera);
}

let manualStepping = false;
function tick() {
  requestAnimationFrame(tick);
  const now = performance.now();
  const raw = now - last; last = now;
  if (manualStepping) return;
  const dt = Math.min(0.05, raw / 1000);
  if (document.visibilityState === 'visible' && game.state !== 'loading') adaptQuality(raw);
  update(dt);
  render();
}

manager.onLoad = () => {
  game.state = 'title';
  $('start-best').textContent = game.best;
  setScreen('screen-start');
};
// Fallback in case all textures were cached before the manager hooked up
setTimeout(() => { if (game.state === 'loading') manager.onLoad(); }, 8000);
tick();

// Small debug/test hook (used for automated smoke tests)
window.__game = {
  showPopup, game, ducks, lemons, fire, startGame, pause, resume, spawnDuck, player, camera, renderer,
  setAim(yaw, pitch) { player.yaw = yaw; player.pitch = pitch; },
  // deterministic stepping for automated tests on slow software-GL machines
  manual(on) { manualStepping = on; },
  step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) update(dt); },
  render,
};
