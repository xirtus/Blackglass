import { describe, expect, it } from 'vitest'
import { makeCommand, type Command } from '@/core/commands'
import { GameEngine } from './engine'
import { manifest } from '@/data/scenarios'

function makeEngine(faction: 'BLACKGLASS' | 'HYDRA' = 'BLACKGLASS'): GameEngine {
  return GameEngine.create(manifest, { perspective: faction, humanFaction: faction, difficulty: 'operator' })
}

describe('game engine end-to-end', () => {
  it('boots a scenario with a carrier holding the original archive', () => {
    const e = makeEngine()
    expect(e.state.entities.people.size).toBe(manifest.population.explicit)
    const original = e.state.entities.copies.get('copy_original')
    expect(original).toBeDefined()
    expect(original!.parentId).toBeNull()
    expect(e.state.hydra.activeHolderId).toBe(original!.holderId)
    expect(e.log.all().some((ev) => ev.type === 'ALERT')).toBe(true)
  })

  it('ingests deterministic OSINT signals from enabled offline adapters', () => {
    const e = makeEngine()
    expect(e.state.osint.sources.length).toBeGreaterThan(0)
    expect(e.state.osint.sources.some((s) => s.mode === 'blocked' && s.enabled)).toBe(false)
    for (let i = 0; i < 800; i++) e.step()
    expect(e.state.osint.signals.length).toBeGreaterThan(0)
    expect(e.state.osint.signals.some((s) => s.sourceKind === 'publicCamera')).toBe(true)
    expect(e.state.entities.observations.all().some((o) => o.sourceName.startsWith('OPEN-CAM-'))).toBe(true)
  })

  it('runs both bounded controllers in spectator mode', () => {
    const e = GameEngine.create(manifest, { perspective: 'BLACKGLASS', humanFaction: 'SPECTATOR', difficulty: 'director' })
    for (let i = 0; i < 4000; i++) e.step()
    const factions = new Set(e.commandLog.filter((c) => c.controller === 'ai').map((c) => c.faction))
    expect(factions.has('BLACKGLASS')).toBe(true)
    expect(factions.has('HYDRA')).toBe(true)
  })

  it('is fully deterministic: seed + commands reproduce the run', () => {
    const probe = makeEngine()
    const carrier = probe.state.entities.people.all().find((p) => p.roleTags.includes('carrier_a'))!
    const circle = probe.state.watchCircles[0]
    const cmds: Command[] = [
      makeCommand(5, 'human', 'BLACKGLASS', { kind: 'bg.watchCircle', circleId: circle.id, level: 0.6 }),
      makeCommand(30, 'human', 'BLACKGLASS', { kind: 'bg.intervene', interventionId: 'surveillance_team', targetIds: [carrier.id] }),
      makeCommand(120, 'human', 'BLACKGLASS', { kind: 'bg.hypothesize', subjectId: carrier.id, relation: 'carrier', note: 'test' }),
    ]
    const a = GameEngine.replay(manifest, { perspective: 'BLACKGLASS', humanFaction: 'BLACKGLASS', difficulty: 'operator' }, cmds, 600)
    const b = GameEngine.replay(manifest, { perspective: 'BLACKGLASS', humanFaction: 'BLACKGLASS', difficulty: 'operator' }, cmds, 600)
    expect(a.fingerprint()).toBe(b.fingerprint())
    expect(a.state.entities.copies.size).toBe(b.state.entities.copies.size)
    expect(a.state.entities.observations.size).toBe(b.state.entities.observations.size)
  })

  it('command log + sim time drive the save/load round trip', () => {
    const e = makeEngine('HYDRA')
    e.issueCommand(makeCommand(e.state.simTime, 'human', 'HYDRA', { kind: 'hydra.contact', personId: e.state.entities.people.all()[1].id }))
    for (let i = 0; i < 300; i++) e.step()

    const json = e.toSaveJson()
    const loaded = GameEngine.fromSaveJson(json, manifest, { perspective: 'HYDRA', humanFaction: 'HYDRA', difficulty: 'operator' })
    expect(loaded.state.simTime).toBe(e.state.simTime)
    expect(loaded.fingerprint()).toBe(e.fingerprint())
    expect(loaded.commandLog).toEqual(e.commandLog)
  })

  it('validates and rejects illegal commands (wrong faction, unknown, unaffordable)', () => {
    const e = makeEngine()
    // Wrong faction for a HYDRA command.
    expect(e.issueCommand(makeCommand(1, 'human', 'BLACKGLASS', { kind: 'hydra.contact', personId: 'p_x' })).ok).toBe(false)
    // Unknown intervention.
    expect(e.issueCommand(makeCommand(1, 'human', 'BLACKGLASS', { kind: 'bg.intervene', interventionId: 'nope', targetIds: ['x'] })).ok).toBe(false)
    // Unaffordable: drain budget.
    e.state.resources.BLACKGLASS.budget = 0
    expect(e.issueCommand(makeCommand(1, 'human', 'BLACKGLASS', { kind: 'bg.intervene', interventionId: 'detention', targetIds: ['x'] })).ok).toBe(false)
    // Past timestamp.
    expect(e.issueCommand(makeCommand(-5, 'human', 'BLACKGLASS', { kind: 'bg.pin', subjectId: 'x' })).ok).toBe(false)
  })

  it('handoff creates descendant copies with valid genealogy', () => {
    const e = makeEngine('BLACKGLASS')
    for (let i = 0; i < 4000; i++) e.step()
    const copies = e.state.entities.copies.all()
    for (const c of copies) {
      if (c.parentId !== null) {
        const parent = e.state.entities.copies.get(c.parentId)
        expect(parent).toBeDefined() // no orphans
        expect(c.createdAt).toBeGreaterThanOrEqual(parent!.createdAt) // parent precedes child
        expect(parent!.descendants).toContain(c.id)
      }
      expect(c.bytes).toBeGreaterThan(0)
    }
  })

  it('confidence decay keeps values in [0,1]', () => {
    const e = makeEngine()
    for (let i = 0; i < 2000; i++) e.step()
    for (const p of e.state.entities.people.all()) {
      expect(p.confidence).toBeGreaterThanOrEqual(0)
      expect(p.confidence).toBeLessThanOrEqual(1)
    }
    for (const o of e.state.entities.observations.all()) {
      expect(o.confidence).toBeGreaterThanOrEqual(0)
      expect(o.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('resources never go negative', () => {
    const e = makeEngine()
    for (let i = 0; i < 4000; i++) e.step()
    for (const res of Object.values(e.state.resources)) {
      for (const v of Object.values(res)) expect(v).toBeGreaterThanOrEqual(0)
    }
  })

  it('intervention lifecycle: authorize → activate → resolve', () => {
    const e = makeEngine()
    const target = e.state.entities.people.all().find((p) => p.roleTags.includes('carrier_a'))!
    const before = e.state.resources.BLACKGLASS.authority
    const res = e.issueCommand(
      makeCommand(e.state.simTime, 'human', 'BLACKGLASS', { kind: 'bg.intervene', interventionId: 'account_hold', targetIds: [target.id] }),
    )
    expect(res.ok).toBe(true)
    // Costs apply when the command is consumed at its simTime.
    e.step()
    expect(e.state.resources.BLACKGLASS.authority).toBeLessThan(before)
    // Advance past activation delay + effect window + cooldown.
    let guard = 0
    while (e.state.entities.interventions.size > 0 && guard < 40000) {
      e.step()
      guard++
    }
    expect(e.state.entities.interventions.size).toBe(0)
    expect(e.log.all().some((ev) => ev.type === 'INTERVENTION_STARTED')).toBe(true)
    expect(e.log.all().some((ev) => ev.type === 'INTERVENTION_RESOLVED')).toBe(true)
  })

  it('end states fire within the scenario window', () => {
    const e = makeEngine()
    let guard = 0
    while (!e.state.endState && guard < 200000) {
      e.step()
      guard++
    }
    expect(e.state.endState).not.toBeNull()
    expect(e.log.all().some((ev) => ev.type === 'END_STATE')).toBe(true)
  })

  it('speed and pause affect step counts but never truth', () => {
    const a = makeEngine()
    const b = makeEngine()
    a.clock.speed = 5
    b.clock.speed = 1
    const stepsA = a.advance(1.0)
    const stepsB = b.advance(1.0)
    expect(stepsA).toBeGreaterThan(stepsB)
    a.clock.paused = true
    expect(a.advance(1.0)).toBe(0)
  })
})
