/**
 * Worker protocol types (11-tech-stack: Web Workers for sim ticks,
 * generation, pathfinding, aggregation). Phase 1 runs the engine inline;
 * this shell keeps the seam ready for Phase 2+ heavy simulation.
 */
import type { Command } from '@/core/commands'
import type { ScenarioManifest } from '@/sim/scenario'
import type { EngineOptions } from '@/sim/engine'

export type WorkerRequest =
  | { kind: 'init'; manifest: ScenarioManifest; options: EngineOptions }
  | { kind: 'tick'; dt: number }
  | { kind: 'command'; command: Command }
  | { kind: 'snapshot' }
  | { kind: 'dispose' }

export interface WorkerSnapshot {
  tick: number
  simTime: number
  endStateKind: string | null
  eventLogLength: number
  fingerprint: string
}

export type WorkerResponse =
  | { kind: 'ready'; seed: number }
  | { kind: 'stepped'; snapshot: WorkerSnapshot }
  | { kind: 'snapshot'; snapshot: WorkerSnapshot }
  | { kind: 'error'; message: string }
