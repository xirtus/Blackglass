import * as THREE from 'three';

/**
 * SurfaceBuilder — lofts elliptical rings into a single skinned BufferGeometry.
 * Every ring declares up to two bones and a blend factor, giving smooth skin
 * weights across joints without a DCC tool.
 */
export interface Ring {
  c: [number, number, number];      // center
  rx: number;                        // radius along basis u
  rz: number;                        // radius along basis w
  boneA: string;
  boneB?: string;
  blend?: number;                    // 0 = all boneA, 1 = all boneB
  /** ring basis vectors (default u=+X, w=+Z: horizontal ring). Must be ⟂. */
  u?: readonly [number, number, number];
  w?: readonly [number, number, number];
  /** optional radial modulation: theta (0..2π, 0=+w dir) → scale */
  shape?: (theta: number) => number;
  v?: number;                        // explicit v coordinate
}

export interface BuiltSurface {
  geometry: THREE.BufferGeometry;
  boneNames: string[];
}

export class SurfaceBuilder {
  private positions: number[] = [];
  private uvs: number[] = [];
  private skinIndex: number[] = [];
  private skinWeight: number[] = [];
  private indices: number[] = [];
  private boneNames: string[] = [];
  private boneLookup = new Map<string, number>();
  private ringStart: number[] = [];
  private segs: number;

  constructor(segments = 16) {
    this.segs = segments;
  }

  private boneIdx(name: string): number {
    let i = this.boneLookup.get(name);
    if (i === undefined) {
      i = this.boneNames.length;
      this.boneNames.push(name);
      this.boneLookup.set(name, i);
    }
    return i;
  }

  /** Append one ring; returns ring's first vertex index. */
  ring(r: Ring, v: number): number {
    const start = this.positions.length / 3;
    const a = this.boneIdx(r.boneA);
    const b = r.boneB !== undefined ? this.boneIdx(r.boneB) : a;
    const blend = r.blend ?? 0;
    const uu = r.u ?? [1, 0, 0];
    const ww = r.w ?? [0, 0, 1];
    for (let i = 0; i <= this.segs; i++) {
      const t = (i / this.segs) * Math.PI * 2;
      const sx = Math.sin(t);
      const sz = Math.cos(t);
      const mod = r.shape ? r.shape(t) : 1;
      this.positions.push(
        r.c[0] + (sx * r.rx * uu[0] + sz * r.rz * ww[0]) * mod,
        r.c[1] + (sx * r.rx * uu[1] + sz * r.rz * ww[1]) * mod,
        r.c[2] + (sx * r.rx * uu[2] + sz * r.rz * ww[2]) * mod,
      );
      this.uvs.push(i / this.segs, v);
      this.skinIndex.push(a, b, 0, 0);
      this.skinWeight.push(1 - blend, blend, 0, 0);
    }
    this.ringStart.push(start);
    return start;
  }

  /** Stitch the last K rings together in order. */
  stitch(count: number): void {
    const n = this.ringStart.length;
    for (let r = n - count; r < n - 1; r++) {
      const s0 = this.ringStart[r];
      const s1 = this.ringStart[r + 1];
      for (let i = 0; i < this.segs; i++) {
        const a0 = s0 + i, a1 = s0 + i + 1, b0 = s1 + i, b1 = s1 + i + 1;
        this.indices.push(a0, a1, b0, a1, b1, b0);
      }
    }
  }

  /** Loft a sequence of rings (calls ring()+stitch for you). */
  loft(rings: Ring[], v0 = 0, v1 = 1): void {
    let prevCount = 0;
    rings.forEach((r, i) => {
      const v = r.v ?? (v0 + ((v1 - v0) * i) / Math.max(1, rings.length - 1));
      this.ring(r, v);
      if (prevCount > 0) this.stitch(2);
      prevCount++;
    });
  }

  /** Cap the FIRST ring of the builder (fan, reversed winding). Center auto = ring centroid. */
  capStart(v: number): void {
    const first = this.ringStart[0];
    const px = this.positions;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i <= this.segs; i++) { cx += px[(first + i) * 3]; cy += px[(first + i) * 3 + 1]; cz += px[(first + i) * 3 + 2]; }
    cx /= this.segs + 1; cy /= this.segs + 1; cz /= this.segs + 1;
    const cStart = px.length / 3;
    this.boneIdx('__cap__');
    this.positions.push(cx, cy, cz);
    this.uvs.push(0.5, v);
    // weight to same bones as first vertex of first ring
    const si0 = this.skinIndex.slice(first * 4, first * 4 + 4);
    const sw0 = this.skinWeight.slice(first * 4, first * 4 + 4);
    this.skinIndex.push(si0[0], si0[1], 0, 0);
    this.skinWeight.push(sw0[0], sw0[1], 0, 0);
    this.boneNames.pop(); this.boneLookup.delete('__cap__');
    for (let i = 0; i < this.segs; i++) this.indices.push(cStart, first + i, first + i + 1);
  }

  /** Cap the last ring with a fan to a center point. */
  cap(r: Ring, v: number, up: 1 | -1): void {
    const cStart = this.positions.length / 3;
    const a = this.boneIdx(r.boneA);
    const b = r.boneB !== undefined ? this.boneIdx(r.boneB) : a;
    const blend = r.blend ?? 0;
    this.positions.push(r.c[0], r.c[1], r.c[2]);
    this.uvs.push(0.5, v);
    this.skinIndex.push(a, b, 0, 0);
    this.skinWeight.push(1 - blend, blend, 0, 0);
    const lastRing = this.ringStart[this.ringStart.length - 1];
    for (let i = 0; i < this.segs; i++) {
      if (up > 0) this.indices.push(cStart, lastRing + i + 1, lastRing + i);
      else this.indices.push(cStart, lastRing + i, lastRing + i + 1);
    }
  }

  /** Ensure all triangles face outward (radially away from their ring centers). */
  private orientOutward(): void {
    if (this.indices.length < 3 || this.ringStart.length < 2) return;
    // test the first stitched quad: geometric normal vs radial direction
    const i0 = this.indices[0], i1 = this.indices[1], i2 = this.indices[2];
    const P = this.positions;
    const ax = P[i0 * 3], ay = P[i0 * 3 + 1], az = P[i0 * 3 + 2];
    const bx = P[i1 * 3], by = P[i1 * 3 + 1], bz = P[i1 * 3 + 2];
    const cx = P[i2 * 3], cy = P[i2 * 3 + 1], cz = P[i2 * 3 + 2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    // radial: from the quad's average ring-center axis (approx: centroid of first two rings)
    let c0x = 0, c0y = 0, c0z = 0, c1x = 0, c1y = 0, c1z = 0, n0 = 0, n1 = 0;
    const r0 = this.ringStart[0], r1 = this.ringStart[1];
    for (let i = 0; i <= this.segs; i++) {
      c0x += P[(r0 + i) * 3]; c0y += P[(r0 + i) * 3 + 1]; c0z += P[(r0 + i) * 3 + 2]; n0++;
      c1x += P[(r1 + i) * 3]; c1y += P[(r1 + i) * 3 + 1]; c1z += P[(r1 + i) * 3 + 2]; n1++;
    }
    c0x /= n0; c0y /= n0; c0z /= n0; c1x /= n1; c1y /= n1; c1z /= n1;
    // axis of the loft
    const axx = c1x - c0x, axy = c1y - c0y, axz = c1z - c0z;
    // outward = radial component of (tri center - c0) perpendicular to axis
    let rx = ax - c0x, ry = ay - c0y, rz = az - c0z;
    const dot = rx * axx + ry * axy + rz * axz;
    rx -= dot * axx; ry -= dot * axy; rz -= dot * axz;
    const facing = nx * rx + ny * ry + nz * rz;
    if (facing < 0) {
      for (let i = 0; i < this.indices.length; i += 3) {
        const t = this.indices[i + 1];
        this.indices[i + 1] = this.indices[i + 2];
        this.indices[i + 2] = t;
      }
    }
  }

  build(): BuiltSurface {
    this.orientOutward();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.skinWeight, 4));
    g.setIndex(this.indices);
    g.computeVertexNormals();
    return { geometry: g, boneNames: this.boneNames };
  }
}

/** Merge several BuiltSurfaces into one geometry + unified bone name table. */
export function mergeSurfaces(parts: BuiltSurface[]): BuiltSurface {
  const boneNames: string[] = [];
  const lookup = new Map<string, number>();
  const geos: THREE.BufferGeometry[] = [];
  for (const p of parts) {
    const remap = p.boneNames.map((n) => {
      let i = lookup.get(n);
      if (i === undefined) {
        i = boneNames.length;
        boneNames.push(n);
        lookup.set(n, i);
      }
      return i;
    });
    const g = p.geometry.clone();
    const si = g.getAttribute('skinIndex') as THREE.Uint16BufferAttribute;
    for (let i = 0; i < si.count; i++) {
      si.setXY(i, remap[si.getX(i)], remap[si.getY(i)]);
    }
    geos.push(g);
  }
  // manual merge (positions/uv/skin/index) — avoids BufferGeometryUtils dep
  let vCount = 0;
  let iCount = 0;
  for (const g of geos) {
    vCount += g.getAttribute('position').count;
    iCount += g.getIndex()!.count;
  }
  const pos = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const si = new Uint16Array(vCount * 4);
  const sw = new Float32Array(vCount * 4);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const g of geos) {
    const n = g.getAttribute('position').count;
    pos.set((g.getAttribute('position') as THREE.BufferAttribute).array as Float32Array, vo * 3);
    uv.set((g.getAttribute('uv') as THREE.BufferAttribute).array as Float32Array, vo * 2);
    si.set((g.getAttribute('skinIndex') as THREE.BufferAttribute).array as Uint16Array, vo * 4);
    sw.set((g.getAttribute('skinWeight') as THREE.BufferAttribute).array as Float32Array, vo * 4);
    const gi = g.getIndex()!.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += n;
    io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  out.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeVertexNormals();
  return { geometry: out, boneNames };
}
