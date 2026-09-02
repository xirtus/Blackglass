/**
 * SimWorkerClient — same engine surface as the inline path, hosted in a
 * Web Worker. Enable with `import.meta.env.VITE_SIM_WORKER === 'true'`.
 * Phase 1 default stays inline for debuggability; the unit tests run the
 * worker in a stub environment to keep the protocol honest.
 */
import type { Command } from '@/core/commands'
import type { EngineOptions } from '@/sim/engine'
import type { ScenarioManifest } from '@/sim/scenario'
import type { WorkerRequest, WorkerResponse, WorkerSnapshot } from './protocol'

export class SimWorkerClient {
  private worker: Worker
  private lastSnapshot: WorkerSnapshot | null = null

  constructor(manifest: ScenarioManifest, options: EngineOptions, workerUrl: string) {
    this.worker = new Worker(workerUrl, { type: 'module' })
    const init: WorkerRequest = { kind: 'init', manifest, options }
    this.worker.postMessage(init)
  }

  onStep(cb: (snap: WorkerSnapshot) => void): void {
    this.worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data
      if (msg.kind === 'stepped' || msg.kind === 'snapshot') {
        this.lastSnapshot = msg.snapshot
        cb(msg.snapshot)
      }
    }
  }

  tick(dt: number): void {
    const req: WorkerRequest = { kind: 'tick', dt }
    this.worker.postMessage(req)
  }

  command(command: Command): void {
    const req: WorkerRequest = { kind: 'command', command }
    this.worker.postMessage(req)
  }

  dispose(): void {
    const req: WorkerRequest = { kind: 'dispose' }
    this.worker.postMessage(req)
    this.worker.terminate()
  }

  get snapshot(): WorkerSnapshot | null {
    return this.lastSnapshot
  }
}
