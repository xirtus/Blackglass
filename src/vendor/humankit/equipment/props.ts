import * as THREE from 'three';

/** Generic prop builders. Props attach to sockets, never hardcoded into characters. */

export function makeCricketBat(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'cricket_bat';
  const wood = new THREE.MeshStandardMaterial({ color: 0xd9b877, roughness: 0.4 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.9 });
  const sticker = new THREE.MeshStandardMaterial({ color: 0x2255aa, roughness: 0.5 });
  // blade: 0.56 long, flat
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.56, 0.032), wood);
  blade.position.y = -0.36;
  blade.castShadow = true;
  g.add(blade);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.5, 0.012), sticker);
  edge.position.set(0, -0.38, -0.02);
  g.add(edge);
  // handle
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.014, 0.30, 10), grip);
  handle.position.y = 0.05;
  handle.castShadow = true;
  g.add(handle);
  return g;
}

export function makeHelmet(color: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'helmet';
  const shell = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1 });
  // deep shell covering crown, temples and back of skull (ear coverage like real batting helmets)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.107, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.74), shell);
  dome.scale.set(1, 1.02, 1.1);
  dome.castShadow = true;
  g.add(dome);
  // peak over the eyes
  const peak = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.012, 0.07), shell);
  peak.position.set(0, -0.005, 0.108);
  g.add(peak);
  // slim face grill: brow→nose, two bars
  const grillMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.4, metalness: 0.6 });
  const grill = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.042, 0.01), grillMat);
  grill.position.set(0, -0.038, 0.1);
  g.add(grill);
  for (let i = 0; i < 3; i++) {
    const barH = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.006, 0.014), grillMat);
    barH.position.set(0, -0.02 - i * 0.016, 0.104);
    g.add(barH);
  }
  return g;
}

export function makeCap(color: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'cap';
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  // full crown coverage, sitting properly on the skull
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.101, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), mat);
  top.scale.set(1, 0.92, 1.06);
  top.castShadow = true;
  g.add(top);
  // band above the ears
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.1005, 0.1005, 0.028, 16, 1, true), mat);
  band.position.y = -0.004;
  g.add(band);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.011, 0.08), mat);
  brim.position.set(0, -0.014, 0.105);
  g.add(brim);
  return g;
}

export function makePads(): { left: THREE.Group; right: THREE.Group } {
  const mk = () => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.7 });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.32, 0.055), mat);
    pad.castShadow = true;
    g.add(pad);
    for (let i = 0; i < 3; i++) {
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.095, 8), mat);
      roll.rotation.z = Math.PI / 2;
      roll.position.set(0, 0.09 - i * 0.09, 0.034);
      g.add(roll);
    }
    return g;
  };
  return { left: mk(), right: mk() };
}

export function makeGloves(): { left: THREE.Group; right: THREE.Group } {
  const mk = () => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.75 });
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.075, 0.028), mat);
    g.add(palm);
    const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.06, 0.026), mat);
    fingers.position.y = -0.062;
    g.add(fingers);
    return g;
  };
  return { left: mk(), right: mk() };
}
