/**
 * XIRTUS_HUMANOID_V1 — canonical rig data. Single source of truth.
 * See docs/RIG_SPEC.md. All positions are world-space meters at rest (A-pose,
 * facing +Z, left = +X), identity local rotations everywhere.
 */
export const RIG_VERSION = 'XIRTUS_HUMANOID_V1' as const;

export interface BoneDef {
  name: string;
  parent: string | null;
  /** world-space rest position (reference height 1.80 m) */
  pos: readonly [number, number, number];
  /** if true this bone only exists in HERO tier skeletons */
  heroOnly?: boolean;
  socket?: boolean;
}

const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;

/** Build the five finger chains for one hand. Hand at `hand`, pointing dir `dir` (unit, A-pose = down-out 45°). */
function fingerDefs(side: 'l' | 'r', hand: [number, number, number], out: BoneDef[]): void {
  const s = side === 'l' ? 1 : -1;
  // Hand local frame at rest: fingers point along arm direction (0.707,-0.707,0)*side.
  const fdir: [number, number, number] = [0.7071 * s, -0.7071, 0];
  // Finger base spread across palm width (z) and along hand.
  const bases: Record<(typeof FINGERS)[number], [number, number, number]> = {
    thumb:  [0.030, 0.00, 0.028 * s],
    index:  [0.085, 0.00, 0.030 * s],
    middle: [0.092, 0.00, 0.010 * s],
    ring:   [0.085, 0.00, -0.010 * s],
    pinky:  [0.072, 0.00, -0.030 * s],
  };
  const segs: Record<(typeof FINGERS)[number], [number, number, number]> = {
    thumb: [0.032, 0.028, 0.022], index: [0.030, 0.022, 0.016],
    middle: [0.032, 0.024, 0.017], ring: [0.030, 0.022, 0.016], pinky: [0.024, 0.018, 0.014],
  };
  for (const f of FINGERS) {
    const b = bases[f];
    // base position: along hand dir by b[0], spread z by b[2] (in world-ish frame)
    let p: [number, number, number] = [
      hand[0] + fdir[0] * b[0],
      hand[1] + fdir[1] * b[0],
      hand[2] + b[2],
    ];
    const lens = segs[f];
    for (let i = 0; i < 3; i++) {
      const name = `${f}_0${i + 1}_${side}`;
      out.push({ name, parent: i === 0 ? `hand_${side}` : `${f}_0${i}_${side}`, pos: p });
      p = [p[0] + fdir[0] * lens[i], p[1] + fdir[1] * lens[i], p[2]];
    }
  }
}

function buildDefs(): BoneDef[] {
  const d: BoneDef[] = [
    { name: 'root', parent: null, pos: [0, 0, 0] },
    { name: 'hips', parent: 'root', pos: [0, 0.98, 0] },
    { name: 'spine_01', parent: 'hips', pos: [0, 1.08, 0] },
    { name: 'spine_02', parent: 'spine_01', pos: [0, 1.22, 0] },
    { name: 'spine_03', parent: 'spine_02', pos: [0, 1.36, 0] },
    { name: 'neck_01', parent: 'spine_03', pos: [0, 1.50, 0] },
    { name: 'head', parent: 'neck_01', pos: [0, 1.60, 0] },

    { name: 'clavicle_l', parent: 'spine_03', pos: [0.070, 1.460, 0] },
    { name: 'upperarm_l', parent: 'clavicle_l', pos: [0.210, 1.440, 0] },
    { name: 'lowerarm_l', parent: 'upperarm_l', pos: [0.408, 1.242, 0] },
    { name: 'hand_l', parent: 'lowerarm_l', pos: [0.599, 1.051, 0] },

    { name: 'clavicle_r', parent: 'spine_03', pos: [-0.070, 1.460, 0] },
    { name: 'upperarm_r', parent: 'clavicle_r', pos: [-0.210, 1.440, 0] },
    { name: 'lowerarm_r', parent: 'upperarm_r', pos: [-0.408, 1.242, 0] },
    { name: 'hand_r', parent: 'lowerarm_r', pos: [-0.599, 1.051, 0] },

    { name: 'thigh_l', parent: 'hips', pos: [0.105, 0.940, 0] },
    { name: 'calf_l', parent: 'thigh_l', pos: [0.105, 0.500, 0] },
    { name: 'foot_l', parent: 'calf_l', pos: [0.105, 0.100, 0] },
    { name: 'ball_l', parent: 'foot_l', pos: [0.105, 0.035, 0.075] },

    { name: 'thigh_r', parent: 'hips', pos: [-0.105, 0.940, 0] },
    { name: 'calf_r', parent: 'thigh_r', pos: [-0.105, 0.500, 0] },
    { name: 'foot_r', parent: 'calf_r', pos: [-0.105, 0.100, 0] },
    { name: 'ball_r', parent: 'foot_r', pos: [-0.105, 0.035, 0.075] },
  ];
  fingerDefs('l', [0.599, 1.051, 0], d);
  fingerDefs('r', [-0.599, 1.051, 0], d);

  // Sockets (identity-rotation locators; offsets relative to parent joint).
  const sockets: [string, string, [number, number, number]][] = [
    ['socket_hand_l', 'hand_l', [0.656, 1.000, 0]],
    ['socket_hand_r', 'hand_r', [-0.656, 1.000, 0]],
    ['socket_weapon', 'hand_r', [-0.656, 1.000, 0]],
    ['socket_back', 'spine_03', [0, 1.400, -0.120]],
    ['socket_chest', 'spine_03', [0, 1.360, 0.150]],
    ['socket_head', 'head', [0, 1.720, 0]],
    ['socket_face', 'head', [0, 1.630, 0.110]],
    ['socket_waist', 'hips', [0, 1.020, -0.120]],
    ['socket_hip_l', 'hips', [0.160, 0.960, 0]],
    ['socket_hip_r', 'hips', [-0.160, 0.960, 0]],
    ['socket_foot_l', 'foot_l', [0.105, 0.060, 0.050]],
    ['socket_foot_r', 'foot_r', [-0.105, 0.060, 0.050]],
  ];
  for (const [name, parent, pos] of sockets) d.push({ name, parent, pos, socket: true });
  return d;
}

export const BONE_DEFS: readonly BoneDef[] = Object.freeze(buildDefs());
export const BONE_MAP: ReadonlyMap<string, BoneDef> = new Map(BONE_DEFS.map((b) => [b.name, b]));

export const CORE_BONES = BONE_DEFS.filter((b) => !b.socket && !b.name.match(/^(thumb|index|middle|ring|pinky)/)).map((b) => b.name);
export const FINGER_BONES = BONE_DEFS.filter((b) => b.name.match(/^(thumb|index|middle|ring|pinky)/)).map((b) => b.name);
export const SOCKET_BONES = BONE_DEFS.filter((b) => b.socket).map((b) => b.name);

/** Canonical skin tone palette ( Fitzpatrick-ish scale 1..6 + variation ). */
export const SKIN_TONES = [0xffe0c4, 0xf0c8a0, 0xd9a066, 0xc68642, 0x8d5524, 0x6b4424] as const;
