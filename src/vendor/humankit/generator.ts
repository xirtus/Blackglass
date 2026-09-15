import { Human, type QualityTier } from './human';
import { dnaFromSeed, athleteDNA, type HumanDNA, type Sex, type Build } from './body/profiles';
import type { TeamKit } from './clothing/kit';

export interface CreateHumanOptions {
  seed: number;
  sex?: Sex;
  age?: number;
  height?: number;
  build?: Build;
  skinTone?: number;
  hair?: HumanDNA['hairStyle'];
  beard?: HumanDNA['beardStyle'];
  tier?: QualityTier;
  kit?: TeamKit;
  sleeve?: 'none' | 'short' | 'long';
  trouserLength?: 'shorts' | 'long';
}

/** Deterministic character generation: same seed + options = same human, always. */
export function createHuman(opts: CreateHumanOptions): Human {
  const dna = dnaFromSeed(opts.seed);
  if (opts.sex) dna.sex = opts.sex;
  if (opts.age !== undefined) dna.face.age = opts.age;
  if (opts.height !== undefined) dna.body.height = opts.height;
  if (opts.build) dna.body.build = opts.build;
  if (opts.skinTone !== undefined) dna.skinTone = opts.skinTone;
  if (opts.hair) dna.hairStyle = opts.hair;
  if (opts.beard) dna.beardStyle = opts.beard;
  const h = new Human({ dna, tier: opts.tier ?? 'gameplay', sleeve: opts.sleeve, trouserLength: opts.trouserLength });
  if (opts.kit) h.setTeamKit(opts.kit);
  return h;
}

/** Distinct-looking athlete sharing uniform/rig with the squad. */
export function createAthlete(seed: number, opts: { tier?: QualityTier; kit?: TeamKit; height?: number; sleeve?: 'none' | 'short' | 'long'; trouserLength?: 'shorts' | 'long' } = {}): Human {
  const dna = athleteDNA(seed);
  if (opts.height) dna.body.height = opts.height;
  const h = new Human({ dna, tier: opts.tier ?? 'gameplay', sleeve: opts.sleeve, trouserLength: opts.trouserLength });
  if (opts.kit) h.setTeamKit(opts.kit);
  return h;
}

/** Starter presets for rapid game prototyping. */
export const PRESETS = {
  athlete: (seed: number, kit?: TeamKit) => createAthlete(seed, { kit }),
  civilian: (seed: number) => createHuman({ seed }),
  soldier: (seed: number) => createHuman({ seed, build: 'muscular', kit: { primary: 0x4a5230, secondary: 0x3a4128, accent: 0x22271a } }),
  worker: (seed: number) => createHuman({ seed, kit: { primary: 0xd06a1f, secondary: 0x2a3a55, accent: 0xf0f0f0 } }),
  formal: (seed: number) => createHuman({ seed, kit: { primary: 0x1c1e26, secondary: 0x1c1e26, accent: 0xd8d8d8, fabricRoughness: 0.6 } }),
  casual: (seed: number) => createHuman({ seed, kit: { primary: 0x7a8a9a, secondary: 0x2a3a55, accent: 0xe0e0e0 } }),
};
