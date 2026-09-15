import { kf, type ClipDef } from '../pose';

export const SPORTS: ClipDef[] = [
  {
    name: 'throw_overarm', duration: 1.1, loop: false, category: 'sports',
    events: [{ t: 0.62, name: 'release' }],
    fn: (t, w) => {
      const windup = kf(t, [[0, 0], [0.35, 1], [0.55, 1], [0.75, 0], [1, 0]]);
      const throwP = kf(t, [[0, 0], [0.5, 0], [0.62, 1], [1, 0.6]]);
      w.set('upperarm_r', kf(t, [[0, -0.3], [0.35, -2.4], [0.55, -2.6], [0.62, -0.6], [1, -0.9]]), 0, 0.45 - 0.3 * throwP);
      w.set('lowerarm_r', kf(t, [[0, -0.4], [0.35, -1.9], [0.55, -2.1], [0.62, -0.1], [1, -0.4]]), 0, 0);
      w.set('upperarm_l', kf(t, [[0, -0.3], [0.35, -0.9], [0.62, -0.2], [1, -0.3]]), 0, -0.4 + 0.2 * windup);
      w.set('spine_02', 0.1 * windup - 0.15 * throwP, kf(t, [[0, 0], [0.35, -0.5], [0.62, 0.4], [1, 0.35]]), 0);
      w.set('spine_01', 0, kf(t, [[0, 0], [0.35, -0.25], [0.62, 0.2], [1, 0.15]]), 0);
      w.set('hips', 0, kf(t, [[0, 0], [0.35, -0.2], [0.62, 0.15], [1, 0.1]]), 0);
      w.pos('hips', 0, -0.06 * windup + 0.02 * throwP, 0.05 * throwP);
      w.set('thigh_l', -0.35 * throwP - 0.1 * windup, 0, 0);
      w.set('thigh_r', 0.25 * windup - 0.3 * throwP, 0, 0);
      w.set('calf_l', 0.3 * windup + 0.25 * throwP, 0, 0);
      w.set('calf_r', 0.45 * windup, 0, 0);
      w.curlFingers(-1, (1 - throwP) * 0.9);
    },
  },
  {
    name: 'throw_underarm', duration: 1.0, loop: false, category: 'sports',
    events: [{ t: 0.55, name: 'release' }],
    fn: (t, w) => {
      w.set('upperarm_r', kf(t, [[0, -0.2], [0.3, 0.7], [0.55, -1.1], [1, -0.8]]), 0, 0.4);
      w.set('lowerarm_r', kf(t, [[0, -0.3], [0.3, -0.5], [0.55, -0.05], [1, -0.2]]), 0, 0);
      w.set('spine_02', kf(t, [[0, 0.1], [0.3, 0.2], [0.55, -0.05], [1, 0]]), kf(t, [[0, 0], [0.3, -0.25], [0.55, 0.2], [1, 0.15]]), 0);
      w.pos('hips', 0, kf(t, [[0, 0], [0.3, -0.08], [0.55, -0.02], [1, 0]]), 0);
      w.set('thigh_l', kf(t, [[0, 0], [0.3, -0.2], [0.55, -0.35], [1, -0.1]]), 0, 0);
      w.set('calf_l', kf(t, [[0, 0.1], [0.3, 0.4], [0.55, 0.3], [1, 0.1]]), 0, 0);
      w.curlFingers(-1, kf(t, [[0, 0.9], [0.55, 0.9], [0.7, 0], [1, 0]]));
    },
  },
  {
    name: 'catch_high', duration: 1.0, loop: false, category: 'sports',
    events: [{ t: 0.42, name: 'catch' }],
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.3, 1], [0.75, 0.9], [1, 0]]);
      w.set('upperarm_l', -2.5 * a, 0.3 * a, -0.12);
      w.set('upperarm_r', -2.5 * a, -0.3 * a, 0.12);
      w.set('lowerarm_l', -0.5 * a, 0.3 * a, 0);
      w.set('lowerarm_r', -0.5 * a, -0.3 * a, 0);
      const catchC = kf(t, [[0, 0], [0.4, 0], [0.48, 1], [1, 0.7]]);
      w.curlFingers(1, catchC * 0.85);
      w.curlFingers(-1, catchC * 0.85);
      w.set('head', -0.35 * a, 0, 0);
      w.set('spine_03', -0.12 * a, 0, 0);
      w.pos('hips', 0, -0.04 * a + catchC * -0.03, 0);
      w.set('calf_l', 0.15 * a, 0, 0);
      w.set('calf_r', 0.15 * a, 0, 0);
      w.set('thigh_l', -0.1 * a, 0, 0);
      w.set('thigh_r', -0.1 * a, 0, 0);
    },
  },
  {
    name: 'catch_low', duration: 1.0, loop: false, category: 'sports',
    events: [{ t: 0.45, name: 'catch' }],
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.35, 1], [0.8, 0.9], [1, 0]]);
      w.pos('hips', 0, -0.3 * a, 0.08 * a);
      w.set('thigh_l', -0.85 * a, 0, 0.05);
      w.set('thigh_r', -0.75 * a, 0, -0.05);
      w.set('calf_l', 1.25 * a, 0, 0);
      w.set('calf_r', 1.15 * a, 0, 0);
      w.set('spine_01', 0.35 * a, 0, 0);
      w.set('spine_02', 0.3 * a, 0, 0);
      w.set('upperarm_l', -0.8 * a, 0.25 * a, -0.25);
      w.set('upperarm_r', -0.8 * a, -0.25 * a, 0.25);
      w.set('lowerarm_l', -0.5 * a, 0.25 * a, 0);
      w.set('lowerarm_r', -0.5 * a, -0.25 * a, 0);
      const catchC = kf(t, [[0, 0], [0.42, 0], [0.5, 1], [1, 0.7]]);
      w.curlFingers(1, catchC * 0.85);
      w.curlFingers(-1, catchC * 0.85);
      w.set('head', 0.25 * a, 0, 0);
    },
  },
  {
    name: 'catch_dive_r', duration: 1.3, loop: false, category: 'sports',
    events: [{ t: 0.45, name: 'catch' }],
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.35, 1], [0.8, 1], [1, 0.85]]);
      w.pos('hips', -0.22 * a, -0.30 * a, 0.08 * a);
      w.set('root', 0, 0, 0.95 * a); // body tips sideways right
      w.set('upperarm_r', -2.3 * a, -0.3 * a, -0.1 * a);
      w.set('upperarm_l', -2.0 * a, 0.4 * a, 0.1 * a);
      w.set('lowerarm_r', -0.3 * a, 0, 0);
      w.set('lowerarm_l', -0.4 * a, 0, 0);
      const catchC = kf(t, [[0, 0], [0.42, 0], [0.5, 1], [1, 0.8]]);
      w.curlFingers(1, catchC * 0.9);
      w.curlFingers(-1, catchC * 0.9);
      w.set('thigh_l', -0.6 * a, 0, 0.15 * a);
      w.set('thigh_r', -0.3 * a, 0, -0.2 * a);
      w.set('calf_l', 0.9 * a, 0, 0);
      w.set('calf_r', 0.7 * a, 0, 0);
      w.set('head', 0, 0, -0.3 * a);
    },
  },
  {
    name: 'lateral_shuffle', duration: 0.8, loop: true, category: 'sports',
    fn: (t, w) => {
      const ph = t * Math.PI * 2;
      const s = Math.sin(ph);
      w.pos('hips', s * 0.05, -0.12 + Math.abs(Math.cos(ph)) * 0.015, 0);
      w.set('thigh_l', -0.35, 0, 0.12 + s * 0.1);
      w.set('thigh_r', -0.35, 0, -0.12 + s * 0.1);
      w.set('calf_l', 0.6, 0, 0);
      w.set('calf_r', 0.6, 0, 0);
      w.set('spine_02', 0.18, 0, 0);
      w.set('upperarm_l', -0.45, 0, -0.3);
      w.set('upperarm_r', -0.45, 0, 0.3);
      w.set('lowerarm_l', -0.5, 0, 0);
      w.set('lowerarm_r', -0.5, 0, 0);
    },
  },
  {
    name: 'pickup_ground', duration: 0.9, loop: false, category: 'sports',
    events: [{ t: 0.5, name: 'pickup' }],
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.4, 1], [0.65, 1], [1, 0]]);
      w.pos('hips', 0, -0.4 * a, 0.1 * a);
      w.set('spine_01', 0.4 * a, 0, 0);
      w.set('spine_02', 0.35 * a, 0, 0);
      w.set('thigh_l', -0.9 * a, 0, 0);
      w.set('thigh_r', -0.5 * a, 0, 0);
      w.set('calf_l', 1.3 * a, 0, 0);
      w.set('calf_r', 0.9 * a, 0, 0);
      w.set('upperarm_r', -1.0 * a, 0, 0.3);
      w.set('lowerarm_r', -0.3 * a, 0, 0);
      const grab = kf(t, [[0, 0], [0.45, 0], [0.55, 1], [1, 0.8]]);
      w.curlFingers(-1, grab * 0.9);
    },
  },
  {
    name: 'celebration_run', duration: 1.6, loop: true, category: 'sports',
    fn: (t, w) => {
      const ph = t * Math.PI * 2 * 1.5;
      const sL = Math.sin(ph), sR = Math.sin(ph + Math.PI);
      w.set('thigh_l', sL * 0.7, 0, 0);
      w.set('thigh_r', sR * 0.7, 0, 0);
      w.set('calf_l', 0.3 + Math.max(0, -sL) * 1.1, 0, 0);
      w.set('calf_r', 0.3 + Math.max(0, -sR) * 1.1, 0, 0);
      w.set('upperarm_l', -2.9, 0, -0.1);
      w.set('upperarm_r', -2.9, 0, 0.1);
      w.set('lowerarm_l', -0.3, 0, 0);
      w.set('lowerarm_r', -0.3, 0, 0);
      w.pos('hips', 0, Math.abs(Math.cos(ph)) * 0.04, 0);
      w.set('spine_02', -0.08, 0, 0);
      w.set('head', -0.15, 0, 0);
    },
  },
];
