import { useEffect } from 'react'
import { useGameStore } from '@/store/game'
import { useUIStore } from '@/store/ui'
import { DebugOverlay } from '@/debug/overlay'
import { CommandPalette } from '@/ui/CommandPalette'
import { ReplayScreen } from '@/ui/ReplayScreen'
import { TitleScreen } from '@/ui/TitleScreen'
import { Workspace } from '@/ui/Workspace'
import { useHotkeys } from '@/ui/useHotkeys'

export default function App() {
  const phase = useGameStore((s) => s.phase)
  useHotkeys()
  const quality = useUIStore((s) => s.quality)

  // Main loop: drive the engine with real time (fixed-step sim inside).
  useEffect(() => {
    if (phase !== 'play') return
    let raf = 0
    let last = performance.now()
    const loop = (t: number) => {
      const dt = Math.min(0.25, (t - last) / 1000)
      last = t
      const engine = useGameStore.getState().engine
      if (engine) {
        engine.advance(dt)
        // Auto-enter replay when the scenario ends.
        const end = engine.state.endState
        if (end && end.kind !== 'none' && useGameStore.getState().phase === 'play') {
          // End overlay shows first; player clicks through to replay.
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase, quality])

  return (
    <div className="app">
      {phase === 'title' && <TitleScreen />}
      {phase === 'play' && <Workspace />}
      {phase === 'replay' && <ReplayScreen />}
      <CommandPalette />
      <DebugOverlay />
    </div>
  )
}
