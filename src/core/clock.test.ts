import { describe, expect, it } from 'vitest'
import { GameClock } from './clock'

describe('fixed-step game clock', () => {
  it('accumulates fixed steps at 1x', () => {
    const c = new GameClock(0)
    expect(c.advance(1.0)).toBe(4) // 1s real at 1x = 4 steps of 0.25s
    c.step()
    expect(c.simTime).toBe(0.25)
  })

  it('scales with speed and respects pause', () => {
    const c = new GameClock(0)
    c.speed = 2
    expect(c.advance(1.0)).toBe(8)
    c.paused = true
    expect(c.advance(5.0)).toBe(0)
    c.paused = false
    c.speed = 5
    expect(c.advance(1.0)).toBe(20)
  })

  it('never yields more than one second of real dt (spiral guard)', () => {
    const c = new GameClock(0)
    c.speed = 5
    expect(c.advance(10.0)).toBeLessThanOrEqual(20)
  })

  it('wall time anchors at scenario start', () => {
    const c = new GameClock(1_700_000_000_000)
    expect(c.wallTime().getTime()).toBe(1_700_000_000_000)
    c.simTime = 60
    expect(c.wallTime().getTime()).toBe(1_700_000_060_000)
  })
})
