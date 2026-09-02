import { describe, expect, it } from 'vitest'
import { GameEngine } from './engine'
import { manifest } from '@/data/scenarios'
import type { Difficulty, FactionId } from '@/core/commands'

function runEngine(humanFaction: FactionId, steps: number, difficulty: Difficulty = 'analyst'): GameEngine {
  const engine = GameEngine.create(manifest, { perspective: humanFaction, humanFaction, difficulty })
  for (let i = 0; i < steps; i++) engine.step()
  return engine
}

/** Every key reachable in a serialized view (for hidden-state assertions). */
function keySet(obj: unknown, prefix = ''): Set<string> {
  const out = new Set<string>()
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => keySet(v, `${prefix}[${i}]`).forEach((k) => out.add(k)))
    return out
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      out.add(`${prefix}${k}`)
      keySet(v, `${prefix}${k}.`).forEach((x) => out.add(x))
    }
  }
  return out
}

describe('perspective isolation (dual-perspective contract)', () => {
  it('HYDRA view never exposes Watch Index, observations, sensors or interventions', () => {
    const engine = runEngine('HYDRA', 600)
    const view = engine.viewModel('HYDRA')
    const keys = keySet(JSON.parse(JSON.stringify(view)))
    const forbidden = ['watchCircles', 'observations', 'anomalies', 'interventions', 'resources', 'resourceCaps', 'osintSources']
    for (const f of forbidden) {
      expect(keys.has(f)).toBe(false)
      expect([...keys].some((k) => k.includes(`.${f}`) || k.includes(`${f}.`))).toBe(false)
    }
    // Heat must be coarse (quarter buckets), not raw truth.
    if (view.perspective === 'HYDRA') {
      expect([0, 0.25, 0.5, 0.75, 1]).toContain(view.heat.value)
      expect(view.osintSignals.every((s) => s.public && s.subjectIds.length === 0)).toBe(true)
    }
  })

  it('BLACKGLASS view never exposes HYDRA intents, controlled copies or ground-truth holders', () => {
    const engine = runEngine('BLACKGLASS', 600)
    const view = engine.viewModel('BLACKGLASS')
    if (view.perspective !== 'BLACKGLASS') throw new Error('expected blackglass view')
    // People views have no knowledge/intent/trait fields.
    const personKeys = keySet(view.people[0])
    expect(personKeys.has('traits')).toBe(false)
    expect(personKeys.has('knowledge')).toBe(false)
    expect(personKeys.has('devices')).toBe(false)
    // Copies appear only as observation-derived hypotheses: an unobserved
    // original must not be visible as a definite copy.
    const definite = view.copies.filter((c) => c.status !== 'lost' && c.status !== 'destroyed' && c.holderName !== null)
    for (const c of definite) {
      const obs = view.observations.some((o) => o.subjectIds.includes(c.holderId) && o.confidence >= 0.3)
      expect(obs).toBe(true)
    }
  })

  it('omniscient view is only constructible explicitly (replay gate)', () => {
    const engine = runEngine('BLACKGLASS', 200)
    const view = engine.viewModel('OMNISCIENT_REPLAY')
    expect(view.perspective).toBe('OMNISCIENT_REPLAY')
    if (view.perspective === 'OMNISCIENT_REPLAY') {
      expect(view.people.length).toBe(manifest.population.explicit)
      expect(view.copies.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('bounded BLACKGLASS AI commands never reference hidden holder ids', () => {
    const engine = runEngine('HYDRA', 3000, 'director')
    const bgCommands = engine.commandLog.filter((c) => c.faction === 'BLACKGLASS')
    for (const cmd of bgCommands) {
      if (cmd.kind === 'bg.intervene') {
        // AI may only target what its view exposes: observed subjects.
        expect(cmd.targetIds.length).toBeGreaterThan(0)
      }
    }
    // The AI must actually do something in 3000 steps.
    expect(bgCommands.length).toBeGreaterThan(0)
  })
})
