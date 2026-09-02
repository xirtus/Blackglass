import { describe, expect, it } from 'vitest'
import { makeCommand } from '@/core/commands'
import { manifest } from '@/data/scenarios'
import { handleWorkerRequest, type WorkerHost } from './handle'

describe('worker message protocol (inline harness)', () => {
  it('init → tick → snapshot flows produce consistent fingerprints', () => {
    const host: WorkerHost = { engine: null }
    const ready = handleWorkerRequest(host, { kind: 'init', manifest, options: { perspective: 'BLACKGLASS', humanFaction: 'BLACKGLASS', difficulty: 'operator' } })
    expect(ready).toEqual({ kind: 'ready', seed: manifest.seed })
    expect(host.engine).not.toBeNull()

    handleWorkerRequest(host, {
      kind: 'command',
      command: makeCommand(1, 'human', 'BLACKGLASS', { kind: 'bg.watchCircle', circleId: 'wc_unknown', level: 0.5 }),
    })
    const stepped = handleWorkerRequest(host, { kind: 'tick', dt: 1 })
    expect(stepped?.kind).toBe('stepped')
    expect(stepped && 'snapshot' in stepped && stepped.snapshot.simTime).toBeGreaterThan(0)

    const snap = handleWorkerRequest(host, { kind: 'snapshot' })
    expect(snap?.kind).toBe('snapshot')
    expect(snap && 'snapshot' in snap && snap.snapshot.fingerprint.length).toBeGreaterThan(0)

    handleWorkerRequest(host, { kind: 'dispose' })
    expect(host.engine).toBeNull()
    expect(() => handleWorkerRequest(host, { kind: 'tick', dt: 1 })).toThrow(/not initialized/)
  })

  it('worker-hosted and inline engines agree on fingerprints', async () => {
    const { GameEngine } = await import('@/sim/engine')
    const inline = GameEngine.create(manifest, { perspective: 'HYDRA', humanFaction: 'HYDRA', difficulty: 'analyst' })
    for (let i = 0; i < 400; i++) inline.step()

    const host: WorkerHost = { engine: null }
    handleWorkerRequest(host, { kind: 'init', manifest, options: { perspective: 'HYDRA', humanFaction: 'HYDRA', difficulty: 'analyst' } })
    for (let i = 0; i < 100; i++) handleWorkerRequest(host, { kind: 'tick', dt: 1 })

    const snap = handleWorkerRequest(host, { kind: 'snapshot' })
    expect(snap && 'snapshot' in snap).toBe(true)
    expect(snap && 'snapshot' in snap && snap.snapshot.tick).toBe(inline.state.tick)
    expect(snap && 'snapshot' in snap && snap.snapshot.fingerprint).toBe(inline.fingerprint())
  })
})
