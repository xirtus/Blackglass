/**
 * Deterministic PRNG toolkit.
 *
 * Contract from the plan (14-performance-qa / 04-simulation):
 *  - Scenario seed + command log + versioned rules reproduce a run.
 *  - Named RNG streams per subsystem, so adding a cosmetic draw never
 *    reshuffles social graphs, leak outcomes or AI decisions.
 */
export type Rng = () => number // uniform in [0, 1)

/** 32-bit FNV-1a string hash. */
export function hashString(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Mulberry32 — small, fast, decent quality. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** xorshift32 — alternate stream for variety where quality matters less. */
export function xorshift32(seed: number): Rng {
  let x = (seed >>> 0) || 0x9e3779b9
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    x >>>= 0
    return x / 4294967296
  }
}

/** splitmix32 — good for deriving sub-seeds. */
export function splitmix32(seed: number): Rng {
  let x = seed >>> 0
  return () => {
    x = (x + 0x9e3779b9) >>> 0
    let z = x
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad)
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97)
    return ((z ^ (z >>> 15)) >>> 0) / 4294967296
  }
}

/** Convenience factory: a stateful RNG with helper draws and forking. */
export class RngFactory {
  readonly seed: number
  private i = 0
  private readonly rng: Rng

  constructor(seed: number, private readonly algorithm: 'mulberry32' | 'xorshift32' | 'splitmix32' = 'mulberry32') {
    this.seed = seed >>> 0
    this.rng = algorithm === 'xorshift32' ? xorshift32(this.seed) : algorithm === 'splitmix32' ? splitmix32(this.seed) : mulberry32(this.seed)
  }

  /** Raw draw in [0,1). */
  next(): number {
    this.i++
    return this.rng()
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  /** Float in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p
  }

  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('RngFactory.pick: empty array')
    return items[Math.floor(this.next() * items.length)]
  }

  /** Weighted pick; weights must be non-negative and sum > 0. */
  pickWeighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((s, [, w]) => s + Math.max(0, w), 0)
    if (total <= 0) throw new Error('RngFactory.pickWeighted: non-positive total weight')
    let r = this.next() * total
    for (const [item, w] of items) {
      r -= Math.max(0, w)
      if (r <= 0) return item
    }
    return items[items.length - 1][0]
  }

  /** In-place Fisher–Yates shuffle (mutates a copy). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }

  /** Independent child stream (cosmetic draws here never affect the parent). */
  fork(label: string): RngFactory {
    return new RngFactory(hashString(`${this.seed}:${this.i}:${label}`), this.algorithm)
  }

  /** Serializable state so mid-run saves can restore stream positions. */
  exportState(): { seed: number; i: number } {
    return { seed: this.seed, i: this.i }
  }
}

/**
 * Named stream registry — the determinism contract's workhorse.
 * `streams.stream('life.identity')` always returns the same independent
 * sequence for a given master seed, regardless of how many other streams
 * were created or how much they consumed.
 */
export class RngStreams {
  private readonly cache = new Map<string, RngFactory>()
  constructor(private readonly masterSeed: number) {}

  get seed(): number {
    return this.masterSeed >>> 0
  }

  stream(name: string): RngFactory {
    let s = this.cache.get(name)
    if (!s) {
      s = new RngFactory(hashString(`${this.masterSeed}:${name}`))
      this.cache.set(name, s)
    }
    return s
  }

  exportState(): Record<string, { seed: number; i: number }> {
    const out: Record<string, { seed: number; i: number }> = {}
    for (const [name, s] of this.cache) out[name] = s.exportState()
    return out
  }

  restoreState(state: Record<string, { seed: number; i: number }>): void {
    for (const [name, st] of Object.entries(state)) {
      // Re-create the stream at the recorded position by advancing it.
      const replayed = new RngFactory(st.seed)
      for (let k = 0; k < st.i; k++) replayed.next()
      this.cache.set(name, replayed)
    }
  }
}
