// Realistic environment: Preetham sky with clouds, IBL from the sky, sun with soft shadows,
// textured rolling terrain, reflective pond (Water addon), instanced trees, grass clumps, reeds and rocks.
import * as THREE from 'three';
import { Sky } from '../vendor/addons/Sky.js';
import { Water } from '../vendor/addons/Water.js';
import { makeGrassBlades } from './textures.js';

export const POND = { x: 0, z: -24, r: 27 };
export const PLAYER_BOUNDS = { minX: -22, maxX: 22, minZ: 8, maxZ: 34 };

// ---------- noise ----------
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) { let f = 0, a = 0.5; for (let i = 0; i < 5; i++) { f += a * vnoise(x, z); x *= 2.03; z *= 2.03; a *= 0.5; } return f; }
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export function terrainHeight(x, z) {
  const r = Math.hypot(x, z - 10);
  const amp = 0.5 + smooth(45, 320, r) * 38;
  let h = (fbm(x * 0.008 + 3.1, z * 0.008 - 1.7) - 0.45) * amp + 0.35 + (fbm(x * 0.08, z * 0.08) - 0.5) * 0.35;
  const d = Math.hypot(x - POND.x, z - POND.z);
  const bowl = -2.4 * (1 - smooth(0, POND.r, d) * 0.4);
  h = bowl + (h - bowl) * smooth(POND.r - 4, POND.r + 4, d);
  return h;
}

export function buildWorld(renderer, scene, loader) {
  const out = {};
  const sunDir = new THREE.Vector3();
  const elevation = 40, azimuth = 35; // sun behind-right of the player so ducks are front-lit
  sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevation), THREE.MathUtils.degToRad(azimuth));
  out.sunDir = sunDir;

  // ---------- Sky + environment lighting ----------
  const sky = new Sky();
  sky.scale.setScalar(9000);
  const su = sky.material.uniforms;
  su.turbidity.value = 4.5; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.82;
  su.sunPosition.value.copy(sunDir);
  if (su.cloudCoverage) { su.cloudCoverage.value = 0.42; su.cloudDensity.value = 0.45; su.cloudScale.value = 0.00025; su.cloudSpeed.value = 0.00003; }
  out.sky = sky;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(sky);
  if (su.showSunDisc) su.showSunDisc.value = 0;
  const envRT = pmrem.fromScene(envScene, 0, 1, 20000);
  if (su.showSunDisc) su.showSunDisc.value = 1;
  scene.add(sky);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.45;
  pmrem.dispose();

  scene.fog = new THREE.Fog(0xb4c8d8, 90, 620);

  // ---------- Sun ----------
  const sun = new THREE.DirectionalLight(0xfff1d6, 3.2);
  sun.position.copy(sunDir).multiplyScalar(120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
  scene.add(sun); scene.add(sun.target);
  out.sun = sun;
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4a5a2a, 0.35); scene.add(hemi);

  // ---------- Textures ----------
  const L = (f, srgb = true, rep = 1) => {
    const t = loader.load('assets/textures/' + f);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  };

  // ---------- Terrain ----------
  const SIZE = 1400, SEG = 220;
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); tg.rotateX(-Math.PI / 2);
  // concentrate detail near the play area by warping the grid radially
  const p = tg.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const grassTint = new THREE.Color(), mud = new THREE.Color(0x6e5a3e), dry = new THREE.Color(0xc6c08a), lush = new THREE.Color(0xd8ead0);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i);
    const r = Math.hypot(x, z) / (SIZE / 2);
    const k = Math.pow(r, 1.8) / Math.max(r, 1e-6);
    x *= k; z *= k; p.setX(i, x); p.setZ(i, z);
    const h = terrainHeight(x, z); p.setY(i, h);
    const d = Math.hypot(x - POND.x, z - POND.z);
    const n = fbm(x * 0.03 + 9, z * 0.03 - 4);
    grassTint.setRGB(1, 1, 1).lerp(n > 0.5 ? dry : lush, Math.abs(n - 0.5) * 1.3);
    const m = 1 - smooth(POND.r - 2, POND.r + 3.5, d);
    grassTint.lerp(mud, m);
    colors[i * 3] = grassTint.r; colors[i * 3 + 1] = grassTint.g; colors[i * 3 + 2] = grassTint.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  tg.computeVertexNormals();
  const tm = new THREE.MeshStandardMaterial({
    map: L('grass_color.jpg', true, 260), normalMap: L('grass_normal.jpg', false, 260),
    vertexColors: true, roughness: 0.97, metalness: 0, normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 0.3,
  });
  // break up visible tiling: blend in a second, larger-scale sample of the grass texture
  tm.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        vec4 big = texture2D( map, vMapUv * 0.137 + 0.31 );
        sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, big.rgb, 0.45 );
        diffuseColor *= sampledDiffuseColor;
      #endif`);
  };
  const terrain = new THREE.Mesh(tg, tm); terrain.receiveShadow = true; scene.add(terrain);
  out.terrain = terrain;

  // ---------- Pond (reflective water) ----------
  const waterNormals = L('waternormals.jpg', false, 1);
  const water = new Water(new THREE.CircleGeometry(POND.r + 3, 72), {
    textureWidth: 512, textureHeight: 512, waterNormals,
    sunDirection: sunDir.clone(), sunColor: 0xffffff, waterColor: 0x1d3a2c, distortionScale: 1.6, fog: true, alpha: 0.95,
  });
  water.rotation.x = -Math.PI / 2; water.position.set(POND.x, 0.02, POND.z);
  water.material.uniforms.size.value = 3.5;
  scene.add(water);
  out.water = water;

  // ---------- Trees (instanced: bark trunks + alpha-tested leaf cards) ----------
  const barkMat = new THREE.MeshStandardMaterial({ map: L('bark_color.jpg', true, 1), normalMap: L('bark_normal.jpg', false, 1), roughness: 0.95, color: 0x8f8478 });
  barkMat.map.repeat.set(2, 4); barkMat.normalMap.repeat.set(2, 4);
  const leafTex = L('leaves.png', true, 1); leafTex.wrapS = leafTex.wrapT = THREE.ClampToEdgeWrapping;
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: 0xc4d6ae });

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 7, 10, 4, false).translate(0, 3.5, 0);
  {
    const tp = trunkGeo.attributes.position;
    for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); const w = 1 + 0.08 * Math.sin(y * 3 + tp.getX(i) * 9); tp.setX(i, tp.getX(i) * w); tp.setZ(i, tp.getZ(i) * w); }
    trunkGeo.computeVertexNormals();
  }
  // crown: many randomly oriented leaf quads in an ellipsoid; normals point outward for soft "volume" shading
  const crownGeo = (() => {
    const N = 230, pos = [], nor = [], uv = [], idx = [];
    const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const u = Math.random(), th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const rr = Math.cbrt(0.25 + 0.75 * u);
      const c = new THREE.Vector3(Math.sin(ph) * Math.cos(th) * 3.6 * rr, Math.cos(ph) * 3.0 * rr + 9.2, Math.sin(ph) * Math.sin(th) * 3.6 * rr);
      const outward = new THREE.Vector3(c.x, (c.y - 9.2) * 1.2 + 1.2, c.z).normalize();
      e.set(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3); q.setFromEuler(e);
      const s = 1.7 + Math.random() * 0.9;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      const base = pos.length / 3;
      for (const [a, b] of corners) {
        v.set(a * s * 0.5, b * s * 0.5, 0).applyQuaternion(q).add(c);
        pos.push(v.x, v.y, v.z); nor.push(outward.x, outward.y, outward.z); uv.push((a + 1) / 2, (b + 1) / 2);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  })();
  // a few branch stubs into the crown
  const branchGeo = new THREE.CylinderGeometry(0.06, 0.14, 3.2, 6).translate(0, 1.6, 0);

  const treeSpots = [];
  let tries = 0;
  while (treeSpots.length < 120 && tries < 4000) {
    tries++;
    const a = Math.random() * Math.PI * 2, r = 55 + Math.pow(Math.random(), 0.8) * 230;
    const x = Math.cos(a) * r, z = Math.sin(a) * r + 5;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 10) continue;
    if (x > PLAYER_BOUNDS.minX - 12 && x < PLAYER_BOUNDS.maxX + 12 && z > PLAYER_BOUNDS.minZ - 14 && z < PLAYER_BOUNDS.maxZ + 14) continue;
    if (treeSpots.some((t) => Math.hypot(t.x - x, t.z - z) < 7)) continue;
    treeSpots.push({ x, z, s: 0.8 + Math.random() * 0.75, ry: Math.random() * 6.28 });
  }
  // clusters near the pond's far side for a nice backdrop
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI * (0.15 + 0.7 * Math.random()), r = POND.r + 14 + Math.random() * 30;
    const x = POND.x + Math.cos(a) * r * 1.3, z = POND.z + Math.sin(a) * r;
    if (treeSpots.some((t) => Math.hypot(t.x - x, t.z - z) < 6)) continue;
    treeSpots.push({ x, z, s: 0.75 + Math.random() * 0.6, ry: Math.random() * 6.28 });
  }
  const n = treeSpots.length;
  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, n);
  const crowns = new THREE.InstancedMesh(crownGeo, leafMat, n);
  const branches = new THREE.InstancedMesh(branchGeo, barkMat, n * 3);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3(), col = new THREE.Color();
  treeSpots.forEach((t, i) => {
    const y = terrainHeight(t.x, t.z) - 0.2;
    q4.setFromEuler(new THREE.Euler(0, t.ry, 0)); s4.set(t.s, t.s * (0.9 + Math.random() * 0.3), t.s); p4.set(t.x, y, t.z);
    m4.compose(p4, q4, s4); trunks.setMatrixAt(i, m4); crowns.setMatrixAt(i, m4);
    col.setHSL(0.2 + Math.random() * 0.08, 0.3 + Math.random() * 0.25, 0.5 + Math.random() * 0.25); crowns.setColorAt(i, col);
    for (let b = 0; b < 3; b++) {
      const bq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7 + Math.random() * 0.4, t.ry + b * 2.1, 0, 'YXZ'));
      const bp = new THREE.Vector3(0, (4.6 + b * 0.7) * s4.y, 0).add(p4);
      m4.compose(bp, bq, new THREE.Vector3(t.s, t.s, t.s)); branches.setMatrixAt(i * 3 + b, m4);
    }
  });
  for (const im of [trunks, crowns, branches]) { im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); }
  out.trees = treeSpots;

  // ---------- Grass clumps around the player (instanced crossed cards with wind sway) ----------
  const bladeTex = makeGrassBlades();
  const grassMat = new THREE.MeshStandardMaterial({ map: bladeTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95, color: 0xa8bc84 });
  const windUniform = { value: 0 };
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windUniform;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3( position );
      #ifdef USE_INSTANCING
        vec4 ip = instanceMatrix[3];
        float hh = clamp(position.y / 0.55, 0.0, 1.0);
        transformed.x += sin(uWind * 1.6 + ip.x * 0.35 + ip.z * 0.21) * 0.07 * hh * hh;
        transformed.z += cos(uWind * 1.3 + ip.x * 0.17) * 0.04 * hh * hh;
      #endif`);
  };
  const card = new THREE.PlaneGeometry(0.6, 0.48).translate(0, 0.23, 0);
  const card2 = card.clone().rotateY(Math.PI / 2);
  const card3 = card.clone().rotateY(Math.PI / 4);
  const merge = (geos) => {
    const g = new THREE.BufferGeometry(); const pos = [], nor = [], uv = [], idx = []; let off = 0;
    for (const gg of geos) {
      const pp = gg.attributes.position, uu = gg.attributes.uv;
      for (let i = 0; i < pp.count; i++) { pos.push(pp.getX(i), pp.getY(i), pp.getZ(i)); nor.push(0, 1, 0); uv.push(uu.getX(i), uu.getY(i)); }
      const ii = gg.index.array; for (let i = 0; i < ii.length; i++) idx.push(ii[i] + off); off += pp.count;
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    return g;
  };
  const clumpGeo = merge([card, card2, card3]);
  const GRASS_N = 16000;
  const grass = new THREE.InstancedMesh(clumpGeo, grassMat, GRASS_N);
  let gi = 0;
  while (gi < GRASS_N) {
    const a = Math.random() * Math.PI * 2, r = 1.5 + Math.pow(Math.random(), 0.75) * 70;
    const x = Math.cos(a) * r, z = Math.sin(a) * r + 20;
    const d = Math.hypot(x - POND.x, z - POND.z);
    if (d < POND.r + 0.5) continue;
    const s = 0.7 + Math.random() * 0.9;
    m4.compose(new THREE.Vector3(x, terrainHeight(x, z) - 0.03, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * 6.3, 0)), new THREE.Vector3(s, s * (0.7 + Math.random() * 0.7), s));
    grass.setMatrixAt(gi, m4);
    col.setHSL(0.19 + Math.random() * 0.06, 0.3 + Math.random() * 0.3, 0.45 + Math.random() * 0.3); grass.setColorAt(gi, col);
    gi++;
  }
  grass.receiveShadow = true; grass.computeBoundingSphere(); scene.add(grass);
  out.wind = windUniform;

  // ---------- Reeds & cattails around the pond ----------
  const reedMat = new THREE.MeshStandardMaterial({ color: 0x6d8a3a, roughness: 0.8 });
  const catMat = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.95 });
  const reedGeo = new THREE.CylinderGeometry(0.012, 0.025, 1.9, 5).translate(0, 0.95, 0);
  const catGeo = new THREE.CapsuleGeometry(0.045, 0.22, 4, 8).translate(0, 1.75, 0);
  const R_N = 420;
  const reeds = new THREE.InstancedMesh(reedGeo, reedMat, R_N), cats = new THREE.InstancedMesh(catGeo, catMat, R_N);
  for (let i = 0; i < R_N; i++) {
    const a = Math.random() * Math.PI * 2;
    if (Math.random() < 0.55 && Math.sin(a) > 0.35) { i--; continue; } // keep the near shore more open
    const r = POND.r - 2.5 + Math.random() * 4;
    const x = POND.x + Math.cos(a) * r, z = POND.z + Math.sin(a) * r;
    const s = 0.7 + Math.random() * 0.7;
    m4.compose(new THREE.Vector3(x, Math.max(terrainHeight(x, z), -0.6), z), new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.25, 0, (Math.random() - 0.5) * 0.25)), new THREE.Vector3(1, s, 1));
    reeds.setMatrixAt(i, m4);
    if (Math.random() < 0.35) cats.setMatrixAt(i, m4); else cats.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
  }
  reeds.castShadow = cats.castShadow = true; scene.add(reeds); scene.add(cats);

  // ---------- Rocks ----------
  const rockMat = new THREE.MeshStandardMaterial({ map: L('mud_color.jpg', true, 1), normalMap: L('mud_normal.jpg', false, 1), color: 0x9a9890, roughness: 0.9 });
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);
  {
    const rp = rockGeo.attributes.position;
    for (let i = 0; i < rp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(rp, i); const f = 0.75 + 0.35 * vnoise(v.x * 2 + 5, v.y * 2 + v.z * 2); rp.setXYZ(i, v.x * f, v.y * f * 0.6, v.z * f); }
    rockGeo.computeVertexNormals();
  }
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 24);
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2, r = i < 14 ? POND.r + 1 + Math.random() * 3 : 30 + Math.random() * 60;
    const x = POND.x + Math.cos(a) * r, z = POND.z + Math.sin(a) * r;
    const s = 0.3 + Math.random() * 0.8;
    m4.compose(new THREE.Vector3(x, terrainHeight(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * 6, 0)), new THREE.Vector3(s, s, s));
    rocks.setMatrixAt(i, m4);
  }
  rocks.castShadow = rocks.receiveShadow = true; scene.add(rocks);

  return out;
}
