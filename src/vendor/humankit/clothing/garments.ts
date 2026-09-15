import { SurfaceBuilder, mergeSurfaces, type BuiltSurface, type Ring } from '../body/mesh';
import { torsoRingSet, armRingSet, legRingSet, offsetRings } from '../body/body';
import type { BodyParams } from '../body/profiles';

/**
 * Garments are concentric shells over the SAME ring sets as the body
 * (identical centers, weights and blends + outward offset), so clothing
 * can never sink inside the body or deform differently.
 */

export interface GarmentOptions {
  segs?: number;
  sleeve?: 'none' | 'short' | 'long';
  length?: 'shorts' | 'long';
  offset?: number;
}

/** Keep only torso rings above a height (shirt covers waist-up). */
function shirtRings(p: BodyParams, off: number): Ring[] {
  const s = p.height / 1.8;
  const rings = torsoRingSet(p).filter((r) => r.c[1] >= 1.015 * s);
  // drop the tiny neck-shoulder rings; shirt ends at the collar
  const kept = rings.filter((r) => r.c[1] <= 1.475 * s);
  return offsetRings(kept, off).map((r, i) => ({ ...r, v: i / Math.max(1, kept.length - 1) }));
}

export function buildShirt(p: BodyParams, opts: GarmentOptions = {}): BuiltSurface {
  const s = p.height / 1.8;
  const segs = opts.segs ?? 14;
  const off = (opts.offset ?? 0.014) * s;
  const parts: BuiltSurface[] = [];

  const b = new SurfaceBuilder(segs);
  const torso = shirtRings(p, off);
  b.loft(torso, 0, 0.94);
  // collar handled by the texture's top band (v≈1) — no floating geometry
  parts.push(b.build());

  if (opts.sleeve !== 'none') {
    const sleeveT = opts.sleeve === 'long' ? 1.0 : 0.36;
    for (const side of [1, -1] as const) {
      const full = armRingSet(p, side, 8);
      const n = Math.max(2, Math.round(8 * sleeveT));
      const sleeve = offsetRings(full.slice(0, n + 1), off * 0.9);
      // shoulder gusset: first ring reaches into the torso so raised arms never gap
      sleeve[0] = { ...sleeve[0], c: [sleeve[0].c[0] - side * 0.03 * s, sleeve[0].c[1] + 0.008 * s, sleeve[0].c[2]], rx: sleeve[0].rx + 0.010 * s, rz: sleeve[0].rz + 0.010 * s };
      const sb = new SurfaceBuilder(Math.max(8, segs - 4));
      sb.loft(sleeve, 0.78, 0.88); // clear zone of the shirt texture (no prints)
      sb.capStart(0.78);
      parts.push(sb.build());
    }
  }
  return mergeSurfaces(parts);
}

export function buildTrousers(p: BodyParams, opts: GarmentOptions = {}): BuiltSurface {
  const s = p.height / 1.8;
  const segs = opts.segs ?? 12;
  const off = (opts.offset ?? 0.012) * s;
  const shorts = opts.length === 'shorts';
  const parts: BuiltSurface[] = [];

  // pelvis/hips cover from the torso ring set (below chest)
  const hipRings = offsetRings(torsoRingSet(p).filter((r) => r.c[1] <= 1.10 * s), off).map((r, i, arr) => ({ ...r, v: (i / arr.length) * 0.18 }));
  const pb = new SurfaceBuilder(segs);
  pb.loft(hipRings, 0, 0.18);
  parts.push(pb.build());

  for (const side of [1, -1] as const) {
    const full = legRingSet(p, side, 8);
    const rings = shorts ? full.filter((r) => r.c[1] >= 0.62 * s) : full;
    const shell = offsetRings(rings, off);
    const b = new SurfaceBuilder(Math.max(8, segs - 2));
    b.loft(shell, 0.18, 1);
    if (shorts) b.cap({ c: shell[shell.length - 1].c, rx: 0, rz: 0, boneA: `thigh_${side === 1 ? 'l' : 'r'}` }, 1, 1);
    parts.push(b.build());
  }
  return mergeSurfaces(parts);
}

export function buildShoes(p: BodyParams, _opts: GarmentOptions = {}): BuiltSurface {
  void _opts;
  const s = p.height / 1.8;
  const parts: BuiltSurface[] = [];
  for (const side of [1, -1] as const) {
    const L = side === 1 ? 'l' : 'r';
    const b = new SurfaceBuilder(10);
    const rings: Ring[] = [];
    const from: [number, number, number] = [0.105 * side * s, 0.088 * s, -0.022 * s];
    const to: [number, number, number] = [0.105 * side * s, 0.045 * s, 0.178 * s];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const c: [number, number, number] = [
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
        from[2] + (to[2] - from[2]) * t,
      ];
      rings.push({
        c, rx: (0.056 - t * 0.008) * s, rz: (0.056 - t * 0.016) * s,
        boneA: `foot_${L}`, boneB: t > 0.6 ? `ball_${L}` : i === 0 ? `calf_${L}` : undefined,
        blend: i === 0 ? 0.35 : t > 0.6 ? (t - 0.6) * 2 : 0,
        u: [1, 0, 0], w: [0, 1, 0],
      });
    }
    b.loft(rings, 0, 1);
    b.cap(rings[rings.length - 1], 1, 1);
    parts.push(b.build());
  }
  return mergeSurfaces(parts);
}
