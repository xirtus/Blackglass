/** Title screen — perspective selection (Phase 1B contract). */
import { useGameStore, type SessionMode } from '@/store/game'
import type { Difficulty, FactionId } from '@/core/commands'
import { useUIStore } from '@/store/ui'
import { manifest } from '@/data/scenarios'
import { leakDossierForScenario } from '@/data/leakDossiers'

export function TitleScreen() {
  const startGame = useGameStore((s) => s.startGame)
  const loadGame = useGameStore((s) => s.loadGame)
  const saveStatus = useGameStore((s) => s.saveStatus)
  const lastError = useGameStore((s) => s.lastError)
  const humanFaction = useGameStore((s) => s.humanFaction)
  const difficulty = useGameStore((s) => s.difficulty)
  const set = useGameStore.setState
  const quality = useUIStore((s) => s.quality)
  const setQuality = useUIStore((s) => s.setQuality)
  const dossier = leakDossierForScenario(manifest)

  const pick = (faction: FactionId) => {
    set({ humanFaction: faction, perspective: faction })
  }

  const pickSpectator = () => {
    set({ humanFaction: 'SPECTATOR', perspective: 'BLACKGLASS' })
  }

  const missionLabel = (mode: SessionMode) => (mode === 'SPECTATOR' ? 'AI VS AI WATCH' : `${mode} MISSION`)

  return (
    <div className="title-screen" data-testid="title-screen">
      <div className="title-inner">
        <p className="title-kicker">{dossier.classification} · CLASSIFIED LEAK DOSSIER · REV 1.1</p>
        <h1 className="title-word">BLACKGLASS <span className="title-sep">//</span> HYDRA</h1>
        <p className="title-sub">
          {dossier.codename}: {dossier.hook}
        </p>

        <div className="leak-teaser">
          <span>{dossier.publicMyth}</span>
          <span>{dossier.danger}</span>
          <span>{dossier.implicatedNetwork}</span>
        </div>

        <div className="perspective-cards">
          <button className={`perspective-card card-blackglass ${humanFaction === 'BLACKGLASS' ? 'card-active' : ''}`} onClick={() => pick('BLACKGLASS')} data-testid="pick-blackglass">
            <span className="card-title">CONTAINMENT</span>
            <span className="card-desc">
              Operate the intelligence platform. Infer carriers from sensor observations, allocate scarce surveillance, and contain the archive before replication outruns you.
            </span>
            <span className="card-tags">OBSERVE · INFER · INTERVENE</span>
          </button>
          <button className={`perspective-card card-hydra ${humanFaction === 'HYDRA' ? 'card-active' : ''}`} onClick={() => pick('HYDRA')} data-testid="pick-hydra">
            <span className="card-title">DISCLOSURE</span>
            <span className="card-desc">
              Control the disclosure network. Choose whom to trust, duplicate credible archive forms, and release so the information becomes impossible to contain — under imperfect pressure.
            </span>
            <span className="card-tags">TRUST · REPLICATE · RELEASE</span>
          </button>
          <button className={`perspective-card card-spectator ${humanFaction === 'SPECTATOR' ? 'card-active' : ''}`} onClick={pickSpectator} data-testid="pick-spectator">
            <span className="card-title">AI WATCH</span>
            <span className="card-desc">
              Watch both bounded faction controllers play the same deterministic crisis. Swap workstations while the crisis resolves through observations, OSINT signals, interventions and releases.
            </span>
            <span className="card-tags">MODEL · OBSERVE · REPLAY</span>
          </button>
        </div>

        <div className="title-options">
          <div className="option-row">
            <span className="option-label">DIFFICULTY</span>
            {(['analyst', 'operator', 'director'] as Difficulty[]).map((d) => (
              <button key={d} className={difficulty === d ? 'ctl active' : 'ctl'} onClick={() => set({ difficulty: d })}>
                {d.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="option-row">
            <span className="option-label">QUALITY</span>
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button key={q} className={quality === q ? 'ctl active' : 'ctl'} onClick={() => setQuality(q)}>
                {q.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="title-cta">
          <button className="btn-primary" onClick={() => startGame(manifest)} data-testid="start-game">
            START {missionLabel(humanFaction)} — {manifest.title}
          </button>
          <button className="ctl" onClick={() => void loadGame()} data-testid="load-game">
            LOAD SAVE
          </button>
        </div>
        {saveStatus === 'error' && <p className="title-error">{lastError}</p>}
        {saveStatus === 'loaded' && <p className="title-ok">Save loaded.</p>}
        <p className="title-foot">SPACE pause · 1/2/3 speed · ⌘K palette · P pin · B deselect · G debug · F focus</p>
      </div>
    </div>
  )
}
