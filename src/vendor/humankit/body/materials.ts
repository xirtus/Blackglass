import * as THREE from 'three';
import { SKIN_TONES } from '../rig/spec';
import { rng } from './profiles';

/** Procedural skin texture: subtle mottling + face-region features (lips/brows painted by head UV convention). */
export function skinTexture(toneIdx: number, seed: number, opts: { face?: boolean; stubble?: number; lipFullness?: number; browColor?: number } = {}): THREE.CanvasTexture {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const base = new THREE.Color(SKIN_TONES[Math.max(0, Math.min(5, toneIdx))]);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, S, S);
  const r = rng(seed);
  // mottling — very subtle
  for (let i = 0; i < 3200; i++) {
    const x = r() * S, y = r() * S, rad = 0.6 + r() * 1.8;
    const v = (r() - 0.5) * 0.055;
    const c = base.clone().offsetHSL((r() - 0.5) * 0.01, 0, v);
    ctx.fillStyle = `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},0.16)`;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
  }
  if (opts.face) {
    // UV convention: u 0.5 = front center, v 0 = chin → 1 = crown.
    // X = u*S ; Y = (1-v)*S. Radii are plain pixel counts (fraction * S).
    const X = (a: number) => a * S, Y = (a: number) => (1 - a) * S;
    const lipF = opts.lipFullness ?? 1;
    // soft under-eye shading
    ctx.fillStyle = 'rgba(70,40,30,0.06)';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(X(0.5 + s * 0.062), Y(0.585), 0.030 * S, 0.014 * S, 0, 0, 7); ctx.fill();
    }
    // eyelid crease lines
    ctx.strokeStyle = 'rgba(60,35,25,0.22)';
    ctx.lineWidth = 1.4;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(X(0.5 + s * 0.062), Y(0.612), 0.026 * S, 0.009 * S, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    }
    // nostril shadows
    ctx.fillStyle = 'rgba(20,10,8,0.30)';
    ctx.beginPath(); ctx.ellipse(X(0.487), Y(0.472), 0.005 * S, 0.0035 * S, 0.3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(X(0.513), Y(0.472), 0.005 * S, 0.0035 * S, -0.3, 0, 7); ctx.fill();
    // philtrum hint
    ctx.fillStyle = 'rgba(80,50,40,0.10)';
    ctx.fillRect(X(0.4975), Y(0.455), 0.005 * S, 0.02 * S);
    // lips
    const lip = base.clone().offsetHSL(-0.01, 0.16, -0.07);
    ctx.fillStyle = `rgba(${(lip.r * 255) | 0},${(lip.g * 255) | 0},${(lip.b * 255) | 0},0.9)`;
    ctx.beginPath(); ctx.ellipse(X(0.5), Y(0.408), 0.038 * S * lipF, 0.011 * S * lipF, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(40,20,15,0.4)';
    ctx.fillRect(X(0.5 - 0.034 * lipF), Y(0.408) - 0.8, 0.068 * S * lipF, 1.6);
    // brows (follow hair color)
    const bc = opts.browColor !== undefined ? new THREE.Color(opts.browColor) : new THREE.Color(0x20160e);
    ctx.fillStyle = `rgba(${(bc.r * 255) | 0},${(bc.g * 255) | 0},${(bc.b * 255) | 0},0.85)`;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(X(0.5 + s * 0.064), Y(0.648));
      ctx.rotate(s * -0.10);
      ctx.beginPath(); ctx.ellipse(0, 0, 0.026 * S, 0.0048 * S, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
    // stubble shadow on jaw
    if (opts.stubble && opts.stubble > 0) {
      ctx.fillStyle = `rgba(30,22,16,${0.22 * opts.stubble})`;
      ctx.beginPath();
      ctx.ellipse(X(0.5), Y(0.30), 0.085 * S, 0.11 * S, 0, 0, 7);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Iris texture for one eye. */
export function irisTexture(color: number, seed: number): THREE.CanvasTexture {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const r = rng(seed);
  const c = new THREE.Color(color);
  ctx.fillStyle = '#f5f2ec'; ctx.fillRect(0, 0, S, S); // sclera
  const cx = S / 2, cy = S / 2;
  // limbal ring
  ctx.fillStyle = `#${c.clone().offsetHSL(0, 0, -0.18).getHexString()}`;
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.155, 0, 7); ctx.fill();
  // iris radial striations
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2;
    const len = S * (0.05 + r() * 0.08);
    const cc = c.clone().offsetHSL((r() - 0.5) * 0.05, (r() - 0.5) * 0.2, (r() - 0.5) * 0.25);
    ctx.strokeStyle = `rgba(${(cc.r * 255) | 0},${(cc.g * 255) | 0},${(cc.b * 255) | 0},0.8)`;
    ctx.lineWidth = 0.8 + r() * 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * S * 0.055, cy + Math.sin(a) * S * 0.055);
    ctx.lineTo(cx + Math.cos(a) * (S * 0.055 + len), cy + Math.sin(a) * (S * 0.055 + len));
    ctx.stroke();
  }
  // pupil
  ctx.fillStyle = '#0a0806';
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.055, 0, 7); ctx.fill();
  // catchlight
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(cx + S * 0.03, cy - S * 0.03, S * 0.014, 0, 7); ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Skin material with a cheap subsurface-scattering approximation:
 * warm fresnel rim + slight backlight translucency injected via onBeforeCompile.
 */
export function skinMaterial(toneIdx: number, seed: number, opts: { face?: boolean; roughness?: number; stubble?: number; lipFullness?: number; browColor?: number } = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map: skinTexture(toneIdx, seed, opts),
    roughness: opts.roughness ?? 0.55,
    metalness: 0.0,
  });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      {
        // Approximate SSS: warm rim where light grazes + thin-region translucency
        vec3 nrm = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float fres = pow(1.0 - abs(dot(nrm, viewDir)), 3.0);
        vec3 sssColor = diffuseColor.rgb * vec3(1.15, 0.55, 0.45);
        totalEmissiveRadiance += sssColor * fres * 0.22;
      }`,
    );
  };
  return m;
}

export function eyeMaterial(color: number, seed: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: irisTexture(color, seed),
    roughness: 0.12,
    metalness: 0.0,
    envMapIntensity: 1.4,
  });
}

/** Fabric with procedural weave bump. Team-tintable. */
export function fabricMaterial(color: number, opts: { roughness?: number; weaveScale?: number } = {}): THREE.MeshStandardMaterial {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, S, S);
  const ws = opts.weaveScale ?? 4;
  for (let y = 0; y < S; y += ws) {
    for (let x = 0; x < S; x += ws) {
      const odd = ((x + y) / ws) % 2 === 0;
      ctx.fillStyle = odd ? '#8a8a8a' : '#767676';
      ctx.fillRect(x, y, ws, ws);
    }
  }
  const bump = new THREE.CanvasTexture(cv);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(6, 6);
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.82,
    metalness: 0,
    bumpMap: bump,
    bumpScale: 0.6,
  });
}

export function hairMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
}
