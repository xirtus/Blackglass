/**
 * Hydra math and per-faction scoring (06-hydra, 16-prompt PLAYER SCORE).
 */
import type { SimulationState } from './types'
import { computeReplicationNumber } from './systems'

export interface HydraMetrics {
  knownCopies: number
  estimatedCopies: number
  copyConfidence: number
  exposure: number
  credibility: number
  replicationNumberH: number
  publicSuspicion: number
  containmentProbability: number
  demand: number
}

export function computeHydraMetrics(state: SimulationState): HydraMetrics {
  const copies = state.entities.copies.all()
  const active = copies.filter((c) => c.status === 'active' || c.status === 'held' || c.status === 'released')
  const released = active.filter((c) => c.status === 'released')

  const knownCopies = active.length
  const viralAggregate = released.reduce((s, c) => s + c.exposure * 120, 0)
  const estimatedCopies = knownCopies + viralAggregate
  const observed = copies.filter((c) => c.lastObservedAt >= 0 || c.observedBy.length > 0)
  const copyConfidence = copies.length === 0 ? 1 : observed.length / copies.length

  const exposure = released.reduce((s, c) => s + c.exposure, 0) / Math.max(1, released.length)
  const credibility = active.length === 0 ? 0 : active.reduce((s, c) => s + c.credibility, 0) / active.length
  const H = computeReplicationNumber(state)

  // Containment probability: the model's estimate that all meaningful
  // branches can still be reduced below H < 1.
  const containmentProbability = Math.max(0, Math.min(1, 1 - H * 0.55 - state.public.suspicion * 0.3))

  return {
    knownCopies,
    estimatedCopies: Math.round(estimatedCopies),
    copyConfidence,
    exposure,
    credibility,
    replicationNumberH: H,
    publicSuspicion: state.public.suspicion,
    containmentProbability,
    demand: state.public.searchDemand,
  }
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D'

export interface BlackglassScore {
  containment: number
  secrecy: number
  publicTrust: number
  systemStability: number
  attributionRisk: number
  authoritySpent: number
  total: number
  grade: Grade
  summary: string
}

export function computeBlackglassScore(state: SimulationState, initialAuthority: number, initialBudget: number): BlackglassScore {
  const m = computeHydraMetrics(state)
  const res = state.resources.BLACKGLASS
  const copies = state.entities.copies.all().filter((c) => c.status === 'active' || c.status === 'held' || c.status === 'released')

  const containment = copies.length === 0 ? 1 : Math.max(0, 1 - m.replicationNumberH * 0.4)
  const secrecy = 1 - m.exposure
  const publicTrust = state.public.suspicion < 0.3 ? 1 - state.public.suspicion : Math.max(0, 1 - state.public.suspicion * 1.4)
  const systemStability =
    (state.infrastructure.grid === 'up' ? 1 : 0.4) * 0.5 + (state.infrastructure.telecom === 'up' ? 1 : 0.4) * 0.3 + (1 - state.infrastructure.traffic) * 0.2
  const attributionRisk = state.resources.BLACKGLASS.politicalCapital / 100
  const authoritySpent = Math.max(0, 1 - (res.authority / initialAuthority + res.budget / initialBudget) / 2)

  const total = clamp01(containment * 0.3 + secrecy * 0.2 + publicTrust * 0.15 + systemStability * 0.15 + attributionRisk * 0.1 + (1 - authoritySpent) * 0.1)
  const grade = toGrade(total)
  const summary =
    containment < 0.4
      ? 'The archive is loose. Whatever the political cost, containment failed.'
      : publicTrust < 0.4
        ? 'The archive is contained — and the public noticed how. Grade accordingly.'
        : total > 0.8
          ? 'Clean containment with limited collateral.'
          : 'Contained, with visible scars.'
  return { containment, secrecy, publicTrust, systemStability, attributionRisk, authoritySpent, total, grade, summary }
}

export interface HydraScore {
  disclosureDurability: number
  credibility: number
  independentBranches: number
  reach: number
  networkSurvival: number
  publicUnderstanding: number
  socialCost: number
  total: number
  grade: Grade
  summary: string
}

export function computeHydraScore(state: SimulationState): HydraScore {
  const m = computeHydraMetrics(state)
  const copies = state.entities.copies.all()
  const alive = copies.filter((c) => c.status === 'released' || c.status === 'held')
  const released = copies.filter((c) => c.status === 'released')
  const destroyed = copies.filter((c) => c.status === 'destroyed' || c.status === 'lost')

  const disclosureDurability = released.length === 0 ? 0 : m.replicationNumberH >= 1 ? 1 : m.replicationNumberH
  const credibility = m.credibility
  const roots = copies.filter((c) => c.parentId === null || !copies.some((x) => x.id === c.parentId)).length
  const independentBranches = Math.min(1, roots / 3)
  const reach = m.exposure
  const networkSurvival = alive.length / Math.max(1, alive.length + destroyed.length)
  const publicUnderstanding = state.public.searchDemand
  const socialCost = Math.max(0, 1 - state.public.suspicion * 0.4 - (state.entities.people.all().filter((p) => p.status === 'detained').length / 8))

  const total = clamp01(
    disclosureDurability * 0.25 +
      credibility * 0.2 +
      independentBranches * 0.15 +
      reach * 0.15 +
      networkSurvival * 0.1 +
      publicUnderstanding * 0.1 +
      socialCost * 0.05,
  )
  const grade = toGrade(total)
  const summary =
    disclosureDurability >= 0.9
      ? 'Credible, independent, unrecoverable. The information won.'
      : credibility < 0.3
        ? 'The archive reached people — and nobody believed it.'
        : networkSurvival < 0.3
          ? 'Durable, but the network paid the cost.'
          : 'A fragile victory: alive, but not yet beyond reach.'
  return { disclosureDurability, credibility, independentBranches, reach, networkSurvival, publicUnderstanding, socialCost, total, grade, summary }
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

function toGrade(total: number): Grade {
  if (total >= 0.9) return 'S'
  if (total >= 0.75) return 'A'
  if (total >= 0.6) return 'B'
  if (total >= 0.45) return 'C'
  return 'D'
}
