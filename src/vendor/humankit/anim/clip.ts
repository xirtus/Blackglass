import * as THREE from 'three';
import { PoseWriter, type ClipDef } from './pose';

/** Bake a PoseFn into a real AnimationClip on canonical bone names (30 fps). */
export function bakeClip(def: ClipDef): THREE.AnimationClip {
  const fps = 30;
  const frames = Math.max(2, Math.round(def.duration * fps) + 1);
  const w = new PoseWriter();
  const samples: PoseWriter[] = [];
  const touchedRot = new Set<string>();
  const touchedPos = new Set<string>();

  for (let f = 0; f < frames; f++) {
    const t = f / (frames - 1);
    w.clear();
    def.fn(t, w);
    const c = w.clone();
    for (const k of c.eulers.keys()) touchedRot.add(k);
    for (const k of c.quats.keys()) touchedRot.add(k);
    for (const k of c.positions.keys()) touchedPos.add(k);
    samples.push(c);
  }

  const tracks: THREE.KeyframeTrack[] = [];
  const times = new Float32Array(frames);
  for (let f = 0; f < frames; f++) times[f] = (f / (frames - 1)) * def.duration;

  const q = new THREE.Quaternion();
  for (const bone of touchedRot) {
    const vals = new Float32Array(frames * 4);
    for (let f = 0; f < frames; f++) {
      const e = samples[f].eulers.get(bone);
      const qa = samples[f].quats.get(bone);
      if (e) q.setFromEuler(e); else q.identity();
      if (qa) q.premultiply(qa);
      vals[f * 4] = q.x; vals[f * 4 + 1] = q.y; vals[f * 4 + 2] = q.z; vals[f * 4 + 3] = q.w;
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times as unknown as number[], vals as unknown as number[]));
  }
  for (const bone of touchedPos) {
    const vals = new Float32Array(frames * 3);
    // positions written by pose fns are *offsets from rest*; resolved at bind time
    for (let f = 0; f < frames; f++) {
      const p = samples[f].positions.get(bone);
      vals[f * 3] = p?.x ?? 0; vals[f * 3 + 1] = p?.y ?? 0; vals[f * 3 + 2] = p?.z ?? 0;
    }
    const tr = new THREE.VectorKeyframeTrack(`${bone}.position`, times as unknown as number[], vals as unknown as number[]);
    (tr as any).humankitOffset = true; // Animator adds rest position at bind
    tracks.push(tr);
  }
  const clip = new THREE.AnimationClip(def.name, def.duration, tracks);
  (clip as any).humankit = { category: def.category ?? 'misc', loop: !!def.loop, events: def.events ?? [] };
  return clip;
}

/** Mirror a clip left↔right (swap _l/_r tracks, negate yaw/roll). Safe for symmetric rigs. */
export function mirrorClip(clip: THREE.AnimationClip, name?: string): THREE.AnimationClip {
  const tracks = clip.tracks.map((tr) => {
    let n = tr.name;
    let swap = false;
    if (n.includes('_l.')) { n = n.replace('_l.', '_r.'); swap = true; }
    else if (n.includes('_r.')) { n = n.replace('_r.', '_l.'); swap = true; }
    else if (n.includes('_l_')) { n = n.replace(/_l_/g, '_r_'); swap = true; }
    else if (n.includes('_r_')) { n = n.replace(/_r_/g, '_l_'); swap = true; }
    const t2 = tr.clone();
    t2.name = n;
    if (t2 instanceof THREE.QuaternionKeyframeTrack) {
      const v = t2.values;
      const q = new THREE.Quaternion();
      for (let i = 0; i < v.length; i += 4) {
        q.set(v[i], v[i + 1], v[i + 2], v[i + 3]);
        // mirror across YZ plane: negate x-axis rotation components' handedness
        const m = new THREE.Quaternion(q.x, -q.y, -q.z, q.w);
        v[i] = m.x; v[i + 1] = m.y; v[i + 2] = m.z; v[i + 3] = m.w;
      }
      if (!swap) void 0;
    } else if (t2 instanceof THREE.VectorKeyframeTrack) {
      const v = t2.values;
      for (let i = 0; i < v.length; i += 3) v[i] = -v[i];
    }
    return t2;
  });
  const out = new THREE.AnimationClip(name ?? `${clip.name}_mirrored`, clip.duration, tracks);
  (out as any).humankit = (clip as any).humankit;
  return out;
}
