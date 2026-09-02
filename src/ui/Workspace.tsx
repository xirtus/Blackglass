/** Primary workspace layout (10-ui-hud ASCII): top strip / 3 columns / bottom. */
import { useGameStore, useView } from '@/store/game'
import { MapCanvas } from '@/three/MapCanvas'
import { ArchivePanel, DossierPanel } from '@/ui/panels/RightPanels'
import { LeakBriefPanel, TrustedNetworkPanel, WatchIndexPanel } from '@/ui/panels/LeftPanels'
import { TopBar } from '@/ui/panels/TopBar'
import { TimelinePanel, SocialGraphPanel, HypothesisBoard, MonitorPanels, OsintPanel } from '@/ui/panels/BottomPanels'
import { HydraActionDrawer, InterventionDrawer, ResourcesPanel } from '@/ui/panels/ActionDrawer'
import { EndStateOverlay } from './ReplayScreen'
import { useUIStore, type PanelId } from '@/store/ui'

export function Workspace() {
  const view = useView()
  const phase = useGameStore((s) => s.phase)
  if (!view || phase !== 'play') return null
  const isHydra = view.perspective === 'HYDRA'

  return (
    <div className={`workspace ${isHydra ? 'workspace-hydra' : ''}`} data-testid="workspace">
      <TopBar />
      <div className="workspace-grid">
        <aside className="col-left">
          <LeakBriefPanel />
          {isHydra ? <TrustedNetworkPanel /> : <WatchIndexPanel />}
          {!isHydra && <ResourcesPanel />}
        </aside>
        <main className="col-map">
          <MapCanvas />
        </main>
        <aside className="col-right">
          {isHydra ? <ArchivePanel /> : <DossierPanel />}
          <OsintPanel view={view} />
          <MonitorPanels view={view} />
        </aside>
      </div>
      <BottomDock isHydra={isHydra} />
      <EndStateOverlay />
    </div>
  )
}

function BottomDock({ isHydra }: { isHydra: boolean }) {
  const activePanel = useUIStore((s) => s.activePanel)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  const tabs: { id: PanelId; label: string }[] = [
    { id: 'interventions', label: isHydra ? 'DISCLOSURE' : 'INTERVENTIONS' },
    { id: 'timeline', label: 'TIMELINE' },
    { id: 'graph', label: 'SOCIAL GRAPH' },
  ]
  if (!isHydra) tabs.push({ id: 'hypotheses', label: 'ANALYST BOARD' })
  const active = tabs.some((t) => t.id === activePanel) ? activePanel : 'interventions'

  return (
    <div className="workspace-bottom" data-testid="bottom-dock">
      <div className="bottom-tabs" role="tablist" aria-label="Intelligence panels">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={active === tab.id ? 'bottom-tab active' : 'bottom-tab'}
            onClick={() => setActivePanel(tab.id)}
            role="tab"
            aria-selected={active === tab.id}
            data-testid={`dock-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="bottom-content">
        {active === 'interventions' && (isHydra ? <HydraActionDrawer /> : <InterventionDrawer />)}
        {active === 'timeline' && <TimelinePanel />}
        {active === 'graph' && <SocialGraphPanel />}
        {active === 'hypotheses' && !isHydra && <HypothesisBoard />}
      </div>
    </div>
  )
}
