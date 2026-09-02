import { describe, expect, it } from 'vitest'
import { GameEngine } from './engine'
import { manifest } from '@/data/scenarios'
import { computeHydraMetrics } from './metrics'
import { computeReplicationNumber } from './systems'

function engineWithCopies(): GameEngine {
  const e = GameEngine.create(manifest, { perspective: 'BLACKGLASS', humanFaction: 'BLACKGLASS', difficulty: 'operator' })
  for (let i = 0; i < 3000; i++) e.step()
  return e
}

describe('hydra math and scoring', () => {
  it('metrics stay in valid ranges', () => {
    const e = engineWithCopies()
    const m = computeHydraMetrics(e.state)
    expect(m.knownCopies).toBeGreaterThanOrEqual(0)
    expect(m.estimatedCopies).toBeGreaterThanOrEqual(m.knownCopies)
    expect(m.copyConfidence).toBeGreaterThanOrEqual(0)
    expect(m.copyConfidence).toBeLessThanOrEqual(1)
    expect(m.exposure).toBeGreaterThanOrEqual(0)
    expect(m.exposure).toBeLessThanOrEqual(1)
    expect(m.credibility).toBeGreaterThanOrEqual(0)
    expect(m.credibility).toBeLessThanOrEqual(1)
    expect(m.replicationNumberH).toBeGreaterThanOrEqual(0)
    expect(m.containmentProbability).toBeGreaterThanOrEqual(0)
    expect(m.containmentProbability).toBeLessThanOrEqual(1)
  })

  it('H = 0 when no copies exist', () => {
    const e = engineWithCopies()
    for (const c of e.state.entities.copies.all()) c.status = 'destroyed'
    expect(computeReplicationNumber(e.state)).toBe(0)
  })

  it('scores are bounded and graded', () => {
    const e = engineWithCopies()
    const bg = e.blackglassScore()
    const h = e.hydraScore()
    for (const s of [bg, h]) {
      expect(s.total).toBeGreaterThanOrEqual(0)
      expect(s.total).toBeLessThanOrEqual(1)
      expect(['S', 'A', 'B', 'C', 'D']).toContain(s.grade)
      expect(s.summary.length).toBeGreaterThan(10)
    }
  })

  it('Streisand: visible interventions raise public suspicion', () => {
    const e = engineWithCopies()
    const before = e.state.public.suspicion
    const target = e.state.entities.locations.get('bld_archive')!
    const res = e.issueCommand(makeIntervene(e, 'grid_blackout', target.id))
    expect(res.ok).toBe(true)
    let guard = 0
    while (guard < 600 && !e.log.all().some((ev) => ev.type === 'INTERVENTION_STARTED')) {
      e.step()
      guard++
    }
    expect(e.state.public.suspicion).toBeGreaterThan(before)
  })
})

import { makeCommand } from '@/core/commands'
function makeIntervene(e: GameEngine, id: string, targetId: string) {
  return makeCommand(e.state.simTime, 'human', 'BLACKGLASS', { kind: 'bg.intervene', interventionId: id, targetIds: [targetId] })
}
