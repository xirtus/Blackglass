/**
 * Data-driven intervention catalog (07-interventions). Actions are
 * abstract, high-level strategic commands with prerequisites, delays,
 * probability, costs, publicity, suspicion, attribution, infrastructure
 * and Hydra effects. Harmful real-world methods stay abstract; kinetic
 * options are strategic commands only; black-program tiers are abstract.
 */
import catalogJson from '@/data/interventions.json'
import type { FactionResources, InterventionDef, InterventionInstance } from './types'

const RAW = catalogJson as unknown

export function parseInterventionCatalog(raw: unknown): InterventionDef[] {
  if (!Array.isArray(raw)) throw new Error('Intervention catalog must be an array')
  const defs: InterventionDef[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const d = item as InterventionDef
    if (!d.id || !d.name || !d.category || !Array.isArray(d.validTargets)) {
      throw new Error(`Malformed intervention: ${JSON.stringify(item)}`)
    }
    if (seen.has(d.id)) throw new Error(`Duplicate intervention id: ${d.id}`)
    seen.add(d.id)
    defs.push(d)
  }
  return defs
}

export const interventionCatalog: InterventionDef[] = parseInterventionCatalog(RAW)

export function getIntervention(id: string): InterventionDef | undefined {
  return interventionCatalog.find((d) => d.id === id)
}

/** Prerequisite + cost + cooldown gate — only valid actions are offered. */
export function canAfford(def: InterventionDef, res: FactionResources): boolean {
  return res.authority >= def.authorityCost && res.budget >= def.budgetCost
}

export function prerequisitesMet(def: InterventionDef, state: {
  infrastructure: { grid: string; telecom: string }
}): boolean {
  for (const pre of def.prerequisites) {
    if (pre === 'grid.up' && state.infrastructure.grid !== 'up') return false
    if (pre === 'telecom.up' && state.infrastructure.telecom !== 'up') return false
  }
  return true
}

export function cooldownRemaining(
  inst: InterventionInstance | undefined,
  def: InterventionDef,
  now: number,
): number {
  if (!inst) return 0
  return Math.max(0, inst.resolvesAt + def.cooldown - now)
}

export function describeCosts(def: InterventionDef): string {
  const parts: string[] = []
  if (def.authorityCost > 0) parts.push(`AUTH ${def.authorityCost}`)
  if (def.budgetCost > 0) parts.push(`BUD ${def.budgetCost}`)
  if (def.activationDelay > 0) parts.push(`${Math.round(def.activationDelay / 60)}m delay`)
  if (def.publicity > 0) parts.push(`PUB +${Math.round(def.publicity * 100)}`)
  if (def.suspicionDelta !== 0) parts.push(`SUS ${def.suspicionDelta > 0 ? '+' : ''}${Math.round(def.suspicionDelta * 100)}`)
  if (def.attributionRisk > 0) parts.push(`ATTR ${Math.round(def.attributionRisk * 100)}`)
  return parts.join(' · ')
}
