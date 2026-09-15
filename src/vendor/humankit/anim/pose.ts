import * as THREE from 'three';

/**
 * PoseWriter — the DSL every HumanKit animation is written in.
 * Animations are pure functions (t, writer) => void, baked to real
 * THREE.AnimationClips at 30fps on the canonical rig. Because the rig is
 * REST-ALIGNED (identity local rotations at rest), every value written here
 * is simply "local euler offset from rest", which blends and layers cleanly.
 */
export class PoseWriter {
  readonly eulers = new Map<string, THREE.Euler>();
  readonly quats = new Map<string, THREE.Quaternion>();
  readonly positions = new Map<string, THREE.Vector3>();

  /** set local euler offset (radians) for a bone */
  set(bone: string, x: number, y = 0, z = 0): this {
    let e = this.eulers.get(bone);
    if (!e) { e = new THREE.Euler(); this.eulers.set(bone, e); }
    e.set(x, y, z);
    return this;
  }
  /** add to existing euler */
  add(bone: string, x: number, y = 0, z = 0): this {
    const e = this.eulers.get(bone);
    if (e) e.set(e.x + x, e.y + y, e.z + z);
    else this.set(bone, x, y, z);
    return this;
  }
  /** set local position offset from rest (mainly hips/root) */
  pos(bone: string, x: number, y: number, z: number): this {
    let p = this.positions.get(bone);
    if (!p) { p = new THREE.Vector3(); this.positions.set(bone, p); }
    p.set(x, y, z);
    return this;
  }
  /** rotate about an arbitrary world-space axis (e.g. finger curl about palm axis) */
  axis(bone: string, ax: number, ay: number, az: number, angle: number): this {
    let q = this.quats.get(bone);
    if (!q) { q = new THREE.Quaternion(); this.quats.set(bone, q); }
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(ax, ay, az).normalize(), angle));
    return this;
  }
  /** curl all fingers of one hand; side: 1 = left, -1 = right; amount 0..1 */
  curlFingers(side: 1 | -1, amount: number): this {
    const L = side === 1 ? 'l' : 'r';
    const ax = -0.7071 * side, ay = -0.7071, az = 0; // palm-width axis
    for (const f of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
      const mul = f === 'thumb' ? 0.5 : 1;
      for (let s = 1; s <= 3; s++) this.axis(`${f}_0${s}_${L}`, ax, ay, az, amount * 1.15 * mul);
    }
    return this;
  }
  get(bone: string): THREE.Euler {
    let e = this.eulers.get(bone);
    if (!e) { e = new THREE.Euler(); this.eulers.set(bone, e); }
    return e;
  }
  clear(): void {
    this.eulers.clear();
    this.quats.clear();
    this.positions.clear();
  }
  clone(): PoseWriter {
    const c = new PoseWriter();
    for (const [k, v] of this.eulers) c.eulers.set(k, v.clone());
    for (const [k, v] of this.quats) c.quats.set(k, v.clone());
    for (const [k, v] of this.positions) c.positions.set(k, v.clone());
    return c;
  }
}

/** smoothstep-interpolated keyframe curve (points sorted by t, t in 0..1) */
export function kf(t: number, points: ReadonlyArray<readonly [number, number]>): number {
  const p = THREE.MathUtils.clamp(t, points[0][0], points[points.length - 1][0]);
  for (let i = 0; i < points.length - 1; i++) {
    const [t0, v0] = points[i];
    const [t1, v1] = points[i + 1];
    if (p <= t1) {
      const l = t1 > t0 ? (p - t0) / (t1 - t0) : 1;
      const e = l * l * (3 - 2 * l);
      return THREE.MathUtils.lerp(v0, v1, e);
    }
  }
  return points[points.length - 1][1];
}

export type PoseFn = (t: number, w: PoseWriter) => void;

export interface ClipDef {
  name: string;
  duration: number;   // seconds
  loop?: boolean;     // default false
  category?: string;
  fn: PoseFn;
  /** clip events: fired when playback crosses t (0..1) */
  events?: { t: number; name: string }[];
}
