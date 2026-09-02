/**
 * Sim worker host: owns a GameEngine in a worker thread. The identical
 * engine code runs inline for Phase 1; the worker path is exercised by
 * unit tests (through handle.ts) so the seam never rots.
 */
/// <reference lib="webworker" />
import { handleWorkerRequest, type WorkerHost } from './handle'
import type { WorkerRequest, WorkerResponse } from './protocol'

const host: WorkerHost = { engine: null }

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  try {
    const res = handleWorkerRequest(host, ev.data)
    if (res) self.postMessage(res satisfies WorkerResponse)
  } catch (e) {
    const res: WorkerResponse = { kind: 'error', message: String(e) }
    self.postMessage(res)
  }
}

export {}
