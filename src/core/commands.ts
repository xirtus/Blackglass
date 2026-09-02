/**
 * Command bus contract: the ONLY way the simulation mutates is through
 * explicit, timestamped, faction-scoped commands. A scenario seed + the
 * command log + versioned rules reproduce a run (04-simulation,
 * 14-performance-qa).
 *
 * Both the human UI and bounded-AI controllers emit these commands through
 * the same faction-facing interfaces (dual-controller architecture).
 */
import type { Speed } from './clock'
import type { CopyForm } from '@/sim/types'

export type FactionId = 'BLACKGLASS' | 'HYDRA'
export type Perspective = FactionId | 'OMNISCIENT_REPLAY'
export type ControllerId = 'human' | 'ai'
export type Difficulty = 'analyst' | 'operator' | 'director'

/** BLACKGLASS containment commands. */
export type BlackglassCommand =
  | { kind: 'clock.setSpeed'; speed: Speed }
  | { kind: 'clock.pause'; paused: boolean }
  | { kind: 'bg.watchCircle'; circleId: string; level: number } // 0..1 resource spend
  | { kind: 'bg.unwatchCircle'; circleId: string }
  | { kind: 'bg.intervene'; interventionId: string; targetIds: string[] }
  | { kind: 'bg.pin'; subjectId: string }
  | { kind: 'bg.hypothesize'; subjectId: string; relation: HypothesisRelation; note: string }

/** HYDRA disclosure commands (high-level, data-driven — no operational detail). */
export type HydraCommand =
  | { kind: 'hydra.contact'; personId: string }
  | { kind: 'hydra.duplicate'; copyId: string; form: CopyForm; targetPersonId?: string }
  | { kind: 'hydra.authenticate'; copyId: string }
  | { kind: 'hydra.release'; copyId: string; scope: ReleaseScope; audienceId?: string }
  | { kind: 'hydra.abandonBranch'; copyId: string }
  | { kind: 'hydra.transferControl'; copyId: string; personId: string }
  | { kind: 'hydra.shield'; personId: string }
  | { kind: 'hydra.decoy'; personId: string }

export type Command = {
  id: string
  simTime: number
  controller: ControllerId
  faction: FactionId
  /** Optional marker for hypothesis board provenance. */
  note?: string
} & (BlackglassCommand | HydraCommand)

export type HypothesisRelation = 'carrier' | 'recipient' | 'path' | 'source' | 'other'
export type ReleaseScope = 'limited' | 'staged' | 'public'

let cmdCounter = 0

export function makeCommand(
  simTime: number,
  controller: ControllerId,
  faction: FactionId,
  body: BlackglassCommand | HydraCommand,
): Command {
  cmdCounter++
  return { id: `cmd_${cmdCounter.toString(36)}`, simTime, controller, faction, ...body } as Command
}

export function serializeCommands(cmds: readonly Command[]): string {
  return JSON.stringify(cmds)
}

export function deserializeCommands(json: string): Command[] {
  const parsed: unknown = JSON.parse(json)
  if (!Array.isArray(parsed)) throw new Error('Command log must be an array')
  const out: Command[] = []
  for (const raw of parsed) {
    const c = raw as Partial<Command>
    if (typeof c?.id !== 'string' || typeof c.simTime !== 'number' || typeof c.kind !== 'string') {
      throw new Error(`Malformed command entry: ${JSON.stringify(raw)}`)
    }
    out.push(c as Command)
  }
  return out
}
