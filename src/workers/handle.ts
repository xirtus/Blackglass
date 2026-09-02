/**
 * Pure worker message handler — no `self` dependency, unit-testable in
 * Node. `sim.worker.ts` is a thin wiring shell around this.
 */
import { GameEngine } from '@/sim/engine'
import type { WorkerRequest, WorkerResponse, WorkerSnapshot } from './protocol'

export interface WorkerHost {
  engine: GameEngine | null
}

export function handleWorkerRequest(host: WorkerHost, msg: WorkerRequest): WorkerResponse | null {
  switch (msg.kind) {
    case 'init': {
      host.engine = GameEngine.create(msg.manifest, msg.options)
      return { kind: 'ready', seed: msg.manifest.seed }
    }
    case 'tick': {
      if (!host.engine) throw new Error('Worker not initialized')
      host.engine.advance(msg.dt)
      return { kind: 'stepped', snapshot: snapshotOf(host.engine) }
    }
    case 'command': {
      if (!host.engine) throw new Error('Worker not initialized')
      const res = host.engine.issueCommand(msg.command)
      if (!res.ok) return { kind: 'error', message: res.error ?? 'rejected' }
      return null
    }
    case 'snapshot': {
      if (!host.engine) throw new Error('Worker not initialized')
      return { kind: 'snapshot', snapshot: snapshotOf(host.engine) }
    }
    case 'dispose': {
      host.engine = null
      return null
    }
  }
}

export function snapshotOf(e: GameEngine): WorkerSnapshot {
  return {
    tick: e.state.tick,
    simTime: e.state.simTime,
    endStateKind: e.state.endState?.kind ?? null,
    eventLogLength: e.log.all().length,
    fingerprint: e.fingerprint(),
  }
}
