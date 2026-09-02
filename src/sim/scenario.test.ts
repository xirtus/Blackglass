import { describe, expect, it } from 'vitest'
import { findRoute, validateScenario } from './scenario'
import { manifest, manifests } from '@/data/scenarios'
import { interventionCatalog, getIntervention } from './interventionCatalog'

describe('scenario manifest validation', () => {
  it('shipped manifests pass validation', () => {
    for (const m of manifests) expect(validateScenario(m)).toEqual([])
  })

  it('catches broken road references and missing fields', () => {
    const broken = structuredClone(manifest) as typeof manifest
    broken.graph.roads[0].nodes.push('n_missing')
    expect(validateScenario(broken).join()).toContain('unknown node')

    const broken2 = structuredClone(manifest) as typeof manifest
    broken2.population.explicit = 0
    expect(validateScenario(broken2).join()).toContain('explicit')

    const broken3 = structuredClone(manifest) as typeof manifest
    broken3.interventionIds = []
    expect(validateScenario(broken3).join()).toContain('intervention')
  })

  it('all referenced interventions exist in the catalog', () => {
    for (const id of manifest.interventionIds) {
      expect(getIntervention(id)).toBeDefined()
    }
  })

  it('declares real-tool OSINT sources without enabling blocked camera directories', () => {
    expect(manifest.osintSources?.map((s) => s.kind)).toEqual(
      expect.arrayContaining(['worldMonitor', 'caseGraph', 'radioSpectrum', 'publicCamera']),
    )
    const blocked = manifest.osintSources?.find((s) => s.id === 'insecam_public_directory')
    expect(blocked).toBeDefined()
    expect(blocked?.mode).toBe('blocked')
    expect(blocked?.enabled).toBe(false)
  })

  it('route search finds paths on the grid and rejects impossible ones', () => {
    const route = findRoute(manifest.graph.nodes, manifest.graph.roads, 'n0', 'n19')
    expect(route).not.toBeNull()
    expect(route![0]).toBe('n0')
    expect(route![route!.length - 1]).toBe('n19')

    // Unconnected node id → null
    expect(findRoute(manifest.graph.nodes, manifest.graph.roads, 'n0', 'n_void')).toBeNull()
  })

  it('catalog interventions are well-formed (costs, ranges, categories)', () => {
    expect(interventionCatalog.length).toBeGreaterThanOrEqual(8)
    const categories = new Set(interventionCatalog.map((d) => d.category))
    expect(categories.has('administrative')).toBe(true)
    expect(categories.has('information')).toBe(true)
    expect(categories.has('network')).toBe(true)
    expect(categories.has('mobility')).toBe(true)
    expect(categories.has('field')).toBe(true)
    expect(categories.has('infrastructure')).toBe(true)
    expect(categories.has('blackProgram')).toBe(true)
    for (const d of interventionCatalog) {
      expect(d.authorityCost).toBeGreaterThanOrEqual(0)
      expect(d.budgetCost).toBeGreaterThanOrEqual(0)
      expect(d.activationDelay).toBeGreaterThanOrEqual(0)
      expect(d.effectWindow).toBeGreaterThan(0)
      expect(d.successProbability).toBeGreaterThan(0)
      expect(d.successProbability).toBeLessThanOrEqual(1)
      expect(d.publicity).toBeGreaterThanOrEqual(0)
      expect(d.publicity).toBeLessThanOrEqual(1)
      expect(d.tier).toBeGreaterThanOrEqual(0)
      expect(d.tier).toBeLessThanOrEqual(100)
      expect(d.validTargets.length).toBeGreaterThan(0)
    }
  })
})
