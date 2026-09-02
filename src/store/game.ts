/**
 * Session store: engine lifecycle, phase, perspective, save/load.
 * The engine is authoritative; this store is a thin React-facing shell.
 */
import { create } from 'zustand'
import { makeCommand, type Difficulty, type FactionId, type Perspective } from '@/core/commands'
import { indexedDbSaveAdapter, memorySaveAdapter, type SaveAdapter } from '@/core/save'
import type { ScenarioManifest } from '@/sim/scenario'
import { GameEngine } from '@/sim/engine'
import { manifest as defaultManifest } from '@/data/scenarios'
import type { ViewModel } from '@/sim/perspective'
import type { CopyForm, PersonStatus } from '@/sim/types'

export type Phase = 'title' | 'play' | 'replay'
export type SessionMode = FactionId | 'SPECTATOR'

interface GameStore {
  phase: Phase
  engine: GameEngine | null
  version: number
  perspective: Perspective
  humanFaction: SessionMode
  difficulty: Difficulty
  adapter: SaveAdapter
  saveStatus: 'idle' | 'saving' | 'saved' | 'error' | 'loaded'
  lastError: string | null

  startGame: (manifest?: ScenarioManifest) => void
  endGame: () => void
  quitToTitle: () => void
  saveGame: () => Promise<void>
  loadGame: () => Promise<void>
  view: () => ViewModel | null
  /** Re-render UI after a direct clock mutation (pause/speed are
   *  presentation-layer controls; sim determinism is unaffected). */
  touch: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'title',
  engine: null,
  version: 0,
  perspective: 'BLACKGLASS',
  humanFaction: 'BLACKGLASS',
  difficulty: 'operator',
  adapter:
    typeof indexedDB !== 'undefined'
      ? indexedDbSaveAdapter()
      : (memorySaveAdapter() as SaveAdapter),
  saveStatus: 'idle',
  lastError: null,

  startGame: (manifest = defaultManifest) => {
    const { perspective, humanFaction, difficulty } = get()
    const engine = GameEngine.create(manifest, {
      perspective,
      humanFaction,
      difficulty,
    })
    engine.subscribe((e) => {
      set({ version: e.versionCount, engine: e })
    })
    set({ engine, version: engine.versionCount, phase: 'play', saveStatus: 'idle', lastError: null })
  },

  endGame: () => {
    set({ phase: 'replay' })
  },

  quitToTitle: () => {
    set({ engine: null, phase: 'title', saveStatus: 'idle' })
  },

  saveGame: async () => {
    const engine = get().engine
    if (!engine) return
    set({ saveStatus: 'saving' })
    try {
      await get().adapter.save(engine.toSaveJson())
      set({ saveStatus: 'saved' })
    } catch (e) {
      set({ saveStatus: 'error', lastError: String(e) })
    }
  },

  loadGame: async () => {
    const adapter = get().adapter
    try {
      const json = await adapter.load()
      if (!json) {
        set({ saveStatus: 'error', lastError: 'No save found' })
        return
      }
      const { perspective, humanFaction, difficulty } = get()
      const engine = GameEngine.fromSaveJson(json, defaultManifest, { perspective, humanFaction, difficulty })
      engine.subscribe((e) => set({ version: e.versionCount, engine: e }))
      set({ engine, version: engine.versionCount, phase: 'play', saveStatus: 'loaded', lastError: null })
    } catch (e) {
      set({ saveStatus: 'error', lastError: String(e) })
    }
  },

  view: () => {
    const engine = get().engine
    return engine ? engine.viewModel(get().perspective) : null
  },

  touch: () => set((s) => ({ version: s.version + 1 })),
}))

/* ------------------------------------------------------------------ */
/* Command helpers — every player action is a logged command           */
/* ------------------------------------------------------------------ */

function issue(body: Parameters<typeof makeCommand>[3]): void {
  const { engine, humanFaction } = useGameStore.getState()
  if (!engine) return
  const faction: FactionId = humanFaction === 'SPECTATOR' ? 'BLACKGLASS' : humanFaction
  if (humanFaction === 'SPECTATOR' && !body.kind.startsWith('clock.')) return
  engine.issueCommand(makeCommand(engine.state.simTime, 'human', faction, body))
}

export const playerActions = {
  setSpeed: (speed: 0 | 1 | 2 | 5) => issue({ kind: 'clock.setSpeed', speed }),
  setPaused: (paused: boolean) => issue({ kind: 'clock.pause', paused }),
  watchCircle: (circleId: string, level: number) => issue({ kind: 'bg.watchCircle', circleId, level }),
  unwatchCircle: (circleId: string) => issue({ kind: 'bg.unwatchCircle', circleId }),
  intervene: (interventionId: string, targetIds: string[]) => issue({ kind: 'bg.intervene', interventionId, targetIds }),
  pin: (subjectId: string) => issue({ kind: 'bg.pin', subjectId }),
  hypothesize: (subjectId: string, relation: 'carrier' | 'recipient' | 'path' | 'source' | 'other', note: string) =>
    issue({ kind: 'bg.hypothesize', subjectId, relation, note }),
  contact: (personId: string) => issue({ kind: 'hydra.contact', personId }),
  duplicate: (copyId: string, form: CopyForm, targetPersonId?: string) => issue({ kind: 'hydra.duplicate', copyId, form, targetPersonId }),
  authenticate: (copyId: string) => issue({ kind: 'hydra.authenticate', copyId }),
  release: (copyId: string, scope: 'limited' | 'staged' | 'public') => issue({ kind: 'hydra.release', copyId, scope }),
  abandonBranch: (copyId: string) => issue({ kind: 'hydra.abandonBranch', copyId }),
  transferControl: (copyId: string, personId: string) => issue({ kind: 'hydra.transferControl', copyId, personId }),
  shield: (personId: string) => issue({ kind: 'hydra.shield', personId }),
  decoy: (personId: string) => issue({ kind: 'hydra.decoy', personId }),
}

export function personStatusLabel(status: PersonStatus): string {
  return { free: 'FREE', detained: 'DETAINED', unreachable: 'UNREACHABLE', inactive: 'INACTIVE' }[status]
}

/* ------------------------------------------------------------------ */
/* React-facing hooks                                                  */
/* ------------------------------------------------------------------ */

export function useView(): ViewModel | null {
  const engine = useGameStore((s) => s.engine)
  const perspective = useGameStore((s) => s.perspective)
  const version = useGameStore((s) => s.version)
  // The engine mutates in place; version is the React-facing tick.
  void version
  return engine?.viewModel(perspective) ?? null
}

export function useEvents(limit = 80) {
  const engine = useGameStore((s) => s.engine)
  const version = useGameStore((s) => s.version)
  void version
  return engine?.log.all().slice(-limit).reverse() ?? []
}

export function useSimTime(): number {
  const engine = useGameStore((s) => s.engine)
  const version = useGameStore((s) => s.version)
  void version
  return engine?.state.simTime ?? 0
}
