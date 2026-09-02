/** Omniscient post-mission replay: ground truth vs each side's beliefs. */
import { useGameStore } from '@/store/game'
import { useUIStore } from '@/store/ui'
import { Badge, EntityLink, formatSimTime, Stat } from '@/ui/primitives'

export function ReplayScreen() {
  const engine = useGameStore((s) => s.engine)
  const quit = useGameStore((s) => s.quitToTitle)
  if (!engine) return null
  const view = engine.viewModel('OMNISCIENT_REPLAY')
  if (view.perspective !== 'OMNISCIENT_REPLAY') return null

  const bgScore = engine.blackglassScore()
  const hydraScore = engine.hydraScore()

  return (
    <div className="replay-screen" data-testid="replay-screen">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-mark" aria-hidden>◈</span>
          <span className="brand-name">OMNISCIENT REPLAY</span>
          <span className="brand-sub">GROUND TRUTH + BELIEF STATES</span>
        </div>
        <button className="ctl" onClick={quit} data-testid="back-to-title">EXIT TO TITLE</button>
      </header>

      <div className="replay-grid">
        <section className="panel">
          <header className="panel-head"><h2>BLACKGLASS SCORE</h2><span className="panel-badge">{bgScore.grade}</span></header>
          <div className="panel-body">
            <div className="stat-grid">
              <Stat label="CONTAINMENT" value={Math.round(bgScore.containment * 100)} />
              <Stat label="SECRECY" value={Math.round(bgScore.secrecy * 100)} />
              <Stat label="PUBLIC TRUST" value={Math.round(bgScore.publicTrust * 100)} />
              <Stat label="SYSTEM STABILITY" value={Math.round(bgScore.systemStability * 100)} />
              <Stat label="ATTRIBUTION RISK" value={Math.round(bgScore.attributionRisk * 100)} />
              <Stat label="AUTHORITY SPENT" value={Math.round(bgScore.authoritySpent * 100)} />
            </div>
            <p className="panel-hint">{bgScore.summary}</p>
          </div>
        </section>
        <section className="panel">
          <header className="panel-head"><h2>HYDRA SCORE</h2><span className="panel-badge">{hydraScore.grade}</span></header>
          <div className="panel-body">
            <div className="stat-grid">
              <Stat label="DURABILITY" value={Math.round(hydraScore.disclosureDurability * 100)} />
              <Stat label="CREDIBILITY" value={Math.round(hydraScore.credibility * 100)} />
              <Stat label="INDEP. BRANCHES" value={Math.round(hydraScore.independentBranches * 100)} />
              <Stat label="REACH" value={Math.round(hydraScore.reach * 100)} />
              <Stat label="NETWORK SURVIVAL" value={Math.round(hydraScore.networkSurvival * 100)} />
              <Stat label="PUBLIC UNDERSTANDING" value={Math.round(hydraScore.publicUnderstanding * 100)} />
            </div>
            <p className="panel-hint">{hydraScore.summary}</p>
          </div>
        </section>
        <section className="panel">
          <header className="panel-head"><h2>COPY TRUTH</h2><span className="panel-badge">{view.copies.length}</span></header>
          <div className="panel-body">
            <table className="truth-table">
              <thead><tr><th>COPY</th><th>FORM</th><th>HOLDER</th><th>STATUS</th><th>LEVEL</th><th>BG KNEW</th><th>HYDRA KNEW</th></tr></thead>
              <tbody>
                {view.copies.map((c) => {
                  const holder = view.people.find((p) => p.id === c.holderId)
                  return (
                    <tr key={c.id}>
                      <td><EntityLink id={c.id} label={c.id.slice(5, 11)} tone="cyan" /></td>
                      <td>{c.form.toUpperCase()}</td>
                      <td>{holder?.name ?? c.holderId}</td>
                      <td><Badge tone={c.status === 'released' ? 'green' : c.status === 'destroyed' ? 'red' : c.status === 'held' ? 'cyan' : 'dim'}>{c.status.toUpperCase()}</Badge></td>
                      <td>{c.level}</td>
                      <td>{c.observedBy.includes('BLACKGLASS') ? 'YES' : 'NO'}</td>
                      <td>{c.observedBy.includes('HYDRA') ? 'YES' : 'NO'}</td>
                    </tr>
                  )
                })}
              </tbody>
              </table>
            </div>
        </section>
        <section className="panel">
          <header className="panel-head"><h2>EVENT LOG</h2><span className="panel-badge">{engine.log.all().length}</span></header>
          <div className="panel-body replay-log">
            <ul className="timeline">
              {engine.log.all().slice(-80).reverse().map((e) => (
                <li key={e.id} onClick={() => e.subjects[0] && useUIStore.getState().select(e.subjects[0])}>
                  <span className="tl-time">{formatSimTime(e.simTime)}</span>
                  <span className="tl-type">{e.type}</span>
                  <span className="tl-msg">{e.message}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="panel">
          <header className="panel-head"><h2>BELIEF RECONCILIATION</h2></header>
          <div className="panel-body">
            <div className="stat-grid">
              <Stat label="BG KNOWN COPIES" value={view.blackglassBeliefs.knownCopyCount} />
              <Stat label="TRUTH (ACTIVE)" value={view.copies.filter((c) => c.status !== 'destroyed' && c.status !== 'lost').length} />
              <Stat label="HYDRA KNOWN" value={view.hydraBeliefs.knownCopyCount} />
              <Stat label="BG OBS. HITS" value={view.blackglassBeliefs.observedHolderHits} />
              <Stat label="HYDRA HEAT (TRUE)" value={view.hydraBeliefs.heat.toFixed(2)} />
              <Stat label="PUBLIC SUSPICION" value={view.blackglassBeliefs.suspicion.toFixed(2)} />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export function EndStateOverlay() {
  const engine = useGameStore((s) => s.engine)
  const endGame = useGameStore((s) => s.endGame)
  if (!engine) return null
  const end = engine.state.endState
  if (!end || end.kind === 'none') return null
  const isHydra = useGameStore.getState().humanFaction === 'HYDRA'
  const score = isHydra ? engine.hydraScore() : engine.blackglassScore()

  return (
    <div className="end-overlay" data-testid="end-overlay">
      <div className="end-card">
        <h2>MISSION COMPLETE — {end.kind.toUpperCase()}</h2>
        <p>{end.summary}</p>
        <p className="end-grade">
          GRADE <strong>{score.grade}</strong> · {score.summary}
        </p>
        <button className="btn-primary" onClick={endGame} data-testid="open-replay">
          OPEN OMNISCIENT REPLAY
        </button>
      </div>
    </div>
  )
}
