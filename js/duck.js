// Procedural mallard (drake + hen) built from shaped primitives with painted plumage textures and PBR materials.
import * as THREE from 'three';
import { makeDuckTextures } from './textures.js';

let shared = null;

function wingShapeGeometry(x0, x1) {
  // Outline in (span x, chord y) — y positive = toward trailing edge (backwards)
  const lead = (x) => -0.025 - 0.02 * Math.sin(Math.min(1, x / 0.42) * Math.PI) + Math.max(0, x - 0.40) * 0.6;
  const trail = (x) => {
    if (x < 0.24) return 0.165 - x * 0.08;
    const k = (x - 0.24) / 0.27; // primaries taper to the tip
    return 0.146 - k * 0.14 - Math.sin(k * Math.PI) * 0.01;
  };
  const N = 14, pts = [];
  for (let i = 0; i <= N; i++) { const x = x0 + (x1 - x0) * (i / N); pts.push(new THREE.Vector2(x - x0, lead(x))); }
  for (let i = N; i >= 0; i--) { const x = x0 + (x1 - x0) * (i / N); pts.push(new THREE.Vector2(x - x0, Math.max(lead(x) + 0.004, trail(x)))); }
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts));
  // UVs: u = global span 0..0.51, v = chord
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const gx = pos.getX(i) + x0, gy = pos.getY(i);
    uv.setXY(i, gx / 0.51, 1 - (gy + 0.06) / 0.23);
  }
  geo.rotateX(-Math.PI / 2); // shape y -> -z (backwards)
  // gentle camber so it is not perfectly flat
  for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i); pos.setY(i, pos.getY(i) + 0.012 * Math.sin(((z + 0.06) / 0.23) * Math.PI)); }
  geo.computeVertexNormals();
  return geo;
}

function deformedSphere(sx, sy, sz, fn, w = 44, h = 32) {
  const g = new THREE.SphereGeometry(1, w, h);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (fn) [x, y, z] = fn(x, y, z);
    p.setXYZ(i, x * sx, y * sy, z * sz);
  }
  g.computeVertexNormals();
  return g;
}

function init() {
  const T = makeDuckTextures();
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const M = {
    drakeBody: phys({ map: T.drakeBody, bumpMap: T.drakeBody, bumpScale: 0.6, roughness: 0.88, sheen: 0.25, sheenRoughness: 0.7, sheenColor: new THREE.Color(0xaaaaaa) }),
    drakeChest: phys({ map: T.drakeChest, bumpMap: T.drakeChest, bumpScale: 0.8, roughness: 0.8, sheen: 0.5, sheenColor: new THREE.Color(0x996644) }),
    drakeHead: phys({ color: 0x0d4a22, roughness: 0.32, metalness: 0.05, iridescence: 1.0, iridescenceIOR: 1.7, iridescenceThicknessRange: [250, 600], sheen: 1.0, sheenRoughness: 0.35, sheenColor: new THREE.Color(0x30d070), clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    white: phys({ color: 0xf0efe8, roughness: 0.8, sheen: 0.5 }),
    black: phys({ color: 0x111111, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0x224466) }),
    drakeBill: phys({ color: 0xc9b02a, roughness: 0.45, clearcoat: 0.4 }),
    henBill: phys({ color: 0xc46a25, roughness: 0.5, clearcoat: 0.3 }),
    feet: phys({ color: 0xe5761c, roughness: 0.6 }),
    eye: phys({ color: 0x050505, roughness: 0.1, clearcoat: 1 }),
    henBody: phys({ map: T.henBody, bumpMap: T.henBody, bumpScale: 0.8, roughness: 0.85, sheen: 0.5, sheenColor: new THREE.Color(0xccaa88) }),
    henHead: phys({ map: T.henHead, bumpMap: T.henHead, bumpScale: 0.5, roughness: 0.85, sheen: 0.4 }),
    drakeWing: phys({ map: T.drakeWing, bumpMap: T.drakeWing, bumpScale: 0.8, roughness: 0.75, side: THREE.DoubleSide, sheen: 0.25, sheenColor: new THREE.Color(0x888888), color: 0xd8d4cc }),
    henWing: phys({ map: T.henWing, bumpMap: T.henWing, bumpScale: 0.8, roughness: 0.75, side: THREE.DoubleSide, sheen: 0.5 }),
  };
  const G = {
    // body: teardrop, fuller at front, tapering to tail (forward = +z)
    body: deformedSphere(0.105, 0.085, 0.25, (x, y, z) => {
      const t = (z + 1) / 2; const s = 0.72 + 0.28 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5 + 0.2);
      return [x * s, y * s - (z < 0 ? z * z * 0.12 : 0), z];
    }),
    chest: deformedSphere(0.098, 0.088, 0.105),
    neck: new THREE.CylinderGeometry(0.032, 0.042, 0.11, 16, 1, true).rotateX(Math.PI / 2),
    ring: new THREE.TorusGeometry(0.041, 0.0065, 8, 24),
    head: deformedSphere(0.047, 0.05, 0.06, (x, y, z) => [x * (1 - 0.15 * Math.max(0, y)), y, z + (y > 0.3 ? 0.08 * y : 0)]),
    bill: deformedSphere(0.024, 0.011, 0.042, (x, y, z) => { const t = (z + 1) / 2; return [x * (0.75 + 0.35 * t), y * (1.1 - 0.5 * t) + (y < 0 ? 0 : 0), z]; }),
    eye: new THREE.SphereGeometry(0.0075, 10, 8),
    tail: deformedSphere(0.06, 0.018, 0.075, (x, y, z) => { const t = (1 - z) / 2; return [x * (0.4 + 0.6 * t), y, z]; }),
    rump: deformedSphere(0.06, 0.05, 0.07),
    curl: new THREE.TorusGeometry(0.016, 0.004, 6, 12, Math.PI * 1.5),
    foot: deformedSphere(0.022, 0.005, 0.035),
    wingInner: wingShapeGeometry(0.0, 0.24),
    wingOuter: wingShapeGeometry(0.24, 0.51),
  };
  shared = { M, G };
}

export function createDuck(hen = false) {
  if (!shared) init();
  const { M, G } = shared;
  const root = new THREE.Group();
  const model = new THREE.Group(); root.add(model);
  const add = (geo, mat, x, y, z, parent = model, shadow = false) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; parent.add(m); return m;
  };
  const bodyMat = hen ? M.henBody : M.drakeBody;
  add(G.body, bodyMat, 0, 0, 0, model, true);
  add(G.chest, hen ? M.henBody : M.drakeChest, 0, -0.008, 0.135);
  // neck / head stretched forward in flight
  const neck = add(G.neck, hen ? M.henHead : M.drakeHead, 0, 0.022, 0.235);
  neck.rotation.x = -0.15;
  if (!hen) { const r = add(G.ring, M.white, 0, 0.012, 0.205); r.rotation.x = 0.1; }
  const headGrp = new THREE.Group(); headGrp.position.set(0, 0.035, 0.31); model.add(headGrp);
  add(G.head, hen ? M.henHead : M.drakeHead, 0, 0, 0, headGrp);
  add(G.bill, hen ? M.henBill : M.drakeBill, 0, -0.012, 0.072, headGrp).rotation.x = 0.12;
  add(G.eye, M.eye, 0.037, 0.012, 0.018, headGrp); add(G.eye, M.eye, -0.037, 0.012, 0.018, headGrp);
  // tail & rump
  add(G.rump, hen ? M.henBody : M.black, 0, 0.006, -0.19);
  const tail = add(G.tail, hen ? M.henBody : M.white, 0, 0.012, -0.27); tail.rotation.x = -0.1;
  if (!hen) { const cl = add(G.curl, M.black, 0, 0.05, -0.215); cl.rotation.y = Math.PI / 2; }
  // feet tucked back under the tail
  add(G.foot, M.feet, 0.025, -0.06, -0.2).rotation.x = 0.3; add(G.foot, M.feet, -0.025, -0.06, -0.2).rotation.x = 0.3;
  // wings: shoulder pivots; inner + outer segments for a natural flap
  const wings = [];
  for (const side of [1, -1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(0.075 * side, 0.045, 0.085); shoulder.scale.x = side; model.add(shoulder);
    const inner = new THREE.Mesh(G.wingInner, hen ? M.henWing : M.drakeWing); inner.castShadow = true; shoulder.add(inner);
    const elbow = new THREE.Group(); elbow.position.set(0.24, 0, 0); shoulder.add(elbow);
    const outer = new THREE.Mesh(G.wingOuter, hen ? M.henWing : M.drakeWing); outer.castShadow = true; elbow.add(outer);
    wings.push({ shoulder, elbow, side });
  }
  root.userData = { wings, model, headGrp, hen };
  return root;
}

// phase in radians; amp ~0.9 for normal flight
export function flapDuck(duck, phase, amp = 1) {
  const { wings, model } = duck.userData;
  const s = Math.sin(phase);
  for (const w of wings) {
    w.shoulder.rotation.z = (0.15 + 0.75 * s) * amp * w.side;
    w.elbow.rotation.z = (0.1 + 0.55 * Math.sin(phase - 0.7)) * amp;
    w.shoulder.rotation.x = -0.12 * Math.cos(phase) * amp; // slight feathering twist
  }
  model.position.y = -0.02 * s * amp; // body bobs opposite to wings
}
