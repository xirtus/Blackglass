import * as THREE from 'three';
import { BONE_DEFS, BONE_MAP, RIG_VERSION, type BoneDef } from './spec';

export interface BuiltRig {
  root: THREE.Bone;
  bones: Map<string, THREE.Bone>;
  skeleton: THREE.Skeleton;
  version: typeof RIG_VERSION;
}

/**
 * Build the canonical bone hierarchy. Local positions are derived from world
 * rest positions; every local rotation is identity at rest (REST-ALIGNED).
 * `heightScale` scales all offsets uniformly (applied to bone offsets so skinned
 * meshes built from the same data match exactly).
 */
export function buildRig(heightScale = 1): BuiltRig {
  const bones = new Map<string, THREE.Bone>();
  const worldPos = (def: BoneDef): THREE.Vector3 =>
    new THREE.Vector3(def.pos[0], def.pos[1], def.pos[2]).multiplyScalar(heightScale);

  let rootBone: THREE.Bone | null = null;
  for (const def of BONE_DEFS) {
    const b = new THREE.Bone();
    b.name = def.name;
    const wp = worldPos(def);
    if (def.parent) {
      const parent = bones.get(def.parent)!;
      const pw = worldPos(BONE_MAP.get(def.parent)!);
      b.position.copy(wp).sub(pw);
      parent.add(b);
    } else {
      b.position.copy(wp);
      rootBone = b;
    }
    bones.set(def.name, b);
  }
  const ordered = BONE_DEFS.map((d) => bones.get(d.name)!);
  return { root: rootBone!, bones, skeleton: new THREE.Skeleton(ordered), version: RIG_VERSION };
}

/** Compute world-space rest position of any bone (heightScale aware). */
export function restWorld(name: string, heightScale = 1): THREE.Vector3 {
  const def = BONE_MAP.get(name);
  if (!def) throw new Error(`unknown bone ${name}`);
  return new THREE.Vector3(...def.pos).multiplyScalar(heightScale);
}
