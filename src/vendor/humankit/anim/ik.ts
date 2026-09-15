import * as THREE from 'three';

const _aw = new THREE.Vector3(), _bw = new THREE.Vector3(), _cw = new THREE.Vector3();

/**
 * Two-bone IK (shoulder→elbow→hand / hip→knee→ankle) solved in world space
 * and written back as local rotations. Works with REST-ALIGNED rigs.
 * `pole` biases the elbow/knee direction.
 */
export function solveTwoBoneIK(
  root: THREE.Bone, mid: THREE.Bone, end: THREE.Bone,
  targetWorld: THREE.Vector3, poleWorld: THREE.Vector3,
): void {
  root.updateWorldMatrix(true, false);
  mid.updateWorldMatrix(true, false);
  _aw.setFromMatrixPosition(root.matrixWorld);
  _bw.setFromMatrixPosition(mid.matrixWorld);
  _cw.setFromMatrixPosition(end.matrixWorld);

  const a = _aw, b = _bw, c = _cw;
  const lab = b.clone().sub(a).length();
  const lbc = c.clone().sub(b).length();
  const target = targetWorld.clone();
  let lac = target.clone().sub(a).length();
  lac = THREE.MathUtils.clamp(lac, Math.abs(lab - lbc) + 1e-4, lab + lbc - 1e-4);

  // current chain plane normal, steered toward pole
  const ac = target.clone().sub(a).normalize();
  const poleDir = poleWorld.clone().sub(a);
  const n = poleDir.sub(ac.clone().multiplyScalar(poleDir.dot(ac))).normalize();
  if (n.lengthSq() < 1e-6) n.set(0, 0, 1);

  // angle at root from cosine rule
  const cosA = THREE.MathUtils.clamp((lab * lab + lac * lac - lbc * lbc) / (2 * lab * lac), -1, 1);
  const angA = Math.acos(cosA);

  // desired mid position — n is already ⟂ ac and points toward the pole side
  const midTarget = a.clone()
    .add(ac.clone().multiplyScalar(Math.cos(angA) * lab))
    .add(n.clone().multiplyScalar(Math.sin(angA) * lab));

  // rotate root so that b lands on midTarget
  const curAB = b.clone().sub(a).normalize();
  const desAB = midTarget.clone().sub(a).normalize();
  applyWorldDeltaRotation(root, new THREE.Quaternion().setFromUnitVectors(curAB, desAB));

  // rotate mid so that c lands on target (end's matrixWorld is stale after root moved)
  mid.updateWorldMatrix(true, false);
  end.updateWorldMatrix(true, false);
  _bw.setFromMatrixPosition(mid.matrixWorld);
  _cw.setFromMatrixPosition(end.matrixWorld);
  const curBC = _cw.clone().sub(_bw).normalize();
  const desBC = target.clone().sub(_bw).normalize();
  applyWorldDeltaRotation(mid, new THREE.Quaternion().setFromUnitVectors(curBC, desBC));
}

/** Apply a world-space delta rotation to a bone (no shared temporaries). */
export function applyWorldDeltaRotation(bone: THREE.Object3D, dq: THREE.Quaternion): void {
  bone.updateWorldMatrix(true, false);
  const parentQ = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
  const worldQ = bone.getWorldQuaternion(new THREE.Quaternion());
  const newWorld = dq.clone().multiply(worldQ);
  bone.quaternion.copy(parentQ.invert().multiply(newWorld));
}

/** smooth per-bone look-at state (module map keyed by bone uuid) */
const lookState = new Map<string, { yaw: number; pitch: number }>();

/**
 * Procedural look-at for head + neck. Smoothed and angular-rate-limited so
 * targets can teleport (ball state changes) without heads ever snapping or
 * whipsawing. Call after animation each frame.
 */
export function solveLookAt(
  head: THREE.Bone, neck: THREE.Bone | null,
  targetWorld: THREE.Vector3,
  opts: { maxYaw?: number; maxPitch?: number; weight?: number; eyeHeadRatio?: number; dt?: number } = {},
): void {
  const weight = opts.weight ?? 1;
  if (weight <= 0) return;
  head.updateWorldMatrix(true, false);
  const hp = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld);
  const to = targetWorld.clone().sub(hp);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
  const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  const yaw = wrapPi(Math.atan2(to.x, to.z) - Math.atan2(fwd.x, fwd.z));
  const flat = Math.hypot(to.x, to.z);
  const pitch = wrapPi(-Math.atan2(to.y - hp.y, flat) - Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1)));

  // behind-the-head targets: give up gracefully rather than wrenching around
  const maxYaw = opts.maxYaw ?? 0.9;
  const yawC = THREE.MathUtils.clamp(yaw, -maxYaw, maxYaw);
  const pitchC = THREE.MathUtils.clamp(pitch, -(opts.maxPitch ?? 0.42), opts.maxPitch ?? 0.42);

  const st = lookState.get(head.uuid) ?? { yaw: 0, pitch: 0 };
  const dt = opts.dt ?? 1 / 60;
  const rate = 5.5; // rad/s — quick but never a snap
  const blend = 1 - Math.exp(-rate * dt);
  st.yaw += (yawC - st.yaw) * blend;
  st.pitch += (pitchC - st.pitch) * blend;
  // kill residual jitter
  if (Math.abs(st.yaw) < 0.003) st.yaw = 0;
  if (Math.abs(st.pitch) < 0.003) st.pitch = 0;
  lookState.set(head.uuid, st);

  const ratio = opts.eyeHeadRatio ?? 0.65;
  head.rotation.y += st.yaw * ratio * weight;
  head.rotation.x += st.pitch * ratio * weight;
  if (neck) {
    neck.rotation.y += st.yaw * (1 - ratio) * weight;
    neck.rotation.x += st.pitch * (1 - ratio) * weight;
  }
}

/** debug: read smoothed state */
export function lookAtState(head: THREE.Bone): { yaw: number; pitch: number } | null {
  return lookState.get(head.uuid) ?? null;
}

/** decay look-at state back to neutral when not tracking */
export function relaxLookAt(head: THREE.Bone, dt: number): void {
  const st = lookState.get(head.uuid);
  if (!st) return;
  const blend = 1 - Math.exp(-3.5 * dt);
  st.yaw -= st.yaw * blend;
  st.pitch -= st.pitch * blend;
}
