import * as THREE from 'three';
import type { FaceParams, HumanDNA } from './profiles';
import { rng } from './profiles';

/**
 * Parametric hair shell over the cranium. Same UV convention as head
 * (u 0.5 = front, v 0 = chin, v 1 = crown). Skinned fully to `head`.
 */
export function buildHair(dna: HumanDNA, f: FaceParams, height: number, segs = 24, rings = 14): THREE.BufferGeometry | null {
  if (dna.hairStyle === 'bald') return null;
  const s = height / 1.8;
  const r = rng(dna.seed * 13 + 7);
  const chinY = 1.60 * s - 0.035 * s * f.chinLength;
  const crownY = 1.80 * s;
  const span = crownY - chinY;
  const cy = (chinY + crownY) / 2;
  const rx = 0.077 * s * f.headWidth;
  const rz = 0.084 * s * f.headWidth;
  const ry = span / 2;

  // thickness per style
  const thick =
    dna.hairStyle === 'buzz' ? 0.0045 :
    dna.hairStyle === 'fade' ? 0.007 :
    dna.hairStyle === 'short-curly' ? 0.016 :
    dna.hairStyle === 'long' ? 0.012 : 0.011;
  const noiseAmp = dna.hairStyle === 'short-curly' ? 0.006 : dna.hairStyle === 'buzz' ? 0.001 : 0.003;
  const noise: number[] = [];
  for (let i = 0; i < 400; i++) noise.push((r() - 0.5) * 2);

  // hairline: v threshold as function of u (lower = more coverage)
  const hairline = (u: number): number => {
    const dFront = Math.abs(u - 0.5) > 0.5 ? 1 - Math.abs(u - 0.5) : Math.abs(u - 0.5);
    const frontness = Math.exp(-(dFront * dFront) / (2 * 0.26 * 0.26)); // 1 at face, smooth falloff
    const backness = Math.exp(-(Math.min(Math.abs(u), 1 - Math.abs(u)) ** 2) / (2 * 0.28 * 0.28));
    let line = 0.50 + 0.20 * frontness - 0.16 * backness;
    line = Math.max(line, 0.60 - 0.10 * backness); // never dangle past temple level
    if (dna.hairStyle === 'buzz' || dna.hairStyle === 'fade') line -= 0.06;
    if (dna.hairStyle === 'long') line -= 0.22;
    if (dna.hairStyle === 'side-part') line += 0.02 * Math.sin(u * Math.PI * 2);
    return line;
  };

  const pos: number[] = [];
  const uvA: number[] = [];
  const si: number[] = [];
  const sw: number[] = [];
  const idx: number[] = [];
  const vertMap = new Map<string, number>();

  const vAt = (i: number, j: number): number | null => {
    const u = i / segs;
    const v = 0.2 + (j / rings) * 0.8; // only top region
    if (v < hairline(u)) return null;
    const key = `${i},${j}`;
    const cached = vertMap.get(key);
    if (cached !== undefined) return cached;
    const phi = (v - 0.5) * Math.PI;
    const th = (u - 0.5) * Math.PI * 2;
    const cp = Math.cos(phi), sp = Math.sin(phi);
    // fade: thinner at the bottom edge of the covered region
    let t = thick;
    if (dna.hairStyle === 'fade') t *= Math.min(1, (v - hairline(u)) * 6);
    const n = noise[(i * 31 + j * 17) % 400] * noiseAmp;
    const R = 1 + (t + n) / Math.max(rx, 1e-6);
    const R2 = 1 + (t + n) / Math.max(rz, 1e-6);
    const Ry = 1 + (t + n) / Math.max(ry, 1e-6);
    pos.push(Math.sin(th) * cp * rx * R, cy + sp * ry * Ry, Math.cos(th) * cp * rz * R2);
    uvA.push(u, v);
    si.push(0, 0, 0, 0);
    sw.push(1, 0, 0, 0);
    const id = pos.length / 3 - 1;
    vertMap.set(key, id);
    return id;
  };

  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segs; i++) {
      const a = vAt(i, j), b = vAt(i + 1, j), c = vAt(i, j + 1), d = vAt(i + 1, j + 1);
      if (a == null || b == null || c == null || d == null) continue;
      idx.push(a, b, c, b, d, c);
    }
  }
  if (pos.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvA, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Beard shell over the jaw/chin region. */
export function buildBeard(dna: HumanDNA, f: FaceParams, height: number): THREE.BufferGeometry | null {
  if (dna.beardStyle === 'none' || dna.beardStyle === 'stubble') return null; // stubble is texture-only
  const s = height / 1.8;
  const segs = 20, rings = 8;
  const chinY = 1.60 * s - 0.035 * s * f.chinLength;
  const crownY = 1.80 * s;
  const span = crownY - chinY;
  const cy = (chinY + crownY) / 2;
  const rx = 0.080 * s * f.headWidth;
  const rz = 0.087 * s * f.headWidth;
  const ry = span / 2;
  const thick = dna.beardStyle === 'full' ? 0.007 : 0.004;

  const pos: number[] = [];
  const si: number[] = [];
  const sw: number[] = [];
  const idx: number[] = [];
  const cov = (u: number, v: number): boolean => {
    const d = Math.abs(u - 0.5);
    // chin/jaw band: front center below lips, wrapping slightly to jaw sides
    return v > 0.16 && v < 0.38 && d < 0.16;
  };
  const ids = new Map<string, number>();
  const vAt = (i: number, j: number): number | null => {
    const u = 0.34 + (i / segs) * 0.32;
    const v = 0.14 + (j / rings) * 0.28;
    if (!cov(u, v)) return null;
    const key = `${i},${j}`;
    if (ids.has(key)) return ids.get(key)!;
    const phi = (v - 0.5) * Math.PI;
    const th = (u - 0.5) * Math.PI * 2;
    const cp = Math.cos(phi), sp = Math.sin(phi);
    pos.push(Math.sin(th) * cp * (rx + thick), cy + sp * (ry + thick * 0.5), Math.cos(th) * cp * (rz + thick));
    si.push(0, 0, 0, 0); sw.push(1, 0, 0, 0);
    const id = pos.length / 3 - 1;
    ids.set(key, id);
    return id;
  };
  for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) {
    const a = vAt(i, j), b = vAt(i + 1, j), c = vAt(i, j + 1), d = vAt(i + 1, j + 1);
    if (a == null || b == null || c == null || d == null) continue;
    idx.push(a, b, c, b, d, c);
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
