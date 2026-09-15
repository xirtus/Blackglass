/** Seeded body/face parameter profiles — the DNA of a generated human. */

export type Build = 'slim' | 'athletic' | 'average' | 'heavy' | 'muscular';
export type Sex = 'male' | 'female';

export interface BodyParams {
  height: number;        // meters, 1.55..2.05
  build: Build;
  shoulderWidth: number; // multiplier 0.9..1.15
  muscle: number;        // 0..1
  fat: number;           // 0..1
  armLength: number;     // multiplier
  legLength: number;     // multiplier
}

export interface FaceParams {
  headWidth: number;   // 0.9..1.1
  jawWidth: number;    // 0.85..1.15
  chinLength: number;  // 0.9..1.1
  noseSize: number;    // 0.8..1.25
  noseBridge: number;  // 0.8..1.2
  browRidge: number;   // 0..1
  cheekbones: number;  // 0..1
  eyeSpacing: number;  // 0.9..1.1
  eyeSize: number;     // 0.9..1.15
  lipFullness: number; // 0.7..1.3
  age: number;         // years, drives skin roughness + hair grey
}

export interface HumanDNA {
  seed: number;
  sex: Sex;
  body: BodyParams;
  face: FaceParams;
  skinTone: number;    // index 0..5 into palette
  skinRoughness: number;
  hairStyle: 'bald' | 'buzz' | 'short' | 'short-curly' | 'fade' | 'side-part' | 'long';
  hairColor: number;
  beardStyle: 'none' | 'stubble' | 'short' | 'full';
  eyeColor: number;
}

/** Small fast deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HAIR_COLORS = [0x14100d, 0x241a12, 0x3d2817, 0x6b4423, 0x8b5a2b, 0xa67c3d, 0xc9a45c, 0x8a8a8a, 0xd8d8d8];
const EYE_COLORS = [0x4a3319, 0x2e1f10, 0x5b4a2f, 0x3f5a3a, 0x3a4a6b, 0x5a7a9a, 0x6b5a45];

export function dnaFromSeed(seed: number, overrides: Partial<HumanDNA> = {}): HumanDNA {
  const r = rng(seed);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
  const range = (a: number, b: number) => a + r() * (b - a);
  const builds: Build[] = ['slim', 'athletic', 'average', 'heavy', 'muscular'];
  const build = pick(builds);
  const age = Math.round(range(19, 42));
  const greyFactor = age > 36 && r() < 0.4;
  const dna: HumanDNA = {
    seed,
    sex: r() < 0.5 ? 'male' : 'female',
    body: {
      height: range(1.62, 1.98),
      build,
      shoulderWidth: range(0.92, 1.12),
      muscle: build === 'muscular' ? range(0.7, 1) : build === 'athletic' ? range(0.45, 0.75) : range(0.1, 0.5),
      fat: build === 'heavy' ? range(0.55, 0.9) : build === 'slim' ? range(0, 0.2) : range(0.15, 0.5),
      armLength: range(0.95, 1.05),
      legLength: range(0.95, 1.06),
    },
    face: {
      headWidth: range(0.92, 1.08),
      jawWidth: range(0.85, 1.15),
      chinLength: range(0.9, 1.12),
      noseSize: range(0.8, 1.25),
      noseBridge: range(0.8, 1.2),
      browRidge: range(0.1, 0.9),
      cheekbones: range(0.1, 0.9),
      eyeSpacing: range(0.92, 1.08),
      eyeSize: range(0.9, 1.12),
      lipFullness: range(0.75, 1.3),
      age,
    },
    skinTone: Math.floor(r() * 6),
    skinRoughness: range(0.45, 0.7),
    hairStyle: pick(['bald', 'buzz', 'short', 'short-curly', 'fade', 'side-part', 'long'] as const),
    hairColor: greyFactor ? pick([0x8a8a8a, 0xd8d8d8]) : pick(HAIR_COLORS),
    beardStyle: pick(['none', 'none', 'stubble', 'short', 'full'] as const),
    eyeColor: pick(EYE_COLORS),
  };
  if (dna.sex === 'female') {
    dna.beardStyle = 'none';
    dna.body.shoulderWidth *= 0.92;
    dna.face.jawWidth *= 0.92;
  }
  return { ...dna, ...overrides };
}

/** Athlete-tuned DNA: constrained variation, always plausible sportspeople. */
export function athleteDNA(seed: number, overrides: Partial<HumanDNA> = {}): HumanDNA {
  const dna = dnaFromSeed(seed);
  const r = rng(seed * 7 + 3);
  dna.body.build = r() < 0.65 ? 'athletic' : r() < 0.8 ? 'muscular' : 'slim';
  dna.body.height = 1.68 + r() * 0.26;
  dna.body.fat = 0.05 + r() * 0.25;
  dna.body.muscle = 0.45 + r() * 0.5;
  dna.face.age = Math.round(19 + r() * 17);
  return { ...dna, ...overrides };
}
