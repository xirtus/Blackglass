import { SurfaceBuilder, mergeSurfaces, type BuiltSurface, type Ring } from './mesh';
import type { BodyParams } from './profiles';

/**
 * Parametric humanoid body built directly on the XIRTUS_HUMANOID_V1 rest pose.
 * Everything is scaled by s = height/1.8 so skinning matches the rig exactly.
 */

const S = (v: number, s: number) => v * s;

type V3 = [number, number, number];
const lerp3 = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
];

export interface BodyBuildOptions {
  segs?: number;          // radial segments (hero 20, gameplay 14, distant 8)
  ringsPerLimb?: number;  // hero 8, gameplay 6, distant 4
  fingers?: boolean;      // hero only
}

/** Build torso + neck + arms + hands + legs + feet as one skinned surface set. */
export function buildBody(p: BodyParams, opts: BodyBuildOptions = {}): BuiltSurface {
  const s = p.height / 1.8;
  const segs = opts.segs ?? 16;
  const nLimb = opts.ringsPerLimb ?? 6;
  const muscle = p.muscle;
  void muscle;

  const parts: BuiltSurface[] = [];

  // ── Torso: hips (0.90) → shoulders (1.52) ──────────────────────────────
  {
    const b = new SurfaceBuilder(segs);
    const torsoRings = torsoRingSet(p);

    b.loft(torsoRings, 0, 0.62);
    parts.push(b.build());

    // Neck tube
    const nb = new SurfaceBuilder(Math.max(8, segs - 4));
    nb.loft([
      { c: [0, S(1.46, s), S(0.005, s)], rx: S(0.058, s), rz: S(0.060, s), boneA: 'spine_03', boneB: 'neck_01', blend: 0.5 },
      { c: [0, S(1.53, s), S(0.008, s)], rx: S(0.048, s), rz: S(0.050, s), boneA: 'neck_01' },
      { c: [0, S(1.60, s), S(0.010, s)], rx: S(0.046, s), rz: S(0.048, s), boneA: 'neck_01', boneB: 'head', blend: 0.6 },
    ], 0.62, 0.7);
    parts.push(nb.build());
  }

  // ── Arms ────────────────────────────────────────────────────────────────
  const buildArm = (side: 1 | -1): void => {
    const L = side === 1 ? 'l' : 'r';
    const el: V3 = [S(0.408 * side, s), S(1.242, s), 0];
    const wr: V3 = [S(0.599 * side, s), S(1.051, s), 0];
    const d2: V3 = [wr[0] - el[0], wr[1] - el[1], 0];
    const norm = (v: V3): V3 => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
    const d2n = norm(d2);

    const b = new SurfaceBuilder(Math.max(8, segs - 4));
    const rings = armRingSet(p, side, nLimb);
    b.loft(rings, 0.1, 0.42);
    parts.push(b.build());

    // ── Hand: palm slab + thumb + optional finger tubes ──────────────────
    const hb = new SurfaceBuilder(Math.max(6, segs - 8));
    const fd: V3 = d2n; // hand continues along forearm dir
    const pu: V3 = [fd[1], -fd[0], 0]; // palm width dir (in XY)
    const pw: V3 = [0, 0, 1];          // palm thickness dir
    const palmLen = S(0.085, s), palmW = S(0.040, s), palmT = S(0.016, s);
    const handRings: Ring[] = [];
    for (let i = 0; i <= 3; i++) {
      const t = i / 3;
      const c = lerp3(wr, [wr[0] + fd[0] * palmLen, wr[1] + fd[1] * palmLen, wr[2]], t);
      const taper = 1 - t * 0.15;
      handRings.push({ c, rx: palmW * taper, rz: palmT * (1 - t * 0.1), boneA: `hand_${L}`, u: pu, w: pw });
    }
    hb.loft(handRings, 0.42, 0.52);
    hb.cap({ c: [wr[0] + fd[0] * palmLen, wr[1] + fd[1] * palmLen, wr[2]], rx: 0, rz: 0, boneA: `hand_${L}`, u: pu, w: pw }, 0.52, 1);
    parts.push(hb.build());

    if (opts.fingers) {
      // five finger tubes (3 segments), weighted to canonical finger bones
      const fingerBases: [string, number, number][] = [
        ['thumb', 0.030, 0.030], ['index', 0.082, 0.034], ['middle', 0.090, 0.011],
        ['ring', 0.082, -0.011], ['pinky', 0.070, -0.032],
      ];
      for (const [fname, along, zoff] of fingerBases) {
        const fb = new SurfaceBuilder(5);
        const base: V3 = [wr[0] + fd[0] * S(along, s), wr[1] + fd[1] * S(along, s), wr[2] + S(zoff, s)];
        const segLens = fname === 'thumb' ? [0.032, 0.028, 0.022] : [0.030, 0.022, 0.016];
        // thumb points more forward/outward
        const dir0: V3 = fname === 'thumb' ? norm([fd[0] * 0.7, fd[1] * 0.7, 0.6 * side * 0.7]) : fd;
        // slight natural curl baked in: rotate each segment about the palm axis
        const pax: V3 = [fd[1], -fd[0], 0];
        const fr = S(fname === 'thumb' ? 0.010 : 0.0085, s);
        const rings: Ring[] = [];
        let c = base;
        let acc = 0;
        let dir: V3 = dir0;
        const total = segLens.reduce((a, x) => a + x, 0) * s;
        for (let sg = 0; sg < 3; sg++) {
          const boneName = `${fname}_0${sg + 1}_${L}`;
          const blend0 = sg === 0 ? 0 : 0.5;
          rings.push({ c: [...c], rx: fr * (1 - sg * 0.18), rz: fr * (1 - sg * 0.18), boneA: sg === 0 ? `hand_${L}` : `${fname}_0${sg}_${L}`, boneB: boneName, blend: blend0 + 0.5, u: pu, w: pw });
          const nl = S(segLens[sg], s);
          c = [c[0] + dir[0] * nl, c[1] + dir[1] * nl, c[2] + dir[2] * nl];
          acc += nl;
          // curl the next segment ~14° about the palm-width axis
          {
            const ang = -0.24 * side * (fname === 'thumb' ? 0.4 : 1);
            const ca = Math.cos(ang), sa = Math.sin(ang);
            const dot = dir[0] * pax[0] + dir[1] * pax[1] + dir[2] * pax[2];
            const cx = pax[1] * dir[2] - pax[2] * dir[1], cy = pax[2] * dir[0] - pax[0] * dir[2], cz = pax[0] * dir[1] - pax[1] * dir[0];
            dir = norm([
              dir[0] * ca + cx * sa + pax[0] * dot * (1 - ca),
              dir[1] * ca + cy * sa + pax[1] * dot * (1 - ca),
              dir[2] * ca + cz * sa + pax[2] * dot * (1 - ca),
            ]);
          }
          rings.push({ c: [...c], rx: fr * (1 - (sg + 1) * 0.18), rz: fr * (1 - (sg + 1) * 0.18), boneA: boneName, boneB: sg < 2 ? `${fname}_0${sg + 2}_${L}` : undefined, blend: sg < 2 ? 0.5 : 0, u: pu, w: pw });
        }
        fb.loft(rings, 0.52, 0.52 + 0.2 * (acc / Math.max(total, 1e-6)));
        fb.cap(rings[rings.length - 1], 0.75, 1);
        parts.push(fb.build());
      }
    }
  };
  buildArm(1);
  buildArm(-1);

  // ── Legs ────────────────────────────────────────────────────────────────
  const buildLeg = (side: 1 | -1): void => {
    const L = side === 1 ? 'l' : 'r';
    const ank: V3 = [S(0.105 * side, s), S(0.100, s), 0];
    const b = new SurfaceBuilder(Math.max(8, segs - 4));
    const rings = legRingSet(p, side, nLimb);
    b.loft(rings, 0.0, 0.35);
    parts.push(b.build());

    // ── Foot: forward loft from ankle ─────────────────────────────────────
    const fb = new SurfaceBuilder(Math.max(8, segs - 6));
    const toe: V3 = [S(0.105 * side, s), S(0.035, s), S(0.165, s)];
    const fr: Ring[] = [];
    for (let i = 0; i <= 3; i++) {
      const t = i / 3;
      const c = lerp3([ank[0], S(0.075, s), S(-0.01, s)], toe, t);
      fr.push({
        c, rx: S(0.046 - t * 0.008, s), rz: S(0.048 - t * 0.014, s),
        boneA: `foot_${L}`, boneB: t > 0.6 ? `ball_${L}` : i === 0 ? `calf_${L}` : undefined,
        blend: i === 0 ? 0.4 : t > 0.6 ? (t - 0.6) * 2 : 0,
        u: [1, 0, 0], w: [0, 1, 0],
      });
    }
    fb.loft(fr, 0.35, 0.5);
    fb.cap(fr[fr.length - 1], 0.5, 1);
    // heel cap
    parts.push(fb.build());
  };
  buildLeg(1);
  buildLeg(-1);

  return mergeSurfaces(parts);
}

// ─── Shared ring sets (single source of truth for body AND clothing) ──────

export function torsoRingSet(p: BodyParams): Ring[] {
  const s = p.height / 1.8;
  const bulk = 1 + p.fat * 0.35;
  const mBulk = 1 + p.muscle * 0.22;
  const sw = p.shoulderWidth;
  const S2 = (v: number) => v * s;
  const rings: Ring[] = [];
  const sec = (
    y: number, rx: number, rz: number, boneA: string, boneB: string | undefined, blend: number,
    shape?: (t: number) => number,
  ) => rings.push({ c: [0, S2(y), 0], rx: S2(rx), rz: S2(rz), boneA, boneB, blend, shape });
  const butt = (amt: number) => (t: number) => 1 + amt * Math.max(0, -Math.cos(t)) ** 2;
  const belly = (amt: number) => (t: number) => 1 + amt * Math.max(0, Math.cos(t)) ** 2;
  sec(0.905, 0.148 * bulk, 0.118 * bulk, 'hips', undefined, 0, butt(0.10 + p.fat * 0.08));
  sec(0.945, 0.156 * bulk, 0.120 * bulk, 'hips', undefined, 0, butt(0.12 + p.fat * 0.06));
  sec(0.990, 0.150 * bulk, 0.112 * bulk, 'hips', 'spine_01', 0.25, butt(0.06));
  sec(1.045, 0.138 * bulk, 0.104 * bulk, 'hips', 'spine_01', 0.7, belly(p.fat * 0.10));
  sec(1.100, 0.130 * (1 + p.fat * 0.28), 0.098 * (1 + p.fat * 0.3), 'spine_01', undefined, 0, belly(p.fat * 0.14));
  sec(1.155, 0.136 * (1 + p.fat * 0.22), 0.100 * (1 + p.fat * 0.24), 'spine_01', 'spine_02', 0.5, belly(p.fat * 0.10));
  sec(1.215, 0.148 * mBulk * (1 + p.fat * 0.15), 0.104 * bulk, 'spine_02', undefined, 0);
  sec(1.280, 0.158 * mBulk * sw, 0.108 * mBulk, 'spine_02', 'spine_03', 0.35);
  sec(1.340, 0.163 * mBulk * sw, 0.110 * mBulk, 'spine_03', undefined, 0);
  sec(1.395, 0.165 * mBulk * sw, 0.106 * mBulk, 'spine_03', undefined, 0);
  sec(1.445, 0.152 * sw, 0.098, 'spine_03', 'neck_01', 0.12);
  sec(1.468, 0.128 * sw, 0.089, 'spine_03', 'neck_01', 0.35);
  sec(1.490, 0.100 * sw, 0.080, 'spine_03', 'neck_01', 0.6);
  return rings;
}

export function armRingSet(p: BodyParams, side: 1 | -1, nLimb = 6): Ring[] {
  const s = p.height / 1.8;
  const muscle = p.muscle;
  const L = side === 1 ? 'l' : 'r';
  const S2 = (v: number) => v * s;
  const sh: V3 = [S2(0.210 * side), S2(1.440), 0];
  const el: V3 = [S2(0.408 * side), S2(1.242), 0];
  const wr: V3 = [S2(0.599 * side), S2(1.051), 0];
  const d1: V3 = [el[0] - sh[0], el[1] - sh[1], 0];
  const d2: V3 = [wr[0] - el[0], wr[1] - el[1], 0];
  const norm = (v: V3): V3 => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
  const d1n = norm(d1), d2n = norm(d2);
  const b1 = { u: [d1n[1], -d1n[0], 0] as V3, w: [0, 0, 1] as V3 };
  const b2 = { u: [d2n[1], -d2n[0], 0] as V3, w: [0, 0, 1] as V3 };
  const mBulk = 1 + muscle * 0.22;
  const rDelt = S2(0.058 * mBulk), rElb = S2(0.043);
  const rFore = S2(0.044 * (1 + muscle * 0.15)), rWrist = S2(0.032);
  const rings: Ring[] = [];
  for (let i = 0; i <= nLimb; i++) {
    const t = i / nLimb;
    const c = lerp3(sh, el, t);
    const r = (rDelt + (rElb - rDelt) * t) * (1 + 0.18 * muscle * Math.sin(t * Math.PI));
    rings.push({ c, rx: r, rz: r * 0.92, boneA: `upperarm_${L}`, boneB: i < 3 ? `clavicle_${L}` : `lowerarm_${L}`, blend: i < 3 ? 0.62 - i * 0.2 : t > 0.8 ? (t - 0.8) * 5 : 0, u: b1.u, w: b1.w });
  }
  for (let i = 1; i <= nLimb; i++) {
    const t = i / nLimb;
    const c = lerp3(el, wr, t);
    const r = rFore + (rWrist - rFore) * t * t;
    rings.push({ c, rx: r, rz: r * 0.9, boneA: `lowerarm_${L}`, boneB: `hand_${L}`, blend: t > 0.75 ? (t - 0.75) * 4 : 0, u: b2.u, w: b2.w });
  }
  return rings;
}

export function legRingSet(p: BodyParams, side: 1 | -1, nLimb = 6): Ring[] {
  const s = p.height / 1.8;
  const muscle = p.muscle, fat = p.fat;
  const L = side === 1 ? 'l' : 'r';
  const S2 = (v: number) => v * s;
  const mBulk = 1 + muscle * 0.22;
  const hip: V3 = [S2(0.105 * side), S2(0.940), 0];
  const knee: V3 = [S2(0.105 * side), S2(0.500), 0];
  const ank: V3 = [S2(0.105 * side), S2(0.100), 0];
  const rThigh = S2(0.088 * (mBulk + fat * 0.25)), rKnee = S2(0.058);
  const rCalf = S2(0.068 * (1 + muscle * 0.18)), rAnk = S2(0.042);
  const rings: Ring[] = [];
  for (let i = 0; i <= nLimb; i++) {
    const t = i / nLimb;
    const c = lerp3(hip, knee, t);
    const r = rThigh + (rKnee - rThigh) * t;
    rings.push({
      c, rx: r, rz: r * 1.02, boneA: `thigh_${L}`,
      boneB: i === 0 ? 'hips' : t > 0.8 ? `calf_${L}` : undefined,
      blend: i === 0 ? 0.35 : t > 0.8 ? (t - 0.8) * 5 : 0,
    });
  }
  for (let i = 1; i <= nLimb; i++) {
    const t = i / nLimb;
    const c = lerp3(knee, ank, t);
    const r = rCalf + (rAnk - rCalf) * t + Math.sin(t * Math.PI) * S2(0.012) * muscle;
    rings.push({ c, rx: r, rz: r, boneA: `calf_${L}`, boneB: `foot_${L}`, blend: t > 0.8 ? (t - 0.8) * 5 : 0 });
  }
  return rings;
}

/** Offset a ring set outward (clothing shells). */
export function offsetRings(rings: Ring[], d: number, v?: { v0: number; v1: number }): Ring[] {
  return rings.map((r, i) => ({
    ...r,
    rx: r.rx + d,
    rz: r.rz + d,
    v: v ? v.v0 + ((v.v1 - v.v0) * i) / Math.max(1, rings.length - 1) : r.v,
  }));
}
