/** Event timeline, social graph, hypothesis board, monitors. */
import { useMemo, useState } from 'react'
import { useEvents, useGameStore, useView } from '@/store/game'
import { useUIStore } from '@/store/ui'
import { Badge, Bar, EntityLink, formatSimTime, Panel, Stat } from '@/ui/primitives'
import type { ViewModel } from '@/sim/perspective'
import type { GameEvent } from '@/core/events'
import { osintKindLabel, sourceHealth, sourceModeLabel } from '@/osint/catalog'

const EVENT_TONE: Record<GameEvent['severity'], string> = { info: 'tone-info', notice: 'tone-ok', warning: 'tone-warn', critical: 'tone-crit' }

const FILTERS = ['all', 'ALERT', 'OBSERVATION', 'ANOMALY', 'COPY_CREATED', 'COPY_RELEASED', 'INTERVENTION_STARTED', 'INTERVENTION_RESOLVED', 'PUBLIC_EVENT'] as const

export function TimelinePanel() {
  const events = useEvents(60)
  const [filter, setFilter] = useState<string>('all')
  const selectedId = useUIStore((s) => s.selectedId)
  const shown = filter === 'all' ? events : events.filter((e) => e.type === filter)

  return (
    <Panel id="timeline" title="EVENT TIMELINE" badge={String(events.length)} className="bottom-panel">
      <div className="filter-row">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? 'ctl active' : 'ctl'} onClick={() => setFilter(f)}>
            {f === 'all' ? 'ALL' : f.replaceAll('_', ' ')}
          </button>
        ))}
      </div>
      <ul className="timeline">
        {shown.map((e) => (
          <li
            key={e.id}
            className={selectedId && e.subjects.includes(selectedId) ? 'row-selected' : ''}
            onClick={() => e.subjects[0] && useUIStore.getState().select(e.subjects[0])}
          >
            <span className="tl-time">{formatSimTime(e.simTime)}</span>
            <span className={`tl-sev ${EVENT_TONE[e.severity]}`}>{e.severity[0].toUpperCase()}</span>
            <span className="tl-type">{e.type}</span>
            <span className="tl-msg">{e.message}</span>
            <span className="tl-src" title={`${e.provenance.source} · ${e.provenance.reason}`}>
              {e.provenance.source}
            </span>
          </li>
        ))}
        {shown.length === 0 && <li className="panel-empty">No events.</li>}
      </ul>
    </Panel>
  )
}

export function SocialGraphPanel() {
  const view = useView()
  const engine = useGameStore((s) => s.engine)
  const selectedId = useUIStore((s) => s.selectedId)
  const select = useUIStore((s) => s.select)

  const graph = useMemo(() => {
    if (!view || !engine) return null
    // Perspective discipline: HYDRA sees its own perceived contacts only;
    // BLACKGLASS sees the social-metadata graph of any selected person;
    // omniscient replay sees everything.
    if (view.perspective === 'HYDRA') {
      const centerId = view.activeHolderId ?? selectedId
      if (!centerId) return null
      const center = engine.state.entities.people.get(centerId)
      const neighbors = view.contacts.map((c) => ({ id: c.id, name: c.name, kind: c.kind, trust: c.trust }))
      return { center: { id: centerId, name: center?.name ?? 'unknown' }, neighbors }
    }
    const centerId = selectedId
    if (!centerId) return null
    const center = engine.state.entities.people.get(centerId)
    if (!center) return null
    const edges = engine.state.entities.edges.all().filter((e) => e.a === centerId || e.b === centerId)
    const neighbors = edges.map((e) => {
      const otherId = e.a === centerId ? e.b : e.a
      const p = engine.state.entities.people.get(otherId)
      return { id: otherId, name: p?.name ?? otherId, kind: e.kind, trust: e.trust }
    })
    return { center: { id: centerId, name: center.name }, neighbors }
  }, [view, engine, selectedId])

  return (
    <Panel id="graph" title="SOCIAL GRAPH" badge={graph ? String(graph.neighbors.length) : undefined} className="bottom-panel">
      {graph ? (
        <div className="social-graph">
          <svg viewBox="-120 -120 240 240" role="img" aria-label="social graph">
            <circle cx={0} cy={0} r={14} className="graph-center" />
            {graph.neighbors.map((n, i) => {
              const angle = (i / Math.max(1, graph.neighbors.length)) * Math.PI * 2
              const x = Math.cos(angle) * 95
              const y = Math.sin(angle) * 95
              return (
                <g key={n.id} onClick={() => select(n.id)} className="graph-node" role="button">
                  <line x1={0} y1={0} x2={x} y2={y} strokeWidth={1 + n.trust * 3} />
                  <circle cx={x} cy={y} r={8} />
                  <text x={x} y={y + 20} textAnchor="middle" className="graph-label">
                    {n.name.split(' ')[0]}
                  </text>
                  <text x={x} y={y + 32} textAnchor="middle" className="graph-sub">
                    {n.kind.slice(0, 4)}·{Math.round(n.trust * 100)}
                  </text>
                </g>
              )
            })}
            <text y={-28} textAnchor="middle" className="graph-label">
              {graph.center.name}
            </text>
          </svg>
        </div>
      ) : (
        <p className="panel-empty">Select a subject to inspect their circles.</p>
      )}
    </Panel>
  )
}

export function HypothesisBoard() {
  const view = useView()
  if (!view || view.perspective !== 'BLACKGLASS') return null
  const hyps = view.hypotheses.slice(-6).reverse()
  return (
    <Panel id="hypotheses" title="ANALYST BOARD" badge={String(hyps.length)} className="bottom-panel">
      {hyps.length === 0 && <p className="panel-empty">Pin evidence and mark likely carriers, recipients and paths.</p>}
      {hyps.map((h) => (
        <div key={h.id} className="hyp-row">
          <EntityLink id={h.subjectId} label={h.subjectId} tone="amber" />
          <span className="hyp-rel">→ {h.relation.toUpperCase()}</span>
          <span className="hyp-scores">
            {h.modelScores.map((m) => (
              <span key={m.model} className={m.score > 0.6 ? 'tone-warn' : 'tone-info'}>
                {m.model[0]}{Math.round(m.score * 100)}
              </span>
            ))}
          </span>
        </div>
      ))}
    </Panel>
  )
}

export function MonitorPanels({ view }: { view: ViewModel }) {
  if (view.perspective === 'OMNISCIENT_REPLAY') return null
  return (
    <Panel id="public" title="PUBLIC / MEDIA MONITOR" className="bottom-panel">
      <div className="stat-grid">
        <Stat label="PUBLIC SUSPICION" value={<Bar value={view.public.suspicion} tone={view.public.suspicion > 0.5 ? 'red' : 'amber'} />} />
        <Stat label="MEDIA ATTENTION" value={<Bar value={view.public.mediaAttention} tone="cyan" />} />
        <Stat label="SEARCH DEMAND" value={<Bar value={view.public.searchDemand} tone="cyan" />} />
        <Stat label="TELECOM" value={view.infrastructure.telecom.toUpperCase()} tone={view.infrastructure.telecom !== 'up' ? 'warn' : 'ok'} />
        <Stat label="GRID" value={view.infrastructure.grid.toUpperCase()} tone={view.infrastructure.grid !== 'up' ? 'warn' : 'ok'} />
        <Stat label="TRAFFIC" value={`${Math.round(view.infrastructure.traffic * 100)}%`} />
      </div>
      {view.perspective === 'BLACKGLASS' && (
        <>
          <div className="stat-grid">
            <Stat label="KNOWN COPIES" value={view.metrics.knownCopies} />
            <Stat label="EST. COPIES" value={view.metrics.estimatedCopies} />
            <Stat label="EST. H" value={view.metrics.replicationNumberH.toFixed(2)} tone={view.metrics.replicationNumberH > 1 ? 'crit' : 'info'} title="player-facing estimate — may diverge from truth" />
            <Stat label="CONTAINMENT P" value={`${Math.round(view.metrics.containmentProbability * 100)}%`} tone={view.metrics.containmentProbability < 0.5 ? 'warn' : 'ok'} />
          </div>
          <p className="panel-hint">Estimates are derived from the player's own observations and may be wrong.</p>
        </>
      )}
      {view.perspective === 'HYDRA' && (
        <div className="stat-grid">
          <Stat label="REACH" value={`${Math.round(view.reach * 100)}%`} />
          <Stat label="CREDIBILITY" value={`${Math.round(view.credibility * 100)}%`} tone={view.credibility < 0.3 ? 'crit' : 'ok'} />
        </div>
      )}
    </Panel>
  )
}

export function OsintPanel({ view }: { view: ViewModel }) {
  if (view.perspective === 'OMNISCIENT_REPLAY') return null
  const signals = view.osintSignals.slice(-8).reverse()
  const sources = view.perspective === 'BLACKGLASS' ? view.osintSources : []
  const activeSources = sources.filter((s) => s.enabled && s.mode !== 'blocked')

  return (
    <Panel id="osint" title="OSINT SOURCES" badge={String(signals.length)} className="right-panel">
      {view.perspective === 'BLACKGLASS' && (
        <>
          <div className="source-list">
            {sources.map((source) => {
              const health = sourceHealth(source)
              return (
                <div key={source.id} className="source-row">
                  <div className="source-head">
                    <span className="source-name">{source.name}</span>
                    <Badge tone={health === 'ok' ? 'green' : health === 'warn' ? 'amber' : 'red'}>{sourceModeLabel(source.mode)}</Badge>
                  </div>
                  <div className="source-meta">
                    <span>{osintKindLabel(source.kind).toUpperCase()}</span>
                    <span>REL {Math.round(source.reliability * 100)}</span>
                    <span>COV {Math.round(source.coverage * 100)}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="stat-grid osint-stats">
            <Stat label="ACTIVE SOURCES" value={activeSources.length} />
            <Stat label="CAMERA POLICY" value="AUTHORIZED ONLY" tone="warn" />
          </div>
        </>
      )}
      <h3 className="panel-sub">RECENT SIGNALS</h3>
      <ul className="osint-feed">
        {signals.map((signal) => (
          <li key={signal.id} onClick={() => signal.subjectIds[0] && useUIStore.getState().select(signal.subjectIds[0])}>
            <div className="osint-row-head">
              <span className="tl-time">{formatSimTime(signal.simTime)}</span>
              <span className={`tl-sev ${signal.severity === 'critical' ? 'tone-crit' : signal.severity === 'warning' ? 'tone-warn' : 'tone-info'}`}>
                {signal.severity[0].toUpperCase()}
              </span>
              <span className="osint-title">{signal.title}</span>
            </div>
            <div className="osint-summary">{signal.summary}</div>
            <div className="source-meta">
              <span>{osintKindLabel(signal.sourceKind).toUpperCase()}</span>
              <span>{signal.verification.toUpperCase()}</span>
              <span>{Math.round(signal.confidence * 100)}%</span>
            </div>
          </li>
        ))}
        {signals.length === 0 && <li className="panel-empty">Awaiting source ingest.</li>}
      </ul>
    </Panel>
  )
}
