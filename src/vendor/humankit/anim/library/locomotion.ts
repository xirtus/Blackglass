import { kf, type ClipDef } from '../pose';

const TAU = Math.PI * 2;

/** shared gait generator: phase 0..1 = full stride, style params shape the gait */
function gait(t: number, w: import('../pose').PoseWriter, o: {
  stride: number; kneeLift: number; armSwing: number; bob: number; lean: number;
  elbowFlex: number; bounce: number; twist: number; airTime?: boolean;
}): void {
  const ph = t * TAU;
  const sL = Math.sin(ph);
  const sR = Math.sin(ph + Math.PI);
  w.set('thigh_l', sL * o.stride, 0, 0);
  w.set('thigh_r', sR * o.stride, 0, 0);
  w.set('calf_l', 0.15 + Math.max(0, -sL) * o.kneeLift + Math.max(0, sL) * 0.12, 0, 0);
  w.set('calf_r', 0.15 + Math.max(0, -sR) * o.kneeLift + Math.max(0, sR) * 0.12, 0, 0);
  // feet stay roughly flat
  w.set('foot_l', -(sL * o.stride) * 0.5 - 0.1, 0, 0);
  w.set('foot_r', -(sR * o.stride) * 0.5 - 0.1, 0, 0);
  w.set('upperarm_l', sR * o.armSwing, 0, -0.55);
  w.set('upperarm_r', sL * o.armSwing, 0, 0.55);
  w.set('lowerarm_l', -o.elbowFlex - Math.max(0, sR) * 0.3, 0, 0);
  w.set('lowerarm_r', -o.elbowFlex - Math.max(0, sL) * 0.3, 0, 0);
  w.pos('hips', 0, Math.abs(Math.cos(ph)) * o.bob - o.bob * 0.4, 0);
  w.set('spine_01', o.lean * 0.3, sL * o.twist * 0.4, 0);
  w.set('spine_02', o.lean * 0.4, sL * o.twist * 0.6, 0);
  w.set('spine_03', o.lean * 0.3, sL * o.twist * 0.3, 0);
  w.set('head', -o.lean * 0.5, 0, 0);
  w.set('hips', 0, sL * o.twist * 0.35, Math.cos(ph) * 0.03);
}

export const LOCOMOTION: ClipDef[] = [
  {
    name: 'idle', duration: 4.0, loop: true, category: 'locomotion',
    fn: (t, w) => {
      const b = Math.sin(t * TAU * 2) * 0.5 + 0.5; // two breaths per loop
      w.set('spine_02', 0.02 + b * 0.02, 0, 0);
      w.set('spine_03', 0.01 + b * 0.015, 0, 0);
      w.set('neck_01', -0.02, 0, 0);
      w.set('head', -0.01 - b * 0.01, Math.sin(t * TAU) * 0.04, 0);
      w.set('upperarm_l', 0, 0, -0.6 - b * 0.01);
      w.set('upperarm_r', 0, 0, 0.6 + b * 0.01);
      w.set('lowerarm_l', -0.14, 0, 0);
      w.set('lowerarm_r', -0.14, 0, 0);
      w.pos('hips', 0, -0.005 + b * 0.004, 0);
      w.set('thigh_l', 0, 0, 0.02);
      w.set('thigh_r', 0, 0, -0.02);
      w.set('calf_l', 0.04, 0, 0);
      w.set('calf_r', 0.04, 0, 0);
    },
  },
  {
    name: 'idle_fidget', duration: 5.0, loop: true, category: 'locomotion',
    fn: (t, w) => {
      LOCOMOTION[0].fn(t, w);
      const s = kf(t, [[0, 0], [0.3, 0], [0.4, 1], [0.6, 1], [0.7, 0], [1, 0]]);
      w.add('hips', 0, 0, 0.03 * s);
      w.pos('hips', 0.015 * s, -0.008 * s, 0);
      w.add('head', 0, 0.25 * s * Math.sin(t * TAU * 3), 0.05 * s);
      w.add('upperarm_r', 0, 0, -0.1 * s);
    },
  },
  {
    name: 'walk', duration: 1.1, loop: true, category: 'locomotion',
    fn: (t, w) => gait(t, w, { stride: 0.5, kneeLift: 0.85, armSwing: 0.35, bob: 0.025, lean: 0.05, elbowFlex: 0.3, bounce: 0, twist: 0.06 }),
  },
  {
    name: 'walk_fast', duration: 0.85, loop: true, category: 'locomotion',
    fn: (t, w) => gait(t, w, { stride: 0.62, kneeLift: 1.0, armSwing: 0.5, bob: 0.035, lean: 0.09, elbowFlex: 0.55, bounce: 0, twist: 0.08 }),
  },
  {
    name: 'jog', duration: 0.7, loop: true, category: 'locomotion',
    fn: (t, w) => gait(t, w, { stride: 0.8, kneeLift: 1.25, armSwing: 0.65, bob: 0.05, lean: 0.14, elbowFlex: 1.0, bounce: 0, twist: 0.1 }),
  },
  {
    name: 'sprint', duration: 0.55, loop: true, category: 'locomotion',
    fn: (t, w) => {
      gait(t, w, { stride: 1.05, kneeLift: 1.5, armSwing: 0.85, bob: 0.06, lean: 0.24, elbowFlex: 1.5, bounce: 0, twist: 0.13 });
      w.add('head', -0.1, 0, 0);
    },
  },
  {
    name: 'walk_back', duration: 1.2, loop: true, category: 'locomotion',
    fn: (t, w) => gait(1 - t, w, { stride: 0.4, kneeLift: 0.7, armSwing: 0.25, bob: 0.025, lean: -0.03, elbowFlex: 0.3, bounce: 0, twist: 0.05 }),
  },
  {
    name: 'strafe_l', duration: 0.9, loop: true, category: 'locomotion',
    fn: (t, w) => {
      const ph = t * TAU;
      const s = Math.sin(ph);
      w.set('thigh_l', 0.1, 0, 0.25 * Math.max(0, s) + 0.05);
      w.set('thigh_r', 0.1, 0, 0.25 * Math.max(0, -s) - 0.05);
      w.set('calf_l', 0.25, 0, 0);
      w.set('calf_r', 0.25, 0, 0);
      w.pos('hips', s * 0.03, -0.04 + Math.abs(Math.cos(ph)) * 0.02, 0);
      w.set('spine_02', 0.1, 0, -0.04);
      w.set('upperarm_l', -0.25, 0, -0.35);
      w.set('upperarm_r', -0.25, 0, 0.35);
      w.set('lowerarm_l', -0.5, 0, 0);
      w.set('lowerarm_r', -0.5, 0, 0);
    },
  },
  {
    name: 'crouch_idle', duration: 2.5, loop: true, category: 'locomotion',
    fn: (t, w) => {
      const b = Math.sin(t * TAU);
      w.pos('hips', 0, -0.32 + b * 0.005, 0.02);
      w.set('thigh_l', -1.05, 0, 0.06);
      w.set('thigh_r', -1.05, 0, -0.06);
      w.set('calf_l', 1.6, 0, 0);
      w.set('calf_r', 1.6, 0, 0);
      w.set('foot_l', -0.55, 0, 0);
      w.set('foot_r', -0.55, 0, 0);
      w.set('spine_01', 0.25, 0, 0);
      w.set('spine_02', 0.2 + b * 0.01, 0, 0);
      w.set('upperarm_l', -0.35, 0, -0.35);
      w.set('upperarm_r', -0.35, 0, 0.35);
      w.set('lowerarm_l', -0.4, 0, 0);
      w.set('lowerarm_r', -0.4, 0, 0);
    },
  },
  {
    name: 'crouch_walk', duration: 1.0, loop: true, category: 'locomotion',
    fn: (t, w) => {
      gait(t, w, { stride: 0.45, kneeLift: 1.1, armSwing: 0.3, bob: 0.02, lean: 0.3, elbowFlex: 0.5, bounce: 0, twist: 0.05 });
      w.pos('hips', 0, -0.22, 0.02);
      w.add('thigh_l', -0.5, 0, 0);
      w.add('thigh_r', -0.5, 0, 0);
      w.add('calf_l', 0.8, 0, 0);
      w.add('calf_r', 0.8, 0, 0);
      w.add('foot_l', -0.35, 0, 0);
      w.add('foot_r', -0.35, 0, 0);
    },
  },
  {
    name: 'jump', duration: 0.9, loop: false, category: 'locomotion',
    fn: (t, w) => {
      const crouch = kf(t, [[0, 0], [0.2, 1], [0.35, 0], [1, 0]]);
      const air = kf(t, [[0, 0], [0.3, 0], [0.45, 1], [0.75, 1], [0.95, 0], [1, 0]]);
      const land = kf(t, [[0, 0], [0.8, 0], [0.9, 0.7], [1, 0]]);
      const c = Math.max(crouch, land);
      w.pos('hips', 0, -0.28 * c + air * 0.05, 0);
      w.set('thigh_l', -0.9 * c + air * -0.4, 0, 0.03);
      w.set('thigh_r', -0.9 * c + air * -0.55, 0, -0.03);
      w.set('calf_l', 1.4 * c + air * 0.9, 0, 0);
      w.set('calf_r', 1.4 * c + air * 1.1, 0, 0);
      w.set('upperarm_l', -0.3 * c - air * 1.6, 0, -0.3 - air * 0.3);
      w.set('upperarm_r', -0.3 * c - air * 1.6, 0, 0.3 + air * 0.3);
      w.set('lowerarm_l', -0.5 * c - air * 0.3, 0, 0);
      w.set('lowerarm_r', -0.5 * c - air * 0.3, 0, 0);
      w.set('spine_02', 0.25 * c - air * 0.05, 0, 0);
    },
  },
  {
    name: 'fall', duration: 1.2, loop: true, category: 'locomotion',
    fn: (t, w) => {
      const f = Math.sin(t * TAU * 2);
      w.set('upperarm_l', -2.4 + f * 0.25, 0, -0.2);
      w.set('upperarm_r', -2.4 - f * 0.25, 0, 0.2);
      w.set('lowerarm_l', -0.4, 0, 0);
      w.set('lowerarm_r', -0.4, 0, 0);
      w.set('thigh_l', -0.5 + f * 0.1, 0, 0.05);
      w.set('thigh_r', -0.3 - f * 0.1, 0, -0.05);
      w.set('calf_l', 0.9, 0, 0);
      w.set('calf_r', 0.7, 0, 0);
      w.set('spine_02', -0.08, 0, 0);
      w.pos('hips', 0, -0.05, 0);
    },
  },
  {
    name: 'land', duration: 0.55, loop: false, category: 'locomotion',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.25, 1], [1, 0]]);
      w.pos('hips', 0, -0.25 * a, 0);
      w.set('thigh_l', -0.85 * a, 0, 0.04);
      w.set('thigh_r', -0.85 * a, 0, -0.04);
      w.set('calf_l', 1.3 * a, 0, 0);
      w.set('calf_r', 1.3 * a, 0, 0);
      w.set('spine_02', 0.3 * a, 0, 0);
      w.set('upperarm_l', -0.5 * a, 0, -0.4);
      w.set('upperarm_r', -0.5 * a, 0, 0.4);
    },
  },
  {
    name: 'turn_180', duration: 0.7, loop: false, category: 'locomotion',
    fn: (t, w) => {
      const p = kf(t, [[0, 0], [0.5, 1], [1, 1]]);
      w.set('root', 0, p * Math.PI, 0);
      const step = Math.sin(t * Math.PI * 2);
      w.set('thigh_l', step * 0.4, 0, 0);
      w.set('thigh_r', -step * 0.4, 0, 0);
      w.set('calf_l', Math.max(0, -step) * 0.8, 0, 0);
      w.set('calf_r', Math.max(0, step) * 0.8, 0, 0);
      w.set('upperarm_l', -step * 0.3, 0, -0.45);
      w.set('upperarm_r', step * 0.3, 0, 0.45);
    },
  },
  {
    name: 'sprint_start', duration: 1.0, loop: false, category: 'locomotion',
    fn: (t, w) => {
      const drive = kf(t, [[0, 0], [0.15, 1], [0.6, 0.5], [1, 0]]);
      w.set('spine_02', 0.45 * drive, 0, 0);
      w.set('spine_01', 0.3 * drive, 0, 0);
      w.pos('hips', 0, -0.15 * drive, 0.1 * drive);
      const ph = t * TAU * 1.5;
      const sL = Math.sin(ph), sR = Math.sin(ph + Math.PI);
      w.set('thigh_l', sL * 0.9 - drive * 0.4, 0, 0);
      w.set('thigh_r', sR * 0.9 - drive * 0.2, 0, 0);
      w.set('calf_l', 0.3 + Math.max(0, -sL) * 1.4, 0, 0);
      w.set('calf_r', 0.3 + Math.max(0, -sR) * 1.4, 0, 0);
      w.set('upperarm_l', sR * 0.8, 0, -0.5);
      w.set('upperarm_r', sL * 0.8, 0, 0.5);
      w.set('lowerarm_l', -1.2, 0, 0);
      w.set('lowerarm_r', -1.2, 0, 0);
    },
  },
  {
    name: 'stop', duration: 0.6, loop: false, category: 'locomotion',
    fn: (t, w) => {
      const a = kf(t, [[0, 1], [0.4, 1], [1, 0]]);
      w.set('spine_02', -0.15 * a, 0, 0);
      w.pos('hips', 0, -0.08 * a, -0.05 * a);
      w.set('thigh_l', -0.4 * a, 0, 0);
      w.set('thigh_r', 0.3 * a, 0, 0);
      w.set('calf_l', 0.7 * a, 0, 0);
      w.set('upperarm_l', 0.4 * a, 0, -0.4);
      w.set('upperarm_r', 0.4 * a, 0, 0.4);
    },
  },
];
