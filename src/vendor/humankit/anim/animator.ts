import * as THREE from 'three';

export interface PlayOptions {
  fade?: number;        // crossfade seconds (default 0.25)
  loop?: boolean;       // override clip default
  timeScale?: number;
  clamp?: boolean;      // hold last frame
  additive?: boolean;   // treat as additive overlay
  onDone?: () => void;
}

interface ActiveEntry {
  action: THREE.AnimationAction;
  clip: THREE.AnimationClip;
  onDone?: () => void;
  eventsFired: Set<number>;
}

/**
 * Animator — state machine + layered playback over THREE.AnimationMixer.
 * Layering model: clips only carry tracks for bones they animate, so a
 * "wave" overlay naturally composes with "walk". Overlapping overlays can
 * be played additively.
 */
export class Animator {
  readonly mixer: THREE.AnimationMixer;
  private clips = new Map<string, THREE.AnimationClip>();
  private active = new Map<string, ActiveEntry>();
  private scrubAction: THREE.AnimationAction | null = null;
  private listeners = new Map<string, ((bone: string) => void)[]>();

  constructor(root: THREE.Object3D, private restPositions: Map<string, THREE.Vector3>) {
    this.mixer = new THREE.AnimationMixer(root);
    this.mixer.addEventListener('finished', (e) => {
      for (const [name, en] of this.active) {
        if (en.action === e.action) {
          en.onDone?.();
          if (!name.startsWith('__overlay')) this.active.delete(name);
        }
      }
    });
  }

  private resolved = new WeakMap<THREE.AnimationClip, THREE.AnimationClip>();

  /** Resolve hips/root position-offset tracks against THIS rig's rest pose.
   *  Shared baked clips are never mutated — each Animator gets its own resolved
   *  copy of any clip containing position tracks (heights differ per human). */
  private resolve(clip: THREE.AnimationClip): THREE.AnimationClip {
    let hasOffset = false;
    for (const tr of clip.tracks) if ((tr as any).humankitOffset) { hasOffset = true; break; }
    if (!hasOffset) return clip;
    const cached = this.resolved.get(clip);
    if (cached) return cached;
    const copy = clip.clone();
    for (const tr of copy.tracks) {
      if ((tr as any).humankitOffset) {
        const bone = tr.name.split('.')[0];
        const rest = this.restPositions.get(bone);
        if (rest) {
          const v = tr.values;
          for (let i = 0; i < v.length; i += 3) {
            v[i] += rest.x; v[i + 1] += rest.y; v[i + 2] += rest.z;
          }
        }
        delete (tr as any).humankitOffset;
      }
    }
    this.resolved.set(clip, copy);
    return copy;
  }

  register(clip: THREE.AnimationClip): void {
    this.clips.set(clip.name, clip);
  }

  has(name: string): boolean { return this.clips.has(name); }
  clipNames(): string[] { return [...this.clips.keys()]; }

  /** Play a clip, crossfading from whatever is currently primary. */
  play(name: string, opts: PlayOptions = {}): THREE.AnimationAction {
    const clip0 = this.clips.get(name);
    if (!clip0) throw new Error(`Animator: unknown clip "${name}"`);
    const clip = this.resolve(clip0);
    let src = clip;
    if (opts.additive) {
      src = THREE.AnimationUtils.makeClipAdditive(clip.clone());
      src.name = clip.name;
    }
    const action = this.mixer.clipAction(src);
    const meta = (clip as any).humankit ?? {};
    const loop = opts.loop ?? meta.loop ?? false;
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = opts.clamp ?? !loop;
    action.timeScale = opts.timeScale ?? 1;
    action.enabled = true;

    const fade = opts.fade ?? 0.25;
    // fade out other non-overlay actions on overlapping bones (simple: fade all primaries)
    for (const [n, en] of this.active) {
      if (n.startsWith('__overlay')) continue;
      if (en.action !== action) en.action.fadeOut(fade);
    }
    this.active.delete('__scrub');
    this.scrubAction = null;

    action.fadeIn(fade).play();
    this.active.set(name, { action, clip, onDone: opts.onDone, eventsFired: new Set() });
    return action;
  }

  /** Play an overlay without disturbing the primary action (partial-body clips). */
  overlay(name: string, opts: PlayOptions = {}): THREE.AnimationAction {
    const clip = this.resolve(this.clips.get(name) ?? (() => { throw new Error(`Animator: unknown clip "${name}"`); })());
    const action = this.mixer.clipAction(clip);
    const meta = (clip as any).humankit ?? {};
    const loop = opts.loop ?? meta.loop ?? false;
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = true;
    action.timeScale = opts.timeScale ?? 1;
    action.fadeIn(opts.fade ?? 0.15).play();
    this.active.set(`__overlay_${name}_${Math.random().toString(36).slice(2, 7)}`, {
      action, clip, onDone: opts.onDone, eventsFired: new Set(),
    });
    return action;
  }

  /** Deterministic scrub: pose = clip at progress 0..1. Kills other actions instantly. */
  scrub(name: string, progress: number): void {
    const clip = this.resolve(this.clips.get(name) ?? (() => { throw new Error(`Animator: unknown clip "${name}"`); })());
    if (!this.scrubAction || this.scrubAction.getClip() !== clip) {
      // hard-stop everything else: scrubbing is for deterministic gameplay poses
      for (const en of this.active.values()) en.action.stop();
      this.active.clear();
      this.mixer.stopAllAction();
      if (this.scrubAction) { this.scrubAction.stop(); this.scrubAction = null; }
      const a = this.mixer.clipAction(clip);
      a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.setEffectiveWeight(1); a.play();
      this.scrubAction = a;
    }
    this.scrubAction.paused = true;
    this.scrubAction.time = THREE.MathUtils.clamp(progress, 0, 1) * clip.duration;
  }

  endScrub(fade = 0.2): void {
    if (this.scrubAction) {
      this.scrubAction.fadeOut(fade);
      this.scrubAction = null;
    }
  }

  stopAll(fade = 0.25): void {
    for (const en of this.active.values()) en.action.fadeOut(fade);
    this.active.clear();
  }

  setTimeScale(name: string, ts: number): void {
    const en = this.active.get(name);
    if (en) en.action.timeScale = ts;
  }

  /** event callback when a clip crosses one of its declared events */
  onEvent(cb: (clipName: string, event: string) => void): void {
    (this.listeners.get('__all') ?? this.listeners.set('__all', []).get('__all')!).push(cb as never);
  }

  update(dt: number): void {
    this.mixer.update(dt);
    // fire events
    for (const [name, en] of this.active) {
      const events: { t: number; name: string }[] = ((en.clip as any).humankit?.events) ?? [];
      if (!events.length) continue;
      const frac = (en.action.time / en.clip.duration) % 1.000001;
      events.forEach((ev, i) => {
        if (frac >= ev.t && !en.eventsFired.has(i)) {
          en.eventsFired.add(i);
          for (const cb of this.listeners.get('__all') ?? []) (cb as unknown as (a: string, b: string) => void)(name, ev.name);
        }
      });
      if (en.action.loop === THREE.LoopRepeat && frac < 0.05) en.eventsFired.clear();
    }
  }

  isPlaying(name: string): boolean {
    const en = this.active.get(name);
    return !!en && en.action.isRunning();
  }
}
