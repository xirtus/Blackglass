import { describe, expect, it } from 'vitest'
import { RngStreams } from '@/core/rng'
import { generateScenarioLives, locationsFromManifest } from './life'
import { manifest } from '@/data/scenarios'

describe('scenario life generator', () => {
  const locations = locationsFromManifest(manifest)

  it('is deterministic for a given seed', () => {
    const a = generateScenarioLives(new RngStreams(184203), manifest, locations)
    const b = generateScenarioLives(new RngStreams(184203), manifest, locations)
    expect(a.people.map((p) => [p.name, p.occupation, p.pos])).toEqual(b.people.map((p) => [p.name, p.occupation, p.pos]))
    expect(a.edges.map((e) => [e.a, e.b, e.trust])).toEqual(b.edges.map((e) => [e.a, e.b, e.trust]))
  })

  it('generates the requested population with coherent anchors', () => {
    const lives = generateScenarioLives(new RngStreams(184203), manifest, locations)
    expect(lives.people).toHaveLength(manifest.population.explicit)
    for (const p of lives.people) {
      expect(locations.some((l) => l.id === p.homeId)).toBe(true)
      expect(locations.some((l) => l.id === p.workId)).toBe(true)
      expect(p.name.trim().length).toBeGreaterThan(3)
      expect(p.schedule.workStartHour).toBeLessThan(p.schedule.workEndHour)
      expect(p.traits.caution).toBeGreaterThanOrEqual(0)
      expect(p.traits.caution).toBeLessThanOrEqual(1)
      expect(p.devices.length).toBeGreaterThan(0)
      for (const d of p.devices) {
        const device = lives.devices.find((x) => x.id === d)
        expect(device).toBeDefined()
        expect(device!.ownerCandidates.some((o) => o.personId === p.id)).toBe(true)
      }
    }
  })

  it('assigns hero actors their authored roles', () => {
    const lives = generateScenarioLives(new RngStreams(184203), manifest, locations)
    const carrier = lives.people.find((p) => p.roleTags.includes('carrier_a'))
    expect(carrier).toBeDefined()
    expect(carrier!.traits.intent).toBe('deliberate')
    const journalist = lives.people.find((p) => p.roleTags.includes('journalist_b'))
    expect(journalist).toBeDefined()
    expect(journalist!.traits.intent).toBe('publisher')
  })

  it('social edges connect existing people with valid weights', () => {
    const lives = generateScenarioLives(new RngStreams(184203), manifest, locations)
    const ids = new Set(lives.people.map((p) => p.id))
    for (const e of lives.edges) {
      expect(ids.has(e.a)).toBe(true)
      expect(ids.has(e.b)).toBe(true)
      expect(e.a).not.toBe(e.b)
      expect(e.trust).toBeGreaterThanOrEqual(0)
      expect(e.trust).toBeLessThanOrEqual(1)
    }
  })

  it('baselines exist for every person', () => {
    const lives = generateScenarioLives(new RngStreams(184203), manifest, locations)
    for (const p of lives.people) {
      expect(lives.baselines[p.id]).toBeDefined()
      expect(lives.baselines[p.id].historyDepth).toBe(48)
    }
  })
})
