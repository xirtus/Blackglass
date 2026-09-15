import { kf, type ClipDef } from '../pose';

/** Distribute a chest rotation across the three spine bones for smooth curvature. */
function spine(w: import('../pose').PoseWriter, x: number, y: number): void {
  w.set('spine_01', x * 0.3, y * 0.3, 0);
  w.set('spine_02', x * 0.45, y * 0.45, 0);
  w.set('spine_03', x * 0.25, y * 0.25, 0);
}

/** Side-on batting base (shared by stance & shots). */
function stanceBase(t: number, w: import('../pose').PoseWriter): void {
  const bounce = Math.sin(t * Math.PI * 2 * 2.2) * 0.5 + 0.5;
  w.set('hips', 0, -0.55, 0);   // properly side-on
  spine(w, 0.08, -0.42);
  w.pos('hips', 0, -0.035 + bounce * 0.006, 0.01);
  w.set('thigh_l', 0.10, 0, 0.03);
  w.set('thigh_r', -0.08, 0, -0.03);
  w.set('calf_l', 0.22, 0, 0);
  w.set('calf_r', 0.18, 0, 0);
  w.set('head', 0, 0.85, 0); // eyes back over the shoulder at the bowler
  w.set('neck_01', 0, 0.2, 0);
}

export const CRICKET: ClipDef[] = [
  {
    name: 'cricket_stance', duration: 2.2, loop: true, category: 'cricket/batting',
    fn: (t, w) => {
      stanceBase(t, w);
      // both arms low in front of the back hip, hands together on the handle
      // (right hand pulled toward the midline so the left genuinely reaches it)
      w.set('upperarm_r', -0.34, -0.34, 0.42);
      w.set('lowerarm_r', -0.30, 0, 0);
      w.set('upperarm_l', -0.30, -0.30, -0.40);
      w.set('lowerarm_l', -0.55, 0.25, 0);
      w.curlFingers(1, 0.85);
      w.curlFingers(-1, 0.85);
    },
  },
  {
    name: 'cricket_shot_defend', duration: 1.0, loop: false, category: 'cricket/batting',
    fn: (t, w) => {
      stanceBase(0.3, w);
      w.set('upperarm_r', kf(t, [[0, -0.42], [0.2, 0.15], [0.45, -0.75], [1, -0.8]]), -0.1, 0.38);
      w.set('lowerarm_r', kf(t, [[0, -0.35], [0.45, -0.15], [1, -0.2]]), 0, 0);
      w.set('upperarm_l', kf(t, [[0, -0.35], [0.2, -0.15], [0.45, -0.55], [1, -0.6]]), 0.12, -0.38);
      w.set('lowerarm_l', kf(t, [[0, -0.55], [0.45, -0.35], [1, -0.4]]), 0.15, 0);
      spine(w, kf(t, [[0, 0.08], [0.45, 0.10], [1, 0.10]]), kf(t, [[0, -0.30], [0.2, -0.35], [0.45, -0.12], [1, -0.08]]));
      w.set('hips', 0, kf(t, [[0, -0.35], [0.45, -0.22], [1, -0.2]]), 0);
      w.pos('hips', 0, kf(t, [[0, -0.035], [0.45, -0.045], [1, -0.02]]), kf(t, [[0, 0.01], [0.45, 0.08], [1, 0.06]]));
      w.set('thigh_l', kf(t, [[0, 0.10], [0.45, -0.25], [1, -0.18]]), 0, 0.03);
      w.set('calf_l', kf(t, [[0, 0.22], [0.45, 0.12], [1, 0.18]]), 0, 0);
      w.set('head', 0.05, 0.55, 0);
      w.curlFingers(1, 0.85); w.curlFingers(-1, 0.85);
    },
  },
  {
    name: 'cricket_shot_drive', duration: 1.0, loop: false, category: 'cricket/batting',
    fn: (t, w) => {
      stanceBase(0.3, w);
      w.set('upperarm_r', kf(t, [[0, -0.42], [0.18, 0.75], [0.48, -1.05], [1, -2.2]]), kf(t, [[0, -0.12], [0.48, 0.05], [1, 0.15]]), 0.35);
      w.set('lowerarm_r', kf(t, [[0, -0.35], [0.18, -0.6], [0.48, -0.12], [1, -0.25]]), 0, 0);
      w.set('upperarm_l', kf(t, [[0, -0.35], [0.18, 0.3], [0.48, -0.85], [1, -1.9]]), kf(t, [[0, 0.15], [0.48, 0.0], [1, -0.1]]), -0.35);
      w.set('lowerarm_l', kf(t, [[0, -0.55], [0.18, -0.75], [0.48, -0.3], [1, -0.5]]), 0.15, 0);
      spine(w, kf(t, [[0, 0.08], [0.18, 0.0], [0.48, 0.14], [1, -0.08]]), kf(t, [[0, -0.30], [0.18, -0.42], [0.48, 0.12], [1, 0.35]]));
      w.set('hips', 0, kf(t, [[0, -0.35], [0.18, -0.4], [0.48, -0.1], [1, 0.1]]), 0);
      w.pos('hips', 0, kf(t, [[0, -0.035], [0.18, -0.06], [0.48, -0.02], [1, 0.02]]), kf(t, [[0, 0.01], [0.48, 0.13], [1, 0.07]]));
      w.set('thigh_l', kf(t, [[0, 0.10], [0.2, 0.22], [0.48, -0.3], [1, -0.18]]), 0, 0.03);
      w.set('thigh_r', kf(t, [[0, -0.08], [0.2, -0.16], [0.48, 0.15], [1, 0.22]]), 0, -0.03);
      w.set('calf_l', kf(t, [[0, 0.22], [0.48, 0.1], [1, 0.18]]), 0, 0);
      w.set('calf_r', kf(t, [[0, 0.18], [0.48, 0.42], [1, 0.3]]), 0, 0);
      w.set('head', kf(t, [[0, 0], [0.48, 0.02], [1, -0.15]]), 0.55, 0);
      w.curlFingers(1, 0.85); w.curlFingers(-1, 0.85);
    },
  },
  {
    name: 'cricket_shot_loft', duration: 1.05, loop: false, category: 'cricket/batting',
    fn: (t, w) => {
      stanceBase(0.3, w);
      w.set('upperarm_r', kf(t, [[0, -0.42], [0.18, 0.85], [0.5, -1.15], [1, -2.5]]), kf(t, [[0, -0.1], [1, 0.2]]), 0.3);
      w.set('lowerarm_r', kf(t, [[0, -0.35], [0.18, -0.65], [0.5, -0.1], [1, -0.2]]), 0, 0);
      w.set('upperarm_l', kf(t, [[0, -0.35], [0.18, 0.35], [0.5, -0.95], [1, -2.2]]), 0.1, -0.3);
      w.set('lowerarm_l', kf(t, [[0, -0.55], [0.5, -0.3], [1, -0.45]]), 0.15, 0);
      spine(w, kf(t, [[0, 0.08], [0.18, -0.02], [0.5, 0.10], [1, -0.3]]), kf(t, [[0, -0.30], [0.18, -0.42], [0.5, 0.18], [1, 0.4]]));
      w.set('hips', 0, kf(t, [[0, -0.35], [0.5, -0.05], [1, 0.15]]), 0);
      w.pos('hips', 0, kf(t, [[0, -0.035], [0.18, -0.07], [0.5, 0.0], [1, 0.05]]), kf(t, [[0, 0.01], [0.5, 0.12], [1, 0.05]]));
      w.set('thigh_l', kf(t, [[0, 0.10], [0.5, -0.32], [1, -0.22]]), 0, 0.03);
      w.set('calf_r', kf(t, [[0, 0.18], [0.5, 0.45], [1, 0.35]]), 0, 0);
      w.set('head', kf(t, [[0, 0], [1, -0.3]]), 0.55, 0);
      w.curlFingers(1, 0.85); w.curlFingers(-1, 0.85);
    },
  },
  {
    name: 'cricket_shot_cut', duration: 0.95, loop: false, category: 'cricket/batting',
    fn: (t, w) => {
      stanceBase(0.3, w);
      w.set('upperarm_r', kf(t, [[0, -0.42], [0.2, 0.45], [0.5, -0.75], [1, -1.1]]), 0, kf(t, [[0, 0.35], [0.5, -0.15], [1, -0.1]]));
      w.set('lowerarm_r', kf(t, [[0, -0.5], [0.5, -0.1], [1, -0.15]]), 0, 0);
      w.set('upperarm_l', kf(t, [[0, -0.35], [0.2, 0.1], [0.5, -0.5], [1, -0.7]]), 0.15, -0.35);
      w.set('lowerarm_l', kf(t, [[0, -0.55], [0.5, -0.25], [1, -0.3]]), 0.15, 0);
      spine(w, 0.05, kf(t, [[0, -0.30], [0.2, -0.48], [0.5, 0.22], [1, 0.32]]));
      w.set('hips', 0, kf(t, [[0, -0.35], [0.5, -0.05], [1, 0.05]]), 0);
      w.pos('hips', 0, kf(t, [[0, -0.035], [0.5, -0.06], [1, -0.03]]), -0.02);
      w.set('thigh_r', kf(t, [[0, -0.08], [0.5, 0.3], [1, 0.25]]), 0, -0.1);
      w.set('calf_r', kf(t, [[0, 0.18], [0.5, 0.5], [1, 0.4]]), 0, 0);
      w.set('thigh_l', kf(t, [[0, 0.10], [0.5, -0.08], [1, -0.05]]), 0, 0.05);
      w.set('head', 0, 0.6, 0);
      w.curlFingers(1, 0.85); w.curlFingers(-1, 0.85);
    },
  },
  {
    name: 'cricket_shot_pull', duration: 0.95, loop: false, category: 'cricket/batting',
    fn: (t, w) => {
      stanceBase(0.3, w);
      w.set('upperarm_r', kf(t, [[0, -0.42], [0.2, 0.5], [0.5, -0.85], [1, -1.3]]), kf(t, [[0, -0.1], [0.5, 0.3], [1, 0.35]]), kf(t, [[0, 0.35], [0.5, 0.0], [1, 0.05]]));
      w.set('lowerarm_r', kf(t, [[0, -0.6], [0.5, -0.15], [1, -0.2]]), 0, 0);
      w.set('upperarm_l', kf(t, [[0, -0.35], [0.2, 0.2], [0.5, -0.7], [1, -1.1]]), 0.25, -0.35);
      w.set('lowerarm_l', kf(t, [[0, -0.55], [0.5, -0.3], [1, -0.4]]), 0.15, 0);
      spine(w, -0.05, kf(t, [[0, -0.30], [0.2, -0.52], [0.5, 0.38], [1, 0.55]]));
      w.set('hips', 0, kf(t, [[0, -0.35], [0.2, -0.5], [0.5, 0.2], [1, 0.35]]), 0);
      w.pos('hips', 0, kf(t, [[0, -0.035], [0.5, -0.05], [1, -0.01]]), -0.03);
      w.set('thigh_r', kf(t, [[0, -0.08], [0.5, 0.28], [1, 0.35]]), 0, -0.08);
      w.set('calf_l', kf(t, [[0, 0.22], [0.5, 0.3], [1, 0.25]]), 0, 0);
      w.set('head', 0, kf(t, [[0, 0.55], [0.5, 0.7], [1, 0.8]]), 0);
      w.curlFingers(1, 0.85); w.curlFingers(-1, 0.85);
    },
  },
  {
    name: 'cricket_shot_sweep', duration: 1.05, loop: false, category: 'cricket/batting',
    fn: (t, w) => {
      stanceBase(0.3, w);
      w.set('upperarm_r', kf(t, [[0, -0.42], [0.25, 0.3], [0.55, -0.9], [1, -1.2]]), kf(t, [[0, -0.1], [0.55, 0.25], [1, 0.3]]), 0.25);
      w.set('lowerarm_r', kf(t, [[0, -0.35], [0.55, -0.15], [1, -0.2]]), 0, 0);
      w.set('upperarm_l', kf(t, [[0, -0.35], [0.55, -0.7], [1, -0.9]]), 0.25, -0.3);
      w.set('lowerarm_l', kf(t, [[0, -0.55], [0.55, -0.35], [1, -0.4]]), 0.15, 0);
      spine(w, kf(t, [[0, 0.08], [0.35, 0.35], [1, 0.3]]), kf(t, [[0, -0.30], [0.25, -0.45], [0.55, 0.25], [1, 0.35]]));
      w.set('hips', 0, kf(t, [[0, -0.35], [0.55, 0.1], [1, 0.2]]), 0);
      w.pos('hips', 0, kf(t, [[0, -0.035], [0.35, -0.42], [1, -0.4]]), kf(t, [[0, 0.01], [0.35, 0.06], [1, 0.05]]));
      w.set('thigh_l', kf(t, [[0, 0.10], [0.35, -1.5], [1, -1.4]]), 0, 0.05);
      w.set('calf_l', kf(t, [[0, 0.22], [0.35, 2.0], [1, 1.9]]), 0, 0);
      w.set('thigh_r', kf(t, [[0, -0.08], [0.35, 0.9], [1, 0.85]]), 0, -0.05);
      w.set('calf_r', kf(t, [[0, 0.18], [0.35, 0.5], [1, 0.5]]), 0, 0);
      w.set('head', kf(t, [[0, 0], [0.35, 0.2], [1, 0.2]]), kf(t, [[0, 0.55], [1, 0.7]]), 0);
      w.curlFingers(1, 0.85); w.curlFingers(-1, 0.85);
    },
  },
  {
    name: 'cricket_leave', duration: 0.9, loop: false, category: 'cricket/batting',
    fn: (t, w) => {
      stanceBase(0.3, w);
      const a = kf(t, [[0, 0], [0.35, 1], [1, 0.8]]);
      // bat lifted high out of the line, watch it through
      w.set('upperarm_r', -0.42 - a * 1.6, -0.3 * a, 0.3);
      w.set('upperarm_l', -0.35 - a * 1.3, 0.3 * a, -0.3);
      w.set('lowerarm_r', -0.5 * a, 0, 0);
      w.set('lowerarm_l', -0.6 * a, 0.2 * a, 0);
      spine(w, -0.05 * a, -0.30 - a * 0.15);
      w.set('head', 0.05 * a, 0.55 + a * 0.1, 0);
      w.curlFingers(1, 0.85); w.curlFingers(-1, 0.85);
    },
  },
  {
    name: 'cricket_bowl_action', duration: 1.0, loop: false, category: 'cricket/bowling',
    events: [{ t: 0.8, name: 'release' }],
    fn: (t, w) => {
      // ported from the proven capsule-rig action, mapped to canonical bones
      w.set('upperarm_r', kf(t, [[0, -1.1], [0.28, -2.3], [0.55, -1.0], [0.8, -2.0], [1, -1.5]]), 0, 0.5);
      w.set('lowerarm_r', -kf(t, [[0, 0.5], [0.28, 0.75], [0.55, 0.35], [0.8, 0.04], [1, 0.2]]), 0, 0);
      w.set('upperarm_l', kf(t, [[0, -0.3], [0.3, -1.7], [0.6, -1.9], [0.8, -0.55], [1, -0.3]]), 0, -0.3);
      w.set('lowerarm_l', -kf(t, [[0, 0.4], [0.3, 0.15], [0.6, 0.1], [0.8, 0.65], [1, 0.85]]), 0, 0);
      const chestY = kf(t, [[0, 0], [0.3, -0.22], [0.6, 0.15], [0.85, 0.95], [1, 1.15]]);
      const chestX = kf(t, [[0, 0.1], [0.3, 0.02], [0.6, -0.15], [0.85, -0.5], [1, -0.6]]);
      spine(w, chestX, chestY);
      w.set('hips', 0, kf(t, [[0, -0.5], [0.3, -0.62], [0.6, -0.2], [0.85, 0.3], [1, 0.45]]), 0);
      w.set('thigh_l', kf(t, [[0, -0.25], [0.25, -0.55], [0.5, -0.62], [1, -0.5]]), 0, 0);
      w.set('calf_l', kf(t, [[0, 0.35], [0.5, 0.14], [1, 0.25]]), 0, 0);
      w.set('thigh_r', kf(t, [[0, 0.3], [0.3, 0.5], [0.6, 0.15], [0.85, -0.4], [1, -0.55]]), 0, 0);
      w.set('calf_r', kf(t, [[0, 0.5], [0.3, 0.8], [0.6, 1.0], [0.85, 0.5], [1, 0.3]]), 0, 0);
      w.pos('hips', 0, kf(t, [[0, 0], [0.3, -0.07], [0.65, 0.02], [1, 0.06]]), 0);
      w.set('head', -chestX * 0.5, -chestY * 0.4, 0);
      w.curlFingers(-1, kf(t, [[0, 0.9], [0.79, 0.9], [0.85, 0.1], [1, 0.2]]));
    },
  },
  {
    name: 'cricket_field_ready', duration: 2.4, loop: true, category: 'cricket/fielding',
    fn: (t, w) => {
      const b = Math.sin(t * Math.PI * 2 * 1.5) * 0.5 + 0.5;
      w.pos('hips', 0, -0.13 + b * 0.005, 0.03);
      w.set('spine_01', 0.16, 0, 0);
      w.set('spine_02', 0.14, 0, 0);
      w.set('thigh_l', -0.3, 0, 0.05);
      w.set('thigh_r', -0.3, 0, -0.05);
      w.set('calf_l', 0.5, 0, 0);
      w.set('calf_r', 0.5, 0, 0);
      w.set('foot_l', -0.15, 0, 0);
      w.set('foot_r', -0.15, 0, 0);
      w.set('upperarm_l', -0.5, 0.1, -0.3);
      w.set('upperarm_r', -0.5, -0.1, 0.3);
      w.set('lowerarm_l', -0.4, 0, 0);
      w.set('lowerarm_r', -0.4, 0, 0);
      w.set('head', 0.08, 0, 0);
    },
  },
  {
    name: 'cricket_keeper_stance', duration: 2.4, loop: true, category: 'cricket/wicketkeeping',
    fn: (t, w) => {
      const b = Math.sin(t * Math.PI * 2 * 1.2) * 0.5 + 0.5;
      w.pos('hips', 0, -0.38 + b * 0.004, 0.03);
      w.set('spine_01', 0.3, 0, 0);
      w.set('spine_02', 0.28, 0, 0);
      w.set('thigh_l', -1.0, 0, 0.08);
      w.set('thigh_r', -1.0, 0, -0.08);
      w.set('calf_l', 1.5, 0, 0);
      w.set('calf_r', 1.5, 0, 0);
      w.set('foot_l', -0.5, 0, 0);
      w.set('foot_r', -0.5, 0, 0);
      w.set('upperarm_l', -0.75, 0.15, -0.25);
      w.set('upperarm_r', -0.75, -0.15, 0.25);
      w.set('lowerarm_l', -0.35, 0.2, 0);
      w.set('lowerarm_r', -0.35, -0.2, 0);
      w.set('head', 0.15, 0, 0);
    },
  },
  {
    name: 'cricket_keeper_take', duration: 0.8, loop: false, category: 'cricket/wicketkeeping',
    events: [{ t: 0.4, name: 'catch' }],
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.3, 1], [0.7, 0.9], [1, 0.2]]);
      w.pos('hips', 0.05 * a, -0.3 * a, 0.03);
      w.set('thigh_l', -0.85 * a, 0, 0.08);
      w.set('thigh_r', -0.85 * a, 0, -0.08);
      w.set('calf_l', 1.3 * a, 0, 0);
      w.set('calf_r', 1.3 * a, 0, 0);
      w.set('spine_02', 0.25 * a, 0, 0);
      w.set('upperarm_l', -0.8 * a, 0.3 * a, -0.2);
      w.set('upperarm_r', -0.8 * a, -0.3 * a, 0.2);
      w.set('lowerarm_l', -0.4 * a, 0.35 * a, 0);
      w.set('lowerarm_r', -0.4 * a, -0.35 * a, 0);
      const c = kf(t, [[0, 0], [0.38, 0], [0.45, 1], [1, 0.6]]);
      w.curlFingers(1, c * 0.9); w.curlFingers(-1, c * 0.9);
      w.set('head', 0.1 * a, 0, 0);
    },
  },
  {
    name: 'cricket_appeal', duration: 1.6, loop: false, category: 'cricket/fielding',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.2, 1], [0.85, 1], [1, 0.4]]);
      w.set('upperarm_l', -2.7 * a, 0, -0.15);
      w.set('upperarm_r', -2.7 * a, 0, 0.15);
      w.set('lowerarm_l', -0.35 * a, 0, 0);
      w.set('lowerarm_r', -0.35 * a, 0, 0);
      w.set('spine_03', -0.1 * a, 0, 0);
      w.pos('hips', 0, Math.sin(Math.min(1, t * 1.2) * Math.PI) * 0.05, 0);
      w.set('head', -0.12 * a, 0, 0);
    },
  },
  {
    name: 'cricket_celebrate_fist', duration: 1.4, loop: false, category: 'cricket/celebrations',
    fn: (t, w) => {
      w.set('upperarm_r', kf(t, [[0, 0], [0.3, -1.4], [0.5, -0.9], [0.7, -1.4], [1, -1.2]]), 0, 0.25);
      w.set('lowerarm_r', -1.8, 0, 0);
      w.curlFingers(-1, 0.95);
      w.pos('hips', 0, -Math.abs(Math.sin(t * Math.PI * 5)) * 0.03, 0);
      w.set('head', -0.1, 0, 0);
    },
  },
  {
    name: 'cricket_umpire_out', duration: 1.6, loop: false, category: 'cricket/umpire',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.3, 1], [1, 1]]);
      w.set('upperarm_r', -1.5 * a, 0, 0.3);
      w.set('lowerarm_r', -1.9 * a, 0, 0);
      w.curlFingers(-1, 0.9 * a);
      w.axis('index_01_r', 0.7071, -0.7071, 0, -0.95 * a);
      w.axis('index_02_r', 0.7071, -0.7071, 0, -0.95 * a);
      w.axis('index_03_r', 0.7071, -0.7071, 0, -0.95 * a);
      w.set('head', 0.05, 0, 0);
    },
  },
  {
    name: 'cricket_umpire_four', duration: 1.8, loop: false, category: 'cricket/umpire',
    fn: (t, w) => {
      const sweep = Math.sin(Math.min(1, t) * Math.PI * 3) * 0.7;
      w.set('upperarm_r', -0.9, sweep * 0.5, 0.9);
      w.set('lowerarm_r', -0.15, 0, 0);
      w.set('spine_02', 0.05, sweep * 0.1, 0);
    },
  },
  {
    name: 'cricket_umpire_six', duration: 1.6, loop: false, category: 'cricket/umpire',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.35, 1], [1, 1]]);
      w.set('upperarm_l', -Math.PI * a, 0, -0.1);
      w.set('upperarm_r', -Math.PI * a, 0, 0.1);
      w.set('lowerarm_l', -0.1, 0, 0);
      w.set('lowerarm_r', -0.1, 0, 0);
      w.set('head', -0.15 * a, 0, 0);
    },
  },
  {
    name: 'cricket_umpire_wide', duration: 1.6, loop: false, category: 'cricket/umpire',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.3, 1], [1, 1]]);
      w.set('upperarm_l', -0.15 * a, 0, 0.79 + 0.4 * a);
      w.set('upperarm_r', -0.15 * a, 0, -0.79 - 0.4 * a);
      w.set('lowerarm_l', -0.05, 0, 0);
      w.set('lowerarm_r', -0.05, 0, 0);
      w.set('spine_02', 0.03, 0, 0);
    },
  },
  {
    name: 'cricket_umpire_legbye', duration: 1.6, loop: false, category: 'cricket/umpire',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.3, 1], [0.6, 0.4], [0.9, 1], [1, 0.8]]);
      w.set('upperarm_r', -0.3 * a, 0, 0.35);
      w.set('lowerarm_r', -1.1 * a, 0, 0);
      w.set('thigh_r', -0.4 * a, 0, -0.05);
      w.set('calf_r', 0.6 * a, 0, 0);
    },
  },
  {
    name: 'cricket_umpire_deadball', duration: 1.6, loop: false, category: 'cricket/umpire',
    fn: (t, w) => {
      const a = kf(t, [[0, 0], [0.3, 1], [0.65, 1], [1, 0]]);
      w.set('upperarm_l', -0.9 * a, 0.5 * a, -0.25 * a);
      w.set('upperarm_r', -0.9 * a, -0.5 * a, 0.25 * a);
      w.set('lowerarm_l', -1.2 * a, 0.4 * a, 0);
      w.set('lowerarm_r', -1.2 * a, -0.4 * a, 0);
      w.pos('hips', 0, -0.08 * a, 0);
    },
  },
];
