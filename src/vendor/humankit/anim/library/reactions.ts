import { kf, type ClipDef } from '../pose';

export const REACTIONS: ClipDef[] = [
  {
    name: 'stumble', duration: 1.0, loop: false, category: 'reactions',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.2, 1], [0.55, 0.6], [1, 0]]);
      w.pos('hips', 0, -0.18 * a, 0.1 * a);
      w.set('spine_02', 0.35 * a, 0, 0.08 * a);
      w.set('upperarm_l', -1.8 * a, 0, -0.25 * a);
      w.set('upperarm_r', -1.8 * a, 0, 0.25 * a);
      w.set('lowerarm_l', -0.3, 0, 0);
      w.set('lowerarm_r', -0.3, 0, 0);
      w.set('thigh_l', -0.7 * a, 0, 0);
      w.set('thigh_r', 0.5 * a, 0, 0);
      w.set('calf_l', 1.1 * a, 0, 0);
      w.set('head', 0.2 * a, 0, 0);
    },
  },
  {
    name: 'knockback', duration: 0.8, loop: false, category: 'reactions',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.15, 1], [0.6, 0.5], [1, 0]]);
      w.set('spine_02', -0.4 * a, 0, 0);
      w.set('spine_01', -0.2 * a, 0, 0);
      w.pos('hips', 0, -0.1 * a, -0.15 * a);
      w.set('upperarm_l', -0.8 * a, 0, -0.3 * a);
      w.set('upperarm_r', -0.8 * a, 0, 0.3 * a);
      w.set('head', -0.3 * a, 0, 0);
      w.set('thigh_l', -0.3 * a, 0, 0);
      w.set('thigh_r', 0.4 * a, 0, 0);
      w.set('calf_r', 0.6 * a, 0, 0);
    },
  },
  {
    name: 'dodge_l', duration: 0.7, loop: false, category: 'reactions',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.3, 1], [0.7, 0.8], [1, 0]]);
      w.pos('hips', 0.18 * a, -0.12 * a, 0);
      w.set('hips', 0, 0, 0.25 * a);
      w.set('spine_02', 0.1 * a, 0, 0.3 * a);
      w.set('thigh_l', -0.5 * a, 0, 0.2 * a);
      w.set('thigh_r', 0.2 * a, 0, -0.1 * a);
      w.set('calf_l', 0.8 * a, 0, 0);
      w.set('upperarm_r', -0.6 * a, 0, 0.2 * a);
      w.set('head', 0, 0, -0.15 * a);
    },
  },
  {
    name: 'fall_collapse', duration: 1.6, loop: false, category: 'reactions',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.45, 1], [1, 1]]);
      w.pos('hips', 0, -0.85 * a, -0.1 * a);
      w.set('spine_01', 0.3 * a, 0, 0);
      w.set('spine_02', 0.35 * a, 0, 0);
      w.set('head', 0.45 * a, 0.1 * a, 0);
      w.set('thigh_l', -1.4 * a, 0, 0.15 * a);
      w.set('thigh_r', -1.2 * a, 0, -0.1 * a);
      w.set('calf_l', 1.6 * a, 0, 0);
      w.set('calf_r', 1.5 * a, 0, 0);
      w.set('upperarm_l', -0.5 * a, 0, -0.5 * a);
      w.set('upperarm_r', -0.4 * a, 0, 0.5 * a);
      w.set('lowerarm_l', -0.2, 0, 0);
      w.set('lowerarm_r', -0.2, 0, 0);
    },
  },
  {
    name: 'death_fall', duration: 1.8, loop: false, category: 'reactions',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.2, 0.3], [0.55, 1], [1, 1]]);
      w.pos('hips', 0, -0.88 * a, 0);
      w.set('root', -1.5 * a, 0, 0); // whole body tips backward
      w.set('spine_02', 0.15 * a, 0, 0);
      w.set('upperarm_l', -1.2 * a, 0, -0.3 * a);
      w.set('upperarm_r', -1.2 * a, 0, 0.3 * a);
      w.set('head', -0.3 * a, 0, 0.1 * a);
      w.set('thigh_l', -0.3 * a, 0, 0.08);
      w.set('thigh_r', -0.25 * a, 0, -0.08);
      w.set('calf_l', 0.5 * a, 0, 0);
      w.set('calf_r', 0.45 * a, 0, 0);
    },
  },
  {
    name: 'recover', duration: 1.2, loop: false, category: 'reactions',
    fn: (t, w) => {
      const a = kf(t, [[0, 1], [0.6, 0.3], [1, 0]]);
      w.pos('hips', 0, -0.4 * a, 0.05 * a);
      w.set('spine_02', 0.4 * a, 0, 0);
      w.set('thigh_l', -1.0 * a, 0, 0);
      w.set('thigh_r', -0.7 * a, 0, 0);
      w.set('calf_l', 1.5 * a, 0, 0);
      w.set('calf_r', 1.2 * a, 0, 0);
      w.set('upperarm_l', -0.4 * a, 0, -0.4);
      w.set('upperarm_r', -0.4 * a, 0, 0.4);
    },
  },
];
