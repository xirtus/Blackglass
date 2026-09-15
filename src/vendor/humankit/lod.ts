import * as THREE from 'three';
import type { QualityTier } from './human';

/**
 * Screen-size-based quality selection: humans switch tier by how many pixels
 * they occupy, not raw distance (works for any camera FOV).
 */
export function tierForScreenSize(
  worldPos: THREE.Vector3, camera: THREE.PerspectiveCamera, viewportHeightPx: number, characterHeight = 1.8,
): QualityTier {
  const d = camera.position.distanceTo(worldPos);
  const focalPx = viewportHeightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  const px = (characterHeight / Math.max(d, 0.01)) * focalPx;
  if (px > 420) return 'hero';
  if (px > 140) return 'gameplay';
  if (px > 45) return 'distant';
  return 'crowd';
}
