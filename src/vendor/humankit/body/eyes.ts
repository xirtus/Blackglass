import * as THREE from 'three';
import { eyeMaterial } from './materials';

export interface Eyes {
  group: THREE.Group;          // parented to head bone
  eyeL: THREE.Mesh;
  eyeR: THREE.Mesh;
  /** rotate eyeballs toward a head-local direction */
  look(dirL: THREE.Vector3): void;
}

/**
 * Eyeballs with painted iris + glossy clear-coat cornea bulge.
 * Good eyes are the single biggest anti-uncanny feature: separate geometry,
 * real specular highlights, subtle wetness, and independent micro-movement.
 */
export function buildEyes(eyeLPos: THREE.Vector3, eyeRPos: THREE.Vector3, headJointY: number, color: number, seed: number, radius: number): Eyes {
  const group = new THREE.Group();
  group.name = 'eyes';
  const r = radius;
  const matL = eyeMaterial(color, seed);
  const matR = eyeMaterial(color, seed + 1);

  const mkEye = (pos: THREE.Vector3, mat: THREE.Material): THREE.Mesh => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat);
    // orient so texture "front" (center of canvas) faces +Z
    eye.rotation.y = -Math.PI / 2;
    eye.position.copy(pos).sub(new THREE.Vector3(0, headJointY, 0));
    // cornea bulge: transparent glossy shell
    const cornea = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.06, 18, 14),
      new THREE.MeshPhysicalMaterial({
        transparent: true, opacity: 0.12, roughness: 0.03, metalness: 0,
        clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false,
      }),
    );
    cornea.position.z = r * 0.12;
    eye.add(cornea);
    return eye;
  };

  const eyeL = mkEye(eyeLPos, matL);
  const eyeR = mkEye(eyeRPos, matR);
  // wrap each in a pivot so look() rotates about the eyeball center
  const pivotL = new THREE.Group();
  const pivotR = new THREE.Group();
  pivotL.position.copy(eyeL.position);
  pivotR.position.copy(eyeR.position);
  eyeL.position.set(0, 0, 0);
  eyeR.position.set(0, 0, 0);
  pivotL.add(eyeL);
  pivotR.add(eyeR);
  group.add(pivotL, pivotR);

  return {
    group, eyeL: pivotL as unknown as THREE.Mesh, eyeR: pivotR as unknown as THREE.Mesh,
    look(dir: THREE.Vector3) {
      // clamp + apply small rotation (eyes lead the head)
      const yaw = THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z), -0.6, 0.6);
      const pitch = THREE.MathUtils.clamp(-Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)), -0.4, 0.4);
      pivotL.rotation.set(pitch, yaw, 0, 'YXZ');
      pivotR.rotation.set(pitch, yaw, 0, 'YXZ');
    },
  };
}
