import { kf, type ClipDef } from '../pose';

export const CHARACTER: ClipDef[] = [
  {
    name: 'talk', duration: 2.4, loop: true, category: 'character',
    fn: (t, w) => {
      const g = Math.sin(t * Math.PI * 2 * 2);
      const g2 = Math.sin(t * Math.PI * 2 * 3 + 1);
      w.set('upperarm_r', -0.4 + g * 0.15, -0.2, 0.3);
      w.set('lowerarm_r', -0.9 + g2 * 0.2, 0, 0);
      w.set('upperarm_l', -0.3 - g * 0.1, 0.15, -0.3);
      w.set('lowerarm_l', -0.7 - g * 0.12, 0, 0);
      w.set('head', 0.03 + g2 * 0.03, g * 0.06, 0);
      w.set('spine_02', 0.03, 0, 0);
    },
  },
  {
    name: 'cheer', duration: 1.4, loop: true, category: 'character',
    fn: (t, w) => {
      const j = Math.abs(Math.sin(t * Math.PI * 2 * 1.5));
      w.set('upperarm_l', -2.9, 0, -0.1);
      w.set('upperarm_r', -2.9, 0, 0.1);
      w.set('lowerarm_l', -0.25, 0, 0);
      w.set('lowerarm_r', -0.25, 0, 0);
      w.pos('hips', 0, j * 0.06 - 0.02, 0);
      w.set('calf_l', j * 0.3, 0, 0);
      w.set('calf_r', j * 0.3, 0, 0);
      w.set('thigh_l', -j * 0.15, 0, 0);
      w.set('thigh_r', -j * 0.15, 0, 0);
      w.set('head', -0.12, 0, 0);
    },
  },
  {
    name: 'clap', duration: 1.2, loop: true, category: 'character',
    fn: (t, w) => {
      const c = Math.abs(Math.sin(t * Math.PI * 2 * 2.5));
      w.set('upperarm_l', -0.85, 0.35, -0.25);
      w.set('upperarm_r', -0.85, -0.35, 0.25);
      w.set('lowerarm_l', -1.1 + c * 0.18, 0.5 - c * 0.15, 0);
      w.set('lowerarm_r', -1.1 + c * 0.18, -0.5 + c * 0.15, 0);
      w.set('head', -0.05, 0, 0);
      w.set('spine_03', 0.04, 0, 0);
    },
  },
  {
    name: 'angry', duration: 2.0, loop: true, category: 'character',
    fn: (t, w) => {
      const t1 = Math.sin(t * Math.PI * 2 * 3) * 0.02;
      w.set('spine_02', 0.12, 0, 0);
      w.set('head', 0.14, t1 * 4, 0);
      w.set('upperarm_l', 0.15, 0, -0.55);
      w.set('upperarm_r', 0.15, 0, 0.55);
      w.set('lowerarm_l', -0.9, 0, 0);
      w.set('lowerarm_r', -0.9, 0, 0);
      w.curlFingers(1, 0.95); w.curlFingers(-1, 0.95);
      w.pos('hips', 0, -0.02, 0.02);
    },
  },
  {
    name: 'confused', duration: 2.6, loop: false, category: 'character',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.25, 1], [0.8, 1], [1, 0.3]]);
      w.set('head', 0.08 * a, 0.2 * a * Math.sin(t * 4), 0.14 * a);
      w.set('upperarm_l', -0.5 * a, 0, -0.75 * a);
      w.set('upperarm_r', -0.5 * a, 0, 0.75 * a);
      w.set('lowerarm_l', -1.3 * a, 0.4 * a, 0);
      w.set('lowerarm_r', -1.3 * a, -0.4 * a, 0);
      w.set('spine_02', -0.03 * a, 0, 0);
    },
  },
  {
    name: 'scared', duration: 1.8, loop: true, category: 'character',
    fn: (t, w) => {
      const shiver = Math.sin(t * Math.PI * 2 * 8) * 0.015;
      w.set('spine_02', 0.18, 0, shiver);
      w.set('upperarm_l', -0.9, 0.3, -0.35);
      w.set('upperarm_r', -0.9, -0.3, 0.35);
      w.set('lowerarm_l', -1.5, 0.3, 0);
      w.set('lowerarm_r', -1.5, -0.3, 0);
      w.set('head', 0.1, shiver * 3, 0);
      w.pos('hips', 0, -0.06, -0.03);
      w.set('calf_l', 0.3, 0, 0);
      w.set('calf_r', 0.3, 0, 0);
      w.set('thigh_l', -0.15, 0, 0.03);
      w.set('thigh_r', -0.15, 0, -0.03);
    },
  },
  {
    name: 'relaxed', duration: 3.5, loop: true, category: 'character',
    fn: (t, w) => {
      const b = Math.sin(t * Math.PI * 2);
      w.pos('hips', 0.01, -0.01 + b * 0.004, 0);
      w.set('hips', 0, 0, 0.04);
      w.set('spine_02', 0.04 + b * 0.015, 0.05, -0.03);
      w.set('upperarm_l', 0.05, 0, -0.55);
      w.set('upperarm_r', 0.05, 0, 0.55);
      w.set('lowerarm_l', -0.18, 0, 0);
      w.set('lowerarm_r', -0.18, 0, 0);
      w.set('head', 0.02, b * 0.05, 0.02);
    },
  },
  {
    name: 'exhausted', duration: 2.8, loop: true, category: 'character',
    fn: (t, w) => {
      const b = Math.sin(t * Math.PI * 2 * 1.5) * 0.5 + 0.5;
      w.set('spine_01', 0.3, 0, 0);
      w.set('spine_02', 0.25 + b * 0.05, 0, 0);
      w.set('head', 0.28 + b * 0.04, 0, 0);
      w.set('upperarm_l', -0.35, 0, -0.5);
      w.set('upperarm_r', -0.35, 0, 0.5);
      w.set('lowerarm_l', -0.25, 0, 0);
      w.set('lowerarm_r', -0.25, 0, 0);
      w.pos('hips', 0, -0.1, 0);
      w.set('thigh_l', -0.25, 0, 0.04);
      w.set('thigh_r', -0.25, 0, -0.04);
      w.set('calf_l', 0.45, 0, 0);
      w.set('calf_r', 0.45, 0, 0);
    },
  },
  {
    name: 'victory', duration: 2.0, loop: false, category: 'character',
    fn: (t, w) => {
      const up = kf(t, [[0, 0], [0.3, 1], [1, 1]]);
      const pump = Math.sin(t * Math.PI * 4) * 0.12 * up;
      w.set('upperarm_l', -3.0 * up + pump, 0, -0.15);
      w.set('upperarm_r', -3.0 * up - pump, 0, 0.15);
      w.set('lowerarm_l', -0.35, 0, 0);
      w.set('lowerarm_r', -0.35, 0, 0);
      w.curlFingers(1, 0.9 * up); w.curlFingers(-1, 0.9 * up);
      w.set('head', -0.2 * up, 0, 0);
      w.set('spine_03', -0.1 * up, 0, 0);
      w.pos('hips', 0, 0.02 * up, 0);
    },
  },
  {
    name: 'defeat', duration: 2.4, loop: false, category: 'character',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.4, 1], [1, 1]]);
      w.set('head', 0.4 * a, 0, 0);
      w.set('spine_02', 0.22 * a, 0, 0);
      w.set('spine_01', 0.15 * a, 0, 0);
      w.set('upperarm_l', 0.15 * a, 0, -0.5);
      w.set('upperarm_r', 0.15 * a, 0, 0.5);
      w.set('lowerarm_l', -0.1, 0, 0);
      w.set('lowerarm_r', -0.1, 0, 0);
      w.pos('hips', 0, -0.06 * a, 0);
      w.set('calf_l', 0.15 * a, 0, 0);
      w.set('calf_r', 0.15 * a, 0, 0);
    },
  },
];
