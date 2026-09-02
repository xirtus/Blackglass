/** Development instrumentation (14-performance-qa debug overlays). */
import { useGameStore } from '@/store/game'
import { useUIStore } from '@/store/ui'

export function DebugOverlay() {
  const engine = useGameStore((s) => s.engine)
  const version = useGameStore((s) => s.version)
  const open = useUIStore((s) => s.debugOpen)
  if (!open || !engine) return null
  void version

  const state = engine.state
  const copies = state.entities.copies.all()
  const activeCopies = copies.filter((c) => c.status === 'active' || c.status === 'held' || c.status === 'released')

  return (
    <div className="debug-overlay" data-testid="debug-overlay">
      <h3>DEV INSTRUMENTATION</h3>
      <table>
        <tbody>
          <tr><td>tick</td><td>{state.tick}</td></tr>
          <tr><td>sim time</td><td>{state.simTime.toFixed(0)}s</td></tr>
          <tr><td>explicit people</td><td>{state.entities.people.size}</td></tr>
          <tr><td>vehicles</td><td>{state.entities.vehicles.size}</td></tr>
          <tr><td>devices</td><td>{state.entities.devices.size}</td></tr>
          <tr><td>observations</td><td>{state.entities.observations.size}</td></tr>
          <tr><td>copies (active)</td><td>{activeCopies.length} / {copies.length}</td></tr>
          <tr><td>event log</td><td>{engine.log.all().length}</td></tr>
          <tr><td>event queue</td><td>{engine.queue.length}</td></tr>
          <tr><td>pending commands</td><td>{engine.rejections.length} rejected</td></tr>
          <tr><td>anomaly reports</td><td>{state.anomalies.length}</td></tr>
          <tr><td>watch circles</td><td>{state.watchCircles.length}</td></tr>
          <tr><td>public suspicion</td><td>{state.public.suspicion.toFixed(2)}</td></tr>
          <tr><td>end state</td><td>{state.endState?.kind ?? 'none'}</td></tr>
          <tr><td>fingerprint</td><td>{engine.fingerprint().slice(0, 8)}</td></tr>
        </tbody>
      </table>
    </div>
  )
}
