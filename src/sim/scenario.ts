/**
 * Scenario manifests are authored as data (12-content-pipeline). The
 * generator fills the surrounding world with coherent synthetic lives;
 * the manifest only declares leak origin, heroes, constraints and beats.
 */
import type { Vec2 } from './types'
import type { OsintSource } from './types'

export interface RoadSegment {
  id: string
  /** Node ids, polyline order. */
  nodes: string[]
  kind: 'road' | 'path'
  name?: string
}

export interface GraphNode {
  id: string
  pos: Vec2
}

export interface BuildingFootprint {
  id: string
  /** Center in local meters. */
  pos: Vec2
  w: number
  d: number
  h: number
  kind: 'government' | 'office' | 'residential' | 'commercial' | 'archive' | 'transit'
  name: string
}

export interface ScenarioManifest {
  id: string
  title: string
  seed: number
  /** Local flat map (Phase 1). Longitude/latitude arrive with Phase 2 MapLibre. */
  map: {
    center: [number, number]
    radiusKm: number
    style: string
  }
  origin: {
    type: 'public_archive' | 'courthouse' | 'campus' | 'station' | 'datacenter' | 'estate'
    name: string
    locationId: string
    fictionalInterior: boolean
  }
  population: {
    explicit: number
    background: number
  }
  archive: {
    id: string
    parts: string[]
    bytes: number
    credibility: number
  }
  heroActors: string[] // authored actor tags, matched by roleTags
  surveillancePreset: 'dense_government' | 'urban_mixed' | 'sparse'
  authorityPreset: string
  scriptedBeats: string[]
  winRules: { containmentThreshold: number }
  lossRules: { practicalHydra: boolean }
  durationMinutes: number
  graph: { nodes: GraphNode[]; roads: RoadSegment[] }
  buildings: BuildingFootprint[]
  interventionIds: string[]
  osintSources?: OsintSource[]
}

export function validateScenario(m: ScenarioManifest): string[] {
  const errors: string[] = []
  const nodeIds = new Set(m.graph.nodes.map((n) => n.id))
  const buildingIds = new Set(m.buildings.map((b) => b.id))
  const locationIds = new Set([...nodeIds, ...buildingIds])

  if (!m.id || !m.title) errors.push('Scenario id/title required')
  if (!Number.isInteger(m.seed)) errors.push('Seed must be an integer')
  if (m.population.explicit < 1) errors.push('At least one explicit life required')
  if (m.archive.bytes <= 0) errors.push('Archive bytes must be positive')
  if (m.durationMinutes <= 0) errors.push('Duration must be positive')
  if (m.origin.locationId && !buildingIds.has(m.origin.locationId) && !nodeIds.has(m.origin.locationId)) {
    errors.push(`Origin references unknown id "${m.origin.locationId}"`)
  }
  for (const r of m.graph.roads) {
    if (r.nodes.length < 2) errors.push(`Road ${r.id} needs >= 2 nodes`)
    for (const n of r.nodes) if (!nodeIds.has(n)) errors.push(`Road ${r.id} references unknown node ${n}`)
  }
  if (m.interventionIds.length === 0) errors.push('At least one intervention required')
  if (m.osintSources) {
    const sourceIds = new Set<string>()
    for (const source of m.osintSources) {
      if (!source.id || !source.name) errors.push('OSINT source id/name required')
      if (sourceIds.has(source.id)) errors.push(`Duplicate OSINT source "${source.id}"`)
      sourceIds.add(source.id)
      if (source.reliability < 0 || source.reliability > 1) errors.push(`OSINT source ${source.id} reliability out of range`)
      if (source.coverage < 0 || source.coverage > 1) errors.push(`OSINT source ${source.id} coverage out of range`)
      if (source.latency < 0) errors.push(`OSINT source ${source.id} latency must be non-negative`)
      for (const anchor of source.anchorLocationIds) {
        if (!locationIds.has(anchor)) errors.push(`OSINT source ${source.id} references unknown anchor ${anchor}`)
      }
      if (source.mode === 'blocked' && source.enabled) errors.push(`Blocked OSINT source ${source.id} cannot be enabled`)
    }
  }
  return errors
}

/** Graph distance utility: pairwise node distance in local meters. */
export function nodeDistance(a: GraphNode, b: GraphNode): number {
  return Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z)
}

export function nearestNode(graph: GraphNode[], pos: Vec2): GraphNode {
  let best = graph[0]
  let bestD = Infinity
  for (const n of graph) {
    const d = Math.hypot(n.pos.x - pos.x, n.pos.z - pos.z)
    if (d < bestD) {
      bestD = d
      best = n
    }
  }
  return best
}

/** Simple BFS over the road graph (Phase 1 flat-map routing). */
export function findRoute(
  _graph: GraphNode[],
  roads: RoadSegment[],
  from: string,
  to: string,
): string[] | null {
  const adj = new Map<string, string[]>()
  for (const r of roads) {
    for (let i = 0; i < r.nodes.length - 1; i++) {
      const a = r.nodes[i]
      const b = r.nodes[i + 1]
      adj.set(a, [...(adj.get(a) ?? []), b])
      adj.set(b, [...(adj.get(b) ?? []), a])
    }
  }
  const prev = new Map<string, string>()
  const seen = new Set<string>([from])
  const queue = [from]
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur === to) break
    for (const nb of adj.get(cur) ?? []) {
      if (!seen.has(nb)) {
        seen.add(nb)
        prev.set(nb, cur)
        queue.push(nb)
      }
    }
  }
  if (!prev.has(to) && from !== to) return null
  const path: string[] = [to]
  let cur = to
  while (cur !== from) {
    cur = prev.get(cur)!
    path.unshift(cur)
  }
  return path
}
