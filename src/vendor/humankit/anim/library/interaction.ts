import { kf, type ClipDef } from '../pose';

export const INTERACTION: ClipDef[] = [
  {
    name: 'pickup_low', duration: 1.4, loop: false, category: 'interaction',
    fn: (t, w) => {
      const down = kf(t, [[0, 0], [0.3, 1], [0.6, 1], [0.9, 0], [1, 0]]);
      w.pos('hips', 0, -0.35 * down, 0.05 * down);
      w.set('thigh_l', -0.9 * down, 0, 0.05);
      w.set('thigh_r', -0.8 * down, 0, -0.05);
      w.set('calf_l', 1.3 * down, 0, 0);
      w.set('calf_r', 1.2 * down, 0, 0);
      w.set('spine_01', 0.35 * down, 0, 0);
      w.set('spine_02', 0.3 * down, 0, 0);
      w.set('upperarm_r', -0.9 * down, 0, 0.35);
      w.set('lowerarm_r', -0.35 * down, 0, 0);
      w.set('upperarm_l', -0.4 * down, 0, -0.35);
      const grab = kf(t, [[0, 0], [0.35, 0], [0.45, 1], [0.75, 1], [0.85, 0], [1, 0]]);
      w.curlFingers(-1, grab * 0.8);
      w.set('head', 0.3 * down, 0, 0);
    },
  },
  {
    name: 'place', duration: 1.2, loop: false, category: 'interaction',
    fn: (t, w) => {
      const reach = kf(t, [[0, 0], [0.35, 1], [0.7, 1], [1, 0]]);
      w.set('spine_02', 0.2 * reach, 0, 0);
      w.set('upperarm_r', -0.7 * reach, 0, 0);
      w.set('lowerarm_r', -0.2 * reach, 0, 0);
      w.curlFingers(-1, (1 - reach) * 0.6);
      w.pos('hips', 0, -0.1 * reach, 0);
      w.set('calf_l', 0.4 * reach, 0, 0);
      w.set('calf_r', 0.4 * reach, 0, 0);
      w.set('thigh_l', -0.3 * reach, 0, 0);
      w.set('thigh_r', -0.3 * reach, 0, 0);
    },
  },
  {
    name: 'carry', duration: 1.2, loop: true, category: 'interaction',
    fn: (t, w) => {
      // walk while holding with both arms in front (overlay-friendly legs)
      const ph = t * Math.PI * 2;
      const sL = Math.sin(ph), sR = Math.sin(ph + Math.PI);
      w.set('thigh_l', sL * 0.45, 0, 0);
      w.set('thigh_r', sR * 0.45, 0, 0);
      w.set('calf_l', 0.15 + Math.max(0, -sL) * 0.8, 0, 0);
      w.set('calf_r', 0.15 + Math.max(0, -sR) * 0.8, 0, 0);
      w.pos('hips', 0, Math.abs(Math.cos(ph)) * 0.02 - 0.01, 0);
      w.set('spine_02', -0.05, 0, 0);
    },
  },
  {
    name: 'carry_arms', duration: 1, loop: true, category: 'interaction',
    fn: (t, w) => {
      const b = Math.sin(t * Math.PI * 2);
      w.set('upperarm_l', -0.55 + b * 0.01, 0.25, -0.3);
      w.set('upperarm_r', -0.55 - b * 0.01, -0.25, 0.3);
      w.set('lowerarm_l', -1.15, -0.5, 0);
      w.set('lowerarm_r', -1.15, 0.5, 0);
      w.curlFingers(1, 0.55); w.curlFingers(-1, 0.55);
    },
  },
  {
    name: 'push', duration: 1.6, loop: true, category: 'interaction',
    fn: (t, w) => {
      const push = Math.sin(t * Math.PI * 2) * 0.5 + 0.5;
      w.set('spine_02', 0.25 + push * 0.08, 0, 0);
      w.set('upperarm_l', -1.1 + push * 0.35, 0, -0.25);
      w.set('upperarm_r', -1.1 + push * 0.35, 0, 0.25);
      w.set('lowerarm_l', -0.5 + push * 0.3, 0, 0);
      w.set('lowerarm_r', -0.5 + push * 0.3, 0, 0);
      w.pos('hips', 0, -0.08, 0.08);
      w.set('thigh_l', -0.35, 0, 0);
      w.set('thigh_r', 0.25, 0, 0);
      w.set('calf_l', 0.5, 0, 0);
    },
  },
  {
    name: 'pull', duration: 1.6, loop: true, category: 'interaction',
    fn: (t, w) => {
      const pull = Math.sin(t * Math.PI * 2) * 0.5 + 0.5;
      w.set('spine_02', 0.1 - pull * 0.1, 0, 0);
      w.set('upperarm_l', -0.9 - pull * 0.3, 0, -0.25);
      w.set('upperarm_r', -0.9 - pull * 0.3, 0, 0.25);
      w.set('lowerarm_l', -0.3 - pull * 0.5, 0, 0);
      w.set('lowerarm_r', -0.3 - pull * 0.5, 0, 0);
      w.curlFingers(1, 0.8); w.curlFingers(-1, 0.8);
      w.pos('hips', 0, -0.06, -0.06);
    },
  },
  {
    name: 'reach_high', duration: 1.1, loop: false, category: 'interaction',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.4, 1], [0.75, 1], [1, 0]]);
      w.set('upperarm_r', -2.6 * a, 0, 0.1 * a);
      w.set('lowerarm_r', -0.25 * a, 0, 0);
      w.set('spine_02', -0.12 * a, 0, -0.06 * a);
      w.set('spine_03', -0.08 * a, 0, 0);
      w.pos('hips', 0, 0.02 * a, 0);
      w.set('head', -0.25 * a, 0, 0);
    },
  },
  {
    name: 'point', duration: 1.6, loop: false, category: 'interaction',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.25, 1], [0.8, 1], [1, 0]]);
      w.set('upperarm_r', -1.5 * a, 0, 0.25);
      w.set('lowerarm_r', -0.08 * a, 0, 0);
      w.curlFingers(-1, a * 0.85);
      // index finger extended
      for (let s = 1; s <= 3; s++) w.axis(`index_0${s}_r`, 0.7071, -0.7071, 0, -a * 0.95);
      w.set('head', 0, 0.1 * a, 0);
    },
  },
  {
    name: 'wave', duration: 1.8, loop: false, category: 'interaction',
    fn: (t, w) => {
      const up = kf(t, [[0, 0], [0.2, 1], [0.85, 1], [1, 0]]);
      const wv = Math.sin(t * Math.PI * 6);
      w.set('upperarm_r', -2.5 * up, 0, 0.05 * up);
      w.set('lowerarm_r', -0.4 * up + wv * 0.3 * up, 0, 0);
      w.set('head', 0, 0.1 * up, 0.05 * up);
    },
  },
  {
    name: 'sit', duration: 2.0, loop: true, category: 'interaction',
    fn: (t, w) => {
      const b = Math.sin(t * Math.PI * 2);
      w.pos('hips', 0, -0.52, 0);
      w.set('thigh_l', -1.5, 0, 0.05);
      w.set('thigh_r', -1.5, 0, -0.05);
      w.set('calf_l', 1.45, 0, 0);
      w.set('calf_r', 1.45, 0, 0);
      w.set('spine_02', 0.08 + b * 0.01, 0, 0);
      w.set('upperarm_l', -0.35, 0, -0.35);
      w.set('upperarm_r', -0.35, 0, 0.35);
      w.set('lowerarm_l', -0.55, 0, 0);
      w.set('lowerarm_r', -0.55, 0, 0);
    },
  },
  {
    name: 'inspect', duration: 2.2, loop: false, category: 'interaction',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.3, 1], [0.8, 1], [1, 0]]);
      w.set('upperarm_r', -0.9 * a, -0.3 * a, 0.3);
      w.set('lowerarm_r', -1.1 * a, 0, 0);
      w.set('head', 0.25 * a, 0.15 * a + Math.sin(t * 9) * 0.04 * a, 0.08 * a);
      w.set('spine_02', 0.12 * a, 0, 0);
    },
  },
];
