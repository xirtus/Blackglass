import { describe, expect, it } from 'vitest'
import { hashString, mulberry32, RngFactory, RngStreams } from './rng'

describe('deterministic RNG toolkit', () => {
  it('same seed → identical sequence', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 100; i++) expect(a()).toBe(b())
  })

  it('different seeds diverge', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    expect(a()).not.toBe(b())
  })

  it('hashString is stable and 32-bit', () => {
    expect(hashString('blackglass')).toBe(hashString('blackglass'))
    expect(hashString('blackglass')).not.toBe(hashString('hydra'))
    expect(hashString('x')).toBeLessThanOrEqual(0xffffffff)
    expect(hashString('x')).toBeGreaterThanOrEqual(0)
  })

  it('helpers stay in range', () => {
    const r = new RngFactory(7)
    for (let i = 0; i < 500; i++) {
      const v = r.int(3, 9)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(9)
      const f = r.float(-2, 5)
      expect(f).toBeGreaterThanOrEqual(-2)
      expect(f).toBeLessThan(5)
      expect(r.chance(1)).toBe(true)
      expect(r.chance(0)).toBe(false)
    }
    expect(r.pick([1])).toBe(1)
    expect(r.pickWeighted([['only', 1]])).toBe('only')
    expect(() => r.pick([])).toThrow()
    expect(() => r.pickWeighted([['a', 0]])).toThrow()
  })

  it('shuffle preserves membership', () => {
    const r = new RngFactory(11)
    const src = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = r.shuffle(src)
    expect(out).toHaveLength(src.length)
    expect([...out].sort()).toEqual([...src].sort())
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]) // input untouched
  })

  it('named streams are isolated: cosmetic draws never reshuffle others', () => {
    const a = new RngStreams(999)
    const sim = a.stream('sim.handoff')
    const firstFive = Array.from({ length: 5 }, () => sim.next())

    // A cosmetic stream consumes heavily…
    const b = new RngStreams(999)
    const cosmetic = b.stream('fx.particles')
    for (let i = 0; i < 10_000; i++) cosmetic.next()
    const simB = b.stream('sim.handoff')
    expect(Array.from({ length: 5 }, () => simB.next())).toEqual(firstFive)
  })

  it('stream state round-trips through export/restore', () => {
    const s = new RngStreams(5)
    const r = s.stream('sim.handoff')
    for (let i = 0; i < 37; i++) r.next()
    const exported = s.exportState() // capture BEFORE the expected draws
    const expected = Array.from({ length: 5 }, () => r.next())

    const restored = new RngStreams(5)
    restored.restoreState(exported)
    const r2 = restored.stream('sim.handoff')
    expect(Array.from({ length: 5 }, () => r2.next())).toEqual(expected)
  })
})
