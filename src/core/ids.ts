import { hashString, RngFactory } from './rng'

let uiCounter = 0

/** Non-deterministic id for session/UI objects (never used inside the sim). */
export function uid(prefix: string): string {
  uiCounter++
  return `${prefix}_${Date.now().toString(36)}_${uiCounter.toString(36)}`
}

/** Deterministic id generator for simulation entities (seeded per run). */
export class IdGen {
  private counts = new Map<string, number>()
  constructor(private readonly prefix: string, private readonly rng: RngFactory) {}

  next(tag: string): string {
    const n = (this.counts.get(tag) ?? Math.floor(this.rng.next() * 4096)) + 1
    this.counts.set(tag, n)
    return `${this.prefix}_${tag}_${n.toString(36)}`
  }

  static stableId(prefix: string, name: string): string {
    return `${prefix}_${hashString(name).toString(36)}`
  }
}
