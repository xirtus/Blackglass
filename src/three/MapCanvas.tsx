import { useGameStore } from '@/store/game'
import { useUIStore } from '@/store/ui'
import { AtlasViewport } from '@/ui/AtlasViewport'

export function MapCanvas() {
  const engine = useGameStore((s) => s.engine)
  const perspective = useGameStore((s) => s.perspective)
  const version = useGameStore((s) => s.version)
  const debugOpen = useUIStore((s) => s.debugOpen)

  void version
  const view = engine?.viewModel(perspective) ?? null

  return (
    <div className="map-canvas" data-testid="map-canvas">
      <AtlasViewport view={view} />
      {debugOpen && (
        <div className="debug-note">
          REAL ATLAS · OSM tiles · simulation={engine?.state.tick ?? 0}
        </div>
      )}
    </div>
  )
}
