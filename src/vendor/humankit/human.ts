import * as THREE from 'three';
import { buildRig, type BuiltRig } from './rig/build';
import { BONE_DEFS } from './rig/spec';
import { buildBody } from './body/body';
import { buildHead, buildEars } from './body/head';
import { buildEyes, type Eyes } from './body/eyes';
import { buildHair, buildBeard } from './body/hair';
import { skinMaterial, hairMaterial } from './body/materials';
import type { HumanDNA } from './body/profiles';
import { Animator, type PlayOptions } from './anim/animator';
import { bakeClip, mirrorClip } from './anim/clip';
import { ALL_CLIP_DEFS } from './anim/library';
import { solveLookAt, solveTwoBoneIK, relaxLookAt } from './anim/ik';
import { buildShirt, buildTrousers, buildShoes } from './clothing/garments';
import { createKitMaterials, type TeamKit, type KitMaterials } from './clothing/kit';

export type QualityTier = 'hero' | 'gameplay' | 'distant' | 'crowd';

export interface HumanOptions {
  dna: HumanDNA;
  tier?: QualityTier;
  animations?: 'all' | 'none';
  sleeve?: 'none' | 'short' | 'long';
  trouserLength?: 'shorts' | 'long';
}

const TIER_SEGS: Record<QualityTier, { body: number; limb: number; head: number; fingers: boolean }> = {
  hero: { body: 20, limb: 8, head: 30, fingers: true },
  gameplay: { body: 14, limb: 6, head: 22, fingers: true },
  distant: { body: 9, limb: 4, head: 14, fingers: false },
  crowd: { body: 6, limb: 3, head: 8, fingers: false },
};

let bakedClips: THREE.AnimationClip[] | null = null;
function sharedClips(): THREE.AnimationClip[] {
  if (!bakedClips) {
    const t0 = performance.now();
    bakedClips = ALL_CLIP_DEFS.map(bakeClip);
    // safe mirrors (symmetric rig): expand the vault cheaply
    const find = (n: string): THREE.AnimationClip => bakedClips!.find((c) => c.name === n)!;
    bakedClips.push(mirrorClip(find('catch_dive_r'), 'catch_dive_l'));
    bakedClips.push(mirrorClip(find('dodge_l'), 'dodge_r'));
    bakedClips.push(mirrorClip(find('strafe_l'), 'strafe_r'));
    console.info(`[humankit] baked ${bakedClips.length} clips in ${(performance.now() - t0).toFixed(0)}ms`);
  }
  return bakedClips;
}

/**
 * Human — the public facade. One modular animated person.
 * Games talk to this; they never touch bones or clips directly.
 */
export class Human {
  readonly root = new THREE.Group();        // game moves/rotates this
  readonly rig: BuiltRig;
  readonly dna: HumanDNA;
  readonly tier: QualityTier;
  readonly animator: Animator;
  readonly meshes = new Map<string, THREE.SkinnedMesh>();
  readonly eyes: Eyes;
  kit: KitMaterials | null = null;

  private lookTarget: THREE.Vector3 | null = null;
  private lookWeight = 0;
  /** post-mixer pose snapshots: procedural layers restore-then-apply, so every
   *  update is idempotent no matter how the mixer coalesces writes */
  private cleanPose = new Map<string, THREE.Quaternion>();
  private groundY: ((x: number, z: number) => number) | null = null;
  private equipment = new Map<string, THREE.Object3D>();
  private expressionTilt = new THREE.Euler();

  constructor(opts: HumanOptions) {
    this.dna = opts.dna;
    this.tier = opts.tier ?? 'gameplay';
    this.root.name = `human_${opts.dna.seed}`;
    const hs = this.dna.body.height / 1.8;
    this.rig = buildRig(hs);
    this.root.add(this.rig.root);

    const restPositions = new Map<string, THREE.Vector3>();
    for (const d of BONE_DEFS) {
      const b = this.rig.bones.get(d.name)!;
      restPositions.set(d.name, b.position.clone());
    }
    this.animator = new Animator(this.rig.root, restPositions);
    if (opts.animations !== 'none') for (const c of sharedClips()) this.animator.register(c);

    const ts = TIER_SEGS[this.tier];
    const boneByName = (names: string[]) => names.map((n) => this.rig.bones.get(n)!);

    const addSkinned = (name: string, built: { geometry: THREE.BufferGeometry; boneNames: string[] }, mat: THREE.Material) => {
      const mesh = new THREE.SkinnedMesh(built.geometry, mat);
      mesh.name = `mesh_${name}`; // never collide with bone names (mixer binds by name)
      const bones = boneByName(built.boneNames);
      this.rig.root.updateWorldMatrix(true, true);
      mesh.bind(new THREE.Skeleton(bones));
      mesh.castShadow = this.tier !== 'crowd';
      mesh.receiveShadow = false;
      mesh.frustumCulled = false; // skinned bounds are stale; humans are few
      this.rig.root.add(mesh);
      this.meshes.set(name, mesh);
      return mesh;
    };

    // body
    const skin = skinMaterial(this.dna.skinTone, this.dna.seed, {
      roughness: this.dna.skinRoughness,
    });
    addSkinned('body', buildBody(this.dna.body, { segs: ts.body, ringsPerLimb: ts.limb, fingers: ts.fingers }), skin);

    // head (own material: face texture)
    const hb = buildHead(this.dna.face, this.dna.body.height, ts.head, Math.round(ts.head * 0.8));
    const headGeo: { geometry: THREE.BufferGeometry; boneNames: string[] } = { geometry: hb.geometry, boneNames: ['head', 'neck_01'] };
    const faceMat = skinMaterial(this.dna.skinTone, this.dna.seed + 5, {
      face: true, roughness: this.dna.skinRoughness * 0.9,
      stubble: this.dna.beardStyle === 'stubble' ? 1 : 0,
      lipFullness: this.dna.face.lipFullness,
      browColor: this.dna.hairColor,
    });
    addSkinned('head', headGeo, faceMat);
    addSkinned('ears', { geometry: buildEars(this.dna.face, this.dna.body.height), boneNames: ['head'] }, skin);

    // eyes
    this.eyes = buildEyes(hb.eyeL, hb.eyeR, hb.headJointY, this.dna.eyeColor, this.dna.seed, 0.0128 * hs);
    this.rig.bones.get('head')!.add(this.eyes.group);

    // hair
    const hairGeo = buildHair(this.dna, this.dna.face, this.dna.body.height, Math.max(12, ts.head - 6), Math.max(8, ts.head - 12));
    if (hairGeo) addSkinned('hair', { geometry: hairGeo, boneNames: ['head'] }, hairMaterial(this.dna.hairColor));
    const beardGeo = buildBeard(this.dna, this.dna.face, this.dna.body.height);
    if (beardGeo) addSkinned('beard', { geometry: beardGeo, boneNames: ['head'] }, hairMaterial(this.dna.hairColor));

    // default clothing (recolored by setTeamKit)
    if (this.tier !== 'crowd') {
      const defaultKit = createKitMaterials({ primary: 0x888888, secondary: 0xcccccc, accent: 0x222222 });
      this.kit = defaultKit;
      addSkinned('shirt', buildShirt(this.dna.body, { segs: ts.body - 2, sleeve: opts.sleeve ?? 'short' }), defaultKit.shirt);
      addSkinned('trousers', buildTrousers(this.dna.body, { segs: ts.body - 2, length: opts.trouserLength ?? 'long' }), defaultKit.trousers);
      addSkinned('shoes', buildShoes(this.dna.body), defaultKit.shoes);
    }
  }

  // ── animation API ──────────────────────────────────────────────────────
  play(name: string, opts?: PlayOptions): THREE.AnimationAction { return this.animator.play(name, opts); }
  overlay(name: string, opts?: PlayOptions): THREE.AnimationAction { return this.animator.overlay(name, opts); }
  scrub(name: string, progress: number): void { this.animator.scrub(name, progress); }
  endScrub(): void { this.animator.endScrub(); }
  stopAll(fade?: number): void { this.animator.stopAll(fade); }
  hasClip(name: string): boolean { return this.animator.has(name); }

  // ── senses / body ─────────────────────────────────────────────────────
  lookAt(target: THREE.Vector3 | null, weight = 1): void {
    this.lookTarget = target ? target.clone() : null;
    this.lookWeight = weight;
  }

  /** simple ground-following: keeps feet from sinking/floating on uneven ground */
  enableGroundAlign(fn: (x: number, z: number) => number): void { this.groundY = fn; }
  disableGroundAlign(): void { this.groundY = null; }

  /** subtle facial expression posture */
  setExpression(name: 'neutral' | 'focused' | 'happy' | 'angry' | 'tired'): void {
    switch (name) {
      case 'focused': this.expressionTilt.set(0.06, 0, 0); break;
      case 'happy': this.expressionTilt.set(-0.04, 0, 0.02); break;
      case 'angry': this.expressionTilt.set(0.12, 0, 0); break;
      case 'tired': this.expressionTilt.set(0.15, 0, 0.04); break;
      default: this.expressionTilt.set(0, 0, 0);
    }
  }

  // ── equipment / clothing ──────────────────────────────────────────────
  socket(name: string): THREE.Bone {
    const b = this.rig.bones.get(name);
    if (!b) throw new Error(`unknown socket ${name}`);
    return b;
  }

  equip(obj: THREE.Object3D, socketName = 'socket_hand_r', offset?: { pos?: THREE.Vector3; rot?: THREE.Euler }): void {
    this.unequip(socketName);
    const sock = this.socket(socketName);
    sock.add(obj);
    // socket world pos ≠ grip point: re-zero so object origin sits at socket
    obj.position.set(0, 0, 0);
    if (offset?.pos) obj.position.add(offset.pos);
    if (offset?.rot) obj.rotation.copy(offset.rot);
    this.equipment.set(socketName, obj);
  }

  unequip(socketName: string): void {
    const cur = this.equipment.get(socketName);
    if (cur) { cur.removeFromParent(); this.equipment.delete(socketName); }
  }

  getEquipped(socketName: string): THREE.Object3D | undefined { return this.equipment.get(socketName); }

  setTeamKit(kit: TeamKit): void {
    if (!this.kit) return;
    this.kit.apply(kit);
  }

  /** two-bone IK: move a hand/foot to a world target (call after play/scrub, before render) */
  ikLimb(chain: 'arm_l' | 'arm_r' | 'leg_l' | 'leg_r', targetWorld: THREE.Vector3, poleWorld?: THREE.Vector3): void {
    const names = {
      arm_l: ['clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l'],
      arm_r: ['clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r'],
      leg_l: ['hips', 'thigh_l', 'calf_l', 'foot_l'],
      leg_r: ['hips', 'thigh_r', 'calf_r', 'foot_r'],
    }[chain] as [string, string, string, string];
    const pole = poleWorld ?? new THREE.Vector3().copy(targetWorld).add(new THREE.Vector3(0, 0, chain.startsWith('arm') ? -0.5 : 0.5));
    // clavicle participation: yaw the shoulder girdle toward far targets first (arms only)
    if (chain.startsWith('arm')) {
      const clav = this.rig.bones.get(names[0])!;
      const ua = this.rig.bones.get(names[1])!;
      this.rig.root.updateWorldMatrix(true, true);
      const cw = new THREE.Vector3().setFromMatrixPosition(clav.matrixWorld);
      const sw = new THREE.Vector3().setFromMatrixPosition(ua.matrixWorld);
      const curDir = sw.clone().sub(cw);
      const wantDir = targetWorld.clone().sub(cw);
      const curYaw = Math.atan2(curDir.x, curDir.z);
      const wantYaw = Math.atan2(wantDir.x, wantDir.z);
      let dy = wantYaw - curYaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const maxYaw = 0.45;
      // clavicles aren't animated by clips: assign rest-relative yaw (never accumulate)
      clav.rotation.y = THREE.MathUtils.clamp(dy, -maxYaw, maxYaw);
    }
    solveTwoBoneIK(this.rig.bones.get(names[1])!, this.rig.bones.get(names[2])!, this.rig.bones.get(names[3])!, targetWorld, pole);
  }

  bone(name: string): THREE.Bone { return this.rig.bones.get(name)!; }

  boneWorld(name: string, out = new THREE.Vector3()): THREE.Vector3 {
    return out.setFromMatrixPosition(this.rig.bones.get(name)!.matrixWorld);
  }

  update(dt: number): void {
    this.animator.update(dt);
    // restore head/neck to the mixer's clean pose before procedural layers
    // (paused scrub actions may not re-write every update — never accumulate)
    const headB = this.rig.bones.get('head')!;
    const neckB = this.rig.bones.get('neck_01')!;
    const ch = this.cleanPose.get('head');
    const cn = this.cleanPose.get('neck_01');
    if (ch) headB.quaternion.copy(ch);
    if (cn) neckB.quaternion.copy(cn);
    this.cleanPose.set('head', headB.quaternion.clone());
    this.cleanPose.set('neck_01', neckB.quaternion.clone());
    this.rig.root.updateWorldMatrix(true, true);
    // look-at (post-animation override, smoothed + rate-limited)
    if (this.lookTarget && this.lookWeight > 0) {
      solveLookAt(this.rig.bones.get('head')!, this.rig.bones.get('neck_01')!, this.lookTarget, { weight: this.lookWeight, dt });
      // eyes lead
      const hp = this.boneWorld('head');
      const dir = this.lookTarget.clone().sub(hp).normalize();
      const hq = this.rig.bones.get('head')!.getWorldQuaternion(new THREE.Quaternion()).invert();
      this.eyes.look(dir.applyQuaternion(hq));
    } else {
      relaxLookAt(this.rig.bones.get('head')!, dt);
      this.eyes.look(new THREE.Vector3(0, 0, 1));
    }
    if (this.expressionTilt.x || this.expressionTilt.z) {
      const h = this.rig.bones.get('head')!;
      h.rotation.x += this.expressionTilt.x;
      h.rotation.z += this.expressionTilt.z;
    }
    // ground align: smoothly settle the root so the lowest foot touches ground.
    // Bidirectional with a soft band so airborne poses (jump/dive) aren't dragged,
    // and it can never latch into a float.
    if (this.groundY) {
      this.rig.root.updateWorldMatrix(true, true);
      const fl = this.boneWorld('foot_l');
      const fr = this.boneWorld('foot_r');
      const g = this.groundY(this.root.position.x, this.root.position.z);
      const ankleH = 0.075 * (this.dna.body.height / 1.8);
      const lowest = Math.min(fl.y, fr.y) - ankleH;
      const delta = lowest - g; // + = floating, − = sunk
      if (Math.abs(delta) > 0.004) {
        const rate = Math.min(1, dt * 14 + (dt === 0 ? 1 : 0)); // instant when posed synchronously
        this.rig.root.position.y -= THREE.MathUtils.clamp(delta, -0.35, 0.35) * rate;
      }
    }
  }
}
