/** Global alert strip + game clock + pause/speed controls (10-ui-hud). */
import { playerActions, useEvents, useGameStore, useSimTime } from '@/store/game'
import { useUIStore } from '@/store/ui'
import { Badge, formatSimTime } from '@/ui/primitives'
import type { GameEvent } from '@/core/events'
import { manifest } from '@/data/scenarios'
import { leakDossierForScenario } from '@/data/leakDossiers'

function severityTone(sev: GameEvent['severity']): 'red' | 'amber' | 'cyan' | 'dim' {
  return sev === 'critical' ? 'red' : sev === 'warning' ? 'amber' : sev === 'notice' ? 'cyan' : 'dim'
}

export function TopBar() {
  const events = useEvents(12)
  const simTime = useSimTime()
  const paused = useGameStore((s) => s.engine?.clock.paused ?? false)
  const speed = useGameStore((s) => s.engine?.clock.speed ?? 1)
  const endState = useGameStore((s) => s.engine?.state.endState ?? null)
  const humanFaction = useGameStore((s) => s.humanFaction)
  const perspective = useGameStore((s) => s.perspective)
  const select = useUIStore((s) => s.select)

  const latest = events[0]
  const dossier = leakDossierForScenario(manifest)

  return (
    <header className="topbar" data-testid="topbar">
      <div className="topbar-brand">
        <span className="brand-mark" aria-hidden>◈</span>
        <span className="brand-name">
          {humanFaction === 'SPECTATOR'
            ? `AI WATCH // ${perspective === 'HYDRA' ? 'HYDRA' : 'BLACKGLASS'} VIEW`
            : humanFaction === 'BLACKGLASS'
              ? 'BLACKGLASS // CONTAINMENT'
              : 'HYDRA // DISCLOSURE'}
        </span>
        <span className="brand-sub">{dossier.codename} · {dossier.classification}</span>
      </div>

      {humanFaction === 'SPECTATOR' && (
        <div className="spectator-switch" data-testid="spectator-switch">
          <button className={perspective === 'BLACKGLASS' ? 'ctl active' : 'ctl'} onClick={() => useGameStore.setState({ perspective: 'BLACKGLASS' })}>
            BLACKGLASS VIEW
          </button>
          <button className={perspective === 'HYDRA' ? 'ctl active' : 'ctl'} onClick={() => useGameStore.setState({ perspective: 'HYDRA' })}>
            HYDRA VIEW
          </button>
        </div>
      )}

      {latest && (
        <div className="alert-strip" data-testid="alert-strip" onClick={() => latest.subjects[0] && select(latest.subjects[0])} role="button" tabIndex={0}>
          <Badge tone={severityTone(latest.severity)}>{latest.severity.toUpperCase()}</Badge>
          <span className="alert-msg">{latest.message}</span>
          <span className="alert-time">{formatSimTime(latest.simTime)}</span>
          <span className="alert-src" title={`source: ${latest.provenance.source} · ${latest.provenance.reason}`}>
            {latest.provenance.source}
          </span>
        </div>
      )}

      {endState && endState.kind !== 'none' && (
        <Badge tone="red">MISSION {endState.kind.toUpperCase()}</Badge>
      )}

      <div className="clockbar">
        <span className="clock" title="simulation time">{formatSimTime(simTime)}</span>
        <button
          className={paused ? 'ctl active' : 'ctl'}
          onClick={() => {
            useGameStore.getState().engine?.clock.togglePause()
            useGameStore.getState().touch()
          }}
          title="Pause (Space)"
        >
          {paused ? '▶' : '❚❚'}
        </button>
        {([1, 2, 5] as const).map((s) => (
          <button key={s} className={speed === s && !paused ? 'ctl active' : 'ctl'} onClick={() => playerActions.setSpeed(s)} title={`Speed ${s}×`}>
            {s}×
          </button>
        ))}
        <button
          className="ctl"
          title="Advance to next critical event"
          onClick={() => {
            useGameStore.getState().engine?.advanceToNextEvent()
            useGameStore.getState().touch()
          }}
        >
          ⇥
        </button>
      </div>
    </header>
  )
}
