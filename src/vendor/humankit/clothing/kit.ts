import * as THREE from 'three';
import { fabricMaterial } from '../body/materials';

/** Universal team kit: one definition recolors an entire team. */
export interface TeamKit {
  primary: number | string;
  secondary: number | string;
  accent: number | string;
  number?: number;
  surname?: string;
  logoText?: string;      // short chest mark (e.g. "ENG")
  fabricRoughness?: number;
}

export interface KitMaterials {
  shirt: THREE.MeshStandardMaterial;
  trousers: THREE.MeshStandardMaterial;
  shoes: THREE.MeshStandardMaterial;
  cap: THREE.MeshStandardMaterial;
  apply(kit: TeamKit): void;
}

/** Shirt texture: base colour + trim + optional back number/surname + chest mark. */
export function shirtTexture(kit: TeamKit): THREE.CanvasTexture {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const css = (c: number | string) => typeof c === 'string' ? c : `#${c.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = css(kit.primary);
  ctx.fillRect(0, 0, S, S);
  // side panels (u near 0.25/0.75) + collar band (v near 1)
  ctx.fillStyle = css(kit.secondary);
  ctx.fillRect(0, 0, S * 0.10, S);
  ctx.fillRect(S * 0.90, 0, S * 0.10, S);
  ctx.fillRect(S * 0.25 - S * 0.04, 0, S * 0.08, S);
  ctx.fillRect(S * 0.75 - S * 0.04, 0, S * 0.08, S);
  ctx.fillStyle = css(kit.accent);
  ctx.fillRect(0, 0, S, S * 0.045);           // collar band (v=1 top of texture)
  ctx.fillRect(0, S * 0.972, S, S * 0.028);   // hem
  // chest mark (front center = u 0)
  if (kit.logoText) {
    ctx.fillStyle = css(kit.accent);
    ctx.font = `bold ${S * 0.07}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(kit.logoText, S * 0.98, S * 0.62); // near u=0 front-left chest
  }
  // back number + surname (back center = u 0.5). The u-axis direction means
  // normally-painted text reads correctly when viewed from behind.
  if (kit.number !== undefined) {
    ctx.fillStyle = css(kit.accent);
    ctx.font = `bold ${S * 0.24}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(kit.number), S * 0.5, S * 0.50);
  }
  if (kit.surname) {
    ctx.fillStyle = css(kit.accent);
    ctx.font = `bold ${S * 0.065}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(kit.surname.toUpperCase(), S * 0.5, S * 0.27);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createKitMaterials(kit: TeamKit): KitMaterials {
  const shirt = fabricMaterial(0xffffff, { roughness: kit.fabricRoughness ?? 0.82 });
  shirt.map = shirtTexture(kit);
  const trousers = fabricMaterial(new THREE.Color(kit.secondary as never).getHex(), { roughness: 0.85 });
  const shoes = fabricMaterial(0xf2f2f2, { roughness: 0.5 });
  const cap = fabricMaterial(new THREE.Color(kit.primary as never).getHex(), { roughness: 0.7 });
  return {
    shirt, trousers, shoes, cap,
    apply(k: TeamKit) {
      shirt.map?.dispose();
      shirt.map = shirtTexture(k);
      shirt.needsUpdate = true;
      trousers.color.set(k.secondary as never);
      cap.color.set(k.primary as never);
    },
  };
}
