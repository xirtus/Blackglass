import * as THREE from 'three';
import type { FaceParams } from './profiles';

/**
 * Parametric head. UV convention: u 0.5 = face center (+Z), v 0 = chin, v 1 = crown.
 * Features (nose, sockets, brow, lips, chin, jaw) are radial displacements driven
 * by FaceParams so every generated face is distinct but believable.
 * All vertices are skinned to `head` (bottom rows blend to neck_01).
 */

const gauss = (x: number, sigma: number) => Math.exp(-(x * x) / (2 * sigma * sigma));
/** wrapped horizontal distance on the head UV (u wraps at 1) */
const du = (u: number, c: number) => {
  let d = Math.abs(u - c);
  if (d > 0.5) d = 1 - d;
  return d;
};

export interface HeadBuild {
  geometry: THREE.BufferGeometry;
  /** world-space rest positions of the two eye sockets (for eyeball placement) */
  eyeL: THREE.Vector3;
  eyeR: THREE.Vector3;
  headJointY: number;
  crownY: number;
}

export function buildHead(f: FaceParams, height: number, segs = 28, rings = 22): HeadBuild {
  const s = height / 1.8;
  const chinY = 1.595 * s - 0.030 * s * f.chinLength;
  const crownY = 1.795 * s;
  const span = crownY - chinY;
  const cy = (chinY + crownY) / 2;
  const rx = 0.080 * s * f.headWidth;
  const rz = 0.086 * s * f.headWidth;
  const ry = span / 2 * 0.96; // slightly squashed vertically → rounder crown

  const pos: number[] = [];
  const uv: number[] = [];
  const si: number[] = [];
  const sw: number[] = [];
  const idx: number[] = [];
  const headIdx = 0, neckIdx = 1;

  for (let j = 0; j <= rings; j++) {
    const v = j / rings;
    const phi = (v - 0.5) * Math.PI; // -π/2 bottom → π/2 top
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const th = (u - 0.5) * Math.PI * 2; // 0 → +Z front
      // base ellipsoid
      let R = 1;
      let zPush = 0;
      const front = gauss(du(u, 0.5), 0.22); // 1 at face center
      // nose: soft bridge ridge + broader tip/wings (no fins!)
      const noseBridge = gauss(du(u, 0.5), 0.028) * Math.max(0, 1 - Math.abs(v - 0.53) / 0.10) ** 2;
      const noseTip = gauss(du(u, 0.5), 0.022) * gauss(v, 0.485);
      const noseWings = (gauss(du(u, 0.487), 0.012) + gauss(du(u, 0.513), 0.012)) * gauss(v, 0.472);
      zPush += (noseBridge * 0.014 + noseTip * 0.020 * f.noseSize + noseWings * 0.008 * f.noseSize) * f.noseBridge;
      // eye sockets (gentle indent)
      const socket =
        gauss(du(u, 0.5 - 0.062 * f.eyeSpacing), 0.030) + gauss(du(u, 0.5 + 0.062 * f.eyeSpacing), 0.030);
      zPush -= socket * gauss(v, 0.605) * 0.004;
      // brow ridge
      const brow = gauss(du(u, 0.5 - 0.058), 0.035) + gauss(du(u, 0.5 + 0.058), 0.035);
      zPush += brow * gauss(v, 0.645) * 0.006 * f.browRidge;
      // cheekbones
      const cheek = gauss(du(u, 0.5 - 0.115), 0.05) + gauss(du(u, 0.5 + 0.115), 0.05);
      zPush += cheek * gauss(v, 0.53) * 0.007 * f.cheekbones;
      // lips
      zPush += gauss(du(u, 0.5), 0.040) * gauss(v, 0.405) * 0.005 * f.lipFullness;
      // chin
      zPush += gauss(du(u, 0.5), 0.075) * gauss(v, 0.26) * 0.007 * f.chinLength;
      // jaw width: lateral push at jaw height
      const jawBand = gauss(v, 0.34);
      const lat = Math.abs(Math.sin(th));
      R += jawBand * lat * (f.jawWidth - 1) * 0.35 * front;
      // temple flattening
      R -= gauss(du(u, 0.25), 0.08) * gauss(v, 0.62) * 0.03;
      R -= gauss(du(u, 0.75), 0.08) * gauss(v, 0.62) * 0.03;
      // back of skull slightly fuller
      R += gauss(du(u, 0), 0.3) * gauss(v, 0.6) * 0.04;

      const cp = Math.cos(phi), sp = Math.sin(phi);
      const ex = Math.sin(th) * cp * rx * R;
      const ez = (Math.cos(th) * cp * rz * R) + zPush * s * front;
      const ey = cy + sp * ry;
      pos.push(ex, ey, ez);
      uv.push(u, v);
      const neckBlend = v < 0.12 ? (0.12 - v) / 0.12 : 0;
      si.push(headIdx, neckIdx, 0, 0);
      sw.push(1 - neckBlend, neckBlend, 0, 0);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * (segs + 1) + i;
      const b = a + 1;
      const c = a + segs + 1;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();

  // eye socket world positions (match shading in skinTexture: u=0.5±0.062, v=0.60)
  const eyeV = 0.60;
  const phi = (eyeV - 0.5) * Math.PI;
  const eyeOff = 0.062 * f.eyeSpacing * Math.PI * 2;
  const mk = (sign: 1 | -1) => {
    const th = sign * eyeOff;
    return new THREE.Vector3(
      Math.sin(th) * Math.cos(phi) * rx * 0.92,
      cy + Math.sin(phi) * ry,
      Math.cos(th) * Math.cos(phi) * rz * 0.90,
    );
  };
  return { geometry: g, eyeL: mk(1), eyeR: mk(-1), headJointY: 1.60 * s, crownY };
}

/** Ears — two flattened shells, skinned to head. */
export function buildEars(f: FaceParams, height: number): THREE.BufferGeometry {
  const s = height / 1.8;
  const g1 = new THREE.SphereGeometry(0.014 * s, 8, 8);
  g1.scale(0.4, 1, 0.7);
  const x = 0.075 * s * f.headWidth;
  g1.translate(x, 1.60 * s + 0.085 * s, -0.004 * s);
  const g2 = g1.clone();
  g2.translate(-2 * x, 0, 0);
  // merge manually
  const merge = (a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry => {
    const geo = new THREE.BufferGeometry();
    const pa = a.getAttribute('position'), pb = b.getAttribute('position');
    const ua = a.getAttribute('uv'), ub = b.getAttribute('uv');
    const pos = new Float32Array([...(pa.array as Float32Array), ...(pb.array as Float32Array)]);
    const uv = new Float32Array([...(ua.array as Float32Array), ...(ub.array as Float32Array)]);
    const ia = a.getIndex()!.array, ib = b.getIndex()!.array;
    const idx = new Uint16Array(ia.length + ib.length);
    idx.set(ia); 
    for (let i = 0; i < ib.length; i++) idx[ia.length + i] = ib[i] + pa.count;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const n = pos.length / 3;
    const siA = new Uint16Array(n * 4);
    const swA = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { swA[i * 4] = 1; }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(siA, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(swA, 4));
    geo.computeVertexNormals();
    return geo;
  };
  return merge(g1, g2);
}
