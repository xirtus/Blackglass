/** Watch Index (BLACKGLASS) / Trusted Network (HYDRA). */
import { playerActions, useView } from '@/store/game'
import { useUIStore } from '@/store/ui'
import { Bar, EntityLink, Panel, Stat } from '@/ui/primitives'
import { manifest } from '@/data/scenarios'
import { leakDossierForScenario } from '@/data/leakDossiers'

export function LeakBriefPanel() {
  const dossier = leakDossierForScenario(manifest)

  return (
    <Panel id="brief" title={dossier.codename} badge={dossier.classification} className="left-panel">
      <p className="leak-hook">{dossier.hook}</p>
      <div className="leak-field">
        <span>ARCHIVE</span>
        <strong>{dossier.archiveType}</strong>
      </div>
      <div className="leak-field">
        <span>NETWORK</span>
        <strong>{dossier.implicatedNetwork}</strong>
      </div>
      <div className="evidence-chips">
        {dossier.evidenceChain.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </Panel>
  )
}

export function WatchIndexPanel() {
  const view = useView()
  const selectedId = useUIStore((s) => s.selectedId)
  if (!view || view.perspective !== 'BLACKGLASS') return null

  return (
    <Panel id="watchIndex" title="WATCH INDEX" badge={String(view.watchCircles.length)} className="left-panel">
      <p className="panel-hint">Social circles around the initial subject. Watching a circle costs compute; coverage raises observation rate.</p>
      {view.watchCircles.map((c) => (
        <div key={c.id} className={`watch-row ${selectedId === c.subjectId ? 'row-selected' : ''}`}>
          <div className="watch-head">
            <span className="watch-kind">{c.kind.toUpperCase()}</span>
            <span className="watch-risk" title="model-computed risk">
              RISK {Math.round(c.risk * 100)}
            </span>
            {c.unknownNodes > 0 && <span className="watch-unknown">∅ {c.unknownNodes}</span>}
          </div>
          <Bar value={c.coverage} tone="amber" label={`${c.kind} coverage`} />
          <div className="watch-ctls">
            <span>COV {Math.round(c.coverage * 100)}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(c.coverage * 100)}
              onChange={(e) => playerActions.watchCircle(c.id, Number(e.target.value) / 100)}
              aria-label={`${c.kind} coverage`}
            />
          </div>
        </div>
      ))}
    </Panel>
  )
}

export function TrustedNetworkPanel() {
  const view = useView()
  const selectedId = useUIStore((s) => s.selectedId)
  if (!view || view.perspective !== 'HYDRA') return null

  return (
    <Panel id="trustedNetwork" title="TRUSTED NETWORK" badge={String(view.contacts.length)} className="left-panel">
      <p className="panel-hint">Perceived trust and branch independence only. Hidden surveillance state is not shown.</p>
      <div className="stat-grid">
        <Stat label="TRUST CAPITAL" value={Math.round(view.trustCapital)} />
        <Stat label="NETWORK HEALTH" value={Math.round(view.networkHealth)} tone={view.networkHealth < 40 ? 'warn' : 'info'} />
        <Stat label="BRANCH INDEP." value={Math.round(view.branchIndependence * 100)} />
        <Stat label="HEAT" value={view.heat.level.toUpperCase()} tone={view.heat.value >= 0.5 ? 'crit' : view.heat.value >= 0.25 ? 'warn' : 'ok'} />
      </div>
      <div className="contact-list">
        {view.contacts.map((c) => (
          <div key={c.id} className={`watch-row ${selectedId === c.id ? 'row-selected' : ''}`}>
            <div className="watch-head">
              <EntityLink id={c.id} label={c.name} tone="cyan" />
              <span className="watch-kind">{c.kind.toUpperCase()}</span>
            </div>
            <Bar value={c.trust} tone="green" label={`trust ${c.name}`} />
            <div className="watch-ctls">
              <span>TRUST {Math.round(c.trust * 100)}</span>
              <span className={c.status !== 'free' ? 'tone-crit' : ''}>{c.status.toUpperCase()}</span>
            </div>
          </div>
        ))}
      </div>
      {view.contacts.length === 0 && <p className="panel-empty">No known contacts for the active holder.</p>}
    </Panel>
  )
}
