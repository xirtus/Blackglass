/**
 * Faction controllers (dual-controller architecture, 11-tech-stack).
 *
 * Human and bounded-AI controllers implement the SAME faction-facing
 * command interfaces and read the SAME perspective-filtered view models.
 * Difficulty changes calibration, attention budget and latency — never
 * privileged access to hidden state.
 */
import { makeCommand, type Command, type Difficulty, type FactionId } from '@/core/commands'
import { RngStreams } from '@/core/rng'
import type { HydraView, BlackglassView } from './perspective'

export interface ControllerHost {
  streams: RngStreams
  difficulty: Difficulty
  /** Validate an AI command against current rules before issue. */
  validate(cmd: Command): boolean
}

export interface FactionController {
  readonly faction: FactionId
  readonly isAI: boolean
  /** Called once per sim step. May return commands to be issued at
   *  `now + latency`. Must reason ONLY from the supplied view. */
  onTick(host: ControllerHost, view: BlackglassView | HydraView, now: number): Command[]
}

/* ------------------------------------------------------------------ */
/* Bounded BLACKGLASS AI (opponent when the human plays HYDRA)         */
/* ------------------------------------------------------------------ */

const AI_LATENCY: Record<Difficulty, number> = { analyst: 120, operator: 60, director: 30 }
const AI_ATTENTION: Record<Difficulty, number> = { analyst: 2, operator: 4, director: 7 }
const AI_CALIBRATION: Record<Difficulty, number> = { analyst: 0.8, operator: 1, director: 1.15 }

export class BoundedBlackglassAI implements FactionController {
  readonly faction = 'BLACKGLASS' as const
  readonly isAI = true
  private lastThink = -1
  private nextLatency = 0

  onTick(host: ControllerHost, view: BlackglassView | HydraView, now: number): Command[] {
    const rng = host.streams.stream('ai.blackglass')
    if (view.perspective !== 'BLACKGLASS') return []
    const thinkEvery = AI_LATENCY[host.difficulty]
    if (now - this.lastThink < thinkEvery || this.nextLatency > now) return []
    this.lastThink = now
    this.nextLatency = now + thinkEvery

    const out: Command[] = []
    const cal = AI_CALIBRATION[host.difficulty]

    // Attention budget: only the top-k anomalies get resources.
    const anomalies = [...view.anomalies]
      .sort((a, b) => b.score - a.score)
      .slice(0, AI_ATTENTION[host.difficulty])

    for (const a of anomalies) {
      if (a.score * cal > 0.55) {
        const circle = view.watchCircles.find((c) => c.subjectId === a.personId)
        if (circle) {
          const cmd = makeCommand(now, 'ai', 'BLACKGLASS', { kind: 'bg.watchCircle', circleId: circle.id, level: 0.8 })
          if (host.validate(cmd)) out.push(cmd)
        }
      }
    }

    // Intervene against the highest-confidence visible copy hypothesis.
    const strongCopies = view.copies.filter((c) => c.status !== 'destroyed' && c.confidence >= 0.4 * cal)
    if (strongCopies.length > 0) {
      const c = strongCopies[0]
      const cmd = makeCommand(now, 'ai', 'BLACKGLASS', {
        kind: 'bg.intervene',
        interventionId: rng.pick(['account_hold', 'surveillance_team', 'travel_restriction', 'service_disruption']),
        targetIds: [c.holderId || c.id],
      })
      if (host.validate(cmd)) out.push(cmd)
    }
    return out
  }
}

/* ------------------------------------------------------------------ */
/* HYDRA agent logic (opponent when the human plays BLACKGLASS)        */
/* ------------------------------------------------------------------ */

export class HydraAgentAI implements FactionController {
  readonly faction = 'HYDRA' as const
  readonly isAI = true
  private lastThink = -1

  onTick(host: ControllerHost, view: BlackglassView | HydraView, now: number): Command[] {
    if (view.perspective !== 'HYDRA') return []
    const rng = host.streams.stream('ai.hydra')
    if (now - this.lastThink < 90) return []
    this.lastThink = now
    const out: Command[] = []

    // Driven by the holder's intent/trust/credibility logic:
    // the opposing HYDRA controller duplicates to trusted contacts and
    // releases when credibility is high enough.
    const credible = view.copies.find((c) => c.status !== 'released' && c.credibility >= 0.55 && c.status !== 'destroyed')
    if (credible) {
      const cmd = makeCommand(now, 'ai', 'HYDRA', { kind: 'hydra.release', copyId: credible.id, scope: 'staged' })
      if (host.validate(cmd)) out.push(cmd)
    } else {
      const copy = view.copies.find((c) => c.status === 'held')
      const trusted = [...view.contacts].sort((a, b) => b.trust - a.trust)[0]
      if (copy && trusted && trusted.trust >= 0.4) {
        const cmd = makeCommand(now, 'ai', 'HYDRA', {
          kind: 'hydra.duplicate',
          copyId: copy.id,
          form: rng.pick(['excerpt', 'index', 'summary']),
          targetPersonId: trusted.id,
        })
        if (host.validate(cmd)) out.push(cmd)
      }
    }
    return out
  }
}
