/** ⌘K command palette — keyboard-first workflow (10-ui-hud). */
import { useMemo, useState } from 'react'
import { playerActions, useGameStore } from '@/store/game'
import { useUIStore, type PanelId } from '@/store/ui'

interface PaletteItem {
  id: string
  label: string
  hint: string
  run: () => void
}

export function CommandPalette() {
  const open = useUIStore((s) => s.paletteOpen)
  const setPalette = useUIStore((s) => s.setPalette)
  if (!open) return null
  // Keyed inner component remounts fresh on each open — query/cursor reset
  // without effects.
  return <PaletteInner setPalette={setPalette} />
}

function PaletteInner({ setPalette }: { setPalette: (open: boolean) => void }) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const items = useMemo<PaletteItem[]>(() => {
    const engine = useGameStore.getState().engine
    const out: PaletteItem[] = []
    if (!engine) return out

    out.push(
      { id: 'pause', label: 'Pause / resume', hint: 'Space', run: () => engine.clock.togglePause() },
      { id: 'speed1', label: 'Speed 1×', hint: '1', run: () => playerActions.setSpeed(1) },
      { id: 'speed2', label: 'Speed 2×', hint: '2', run: () => playerActions.setSpeed(2) },
      { id: 'speed5', label: 'Speed 5×', hint: '3', run: () => playerActions.setSpeed(5) },
      { id: 'next', label: 'Advance to next critical event', hint: '⇥', run: () => engine.advanceToNextEvent() },
      { id: 'save', label: 'Save game', hint: '', run: () => void useGameStore.getState().saveGame() },
      { id: 'quit', label: 'Quit to title', hint: '', run: () => useGameStore.getState().quitToTitle() },
    )

    const panels: PanelId[] = ['watchIndex', 'trustedNetwork', 'dossier', 'genealogy', 'timeline', 'hypotheses', 'interventions', 'resources', 'public', 'osint', 'graph']
    for (const p of panels) {
      out.push({ id: `panel.${p}`, label: `Toggle panel: ${p}`, hint: '', run: () => useUIStore.getState().toggleCollapse(p) })
    }
    out.push({ id: 'debug', label: 'Toggle debug overlay', hint: 'G', run: () => useUIStore.getState().setDebug(!useUIStore.getState().debugOpen) })

    // Entity search
    for (const p of engine.state.entities.people.all()) {
      out.push({
        id: `person.${p.id}`,
        label: `${p.name} — ${p.occupation}`,
        hint: 'PERSON',
        run: () => useUIStore.getState().select(p.id),
      })
    }
    return out
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items.slice(0, 24)
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q)).slice(0, 24)
  }, [items, query])

  const pick = (i: PaletteItem) => {
    i.run()
    setPalette(false)
  }

  return (
    <div className="palette-backdrop" onClick={() => setPalette(false)}>
      <div className="palette" onClick={(e) => e.stopPropagation()} data-testid="command-palette">
        <input
          autoFocus
          className="palette-input"
          placeholder="Type a command or person…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCursor((c) => Math.min(filtered.length - 1, c + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => Math.max(0, c - 1))
            } else if (e.key === 'Enter' && filtered[cursor]) {
              pick(filtered[cursor])
            } else if (e.key === 'Escape') {
              setPalette(false)
            }
          }}
        />
        <ul className="palette-list">
          {filtered.map((i, idx) => (
            <li key={i.id} className={idx === cursor ? 'palette-item active' : 'palette-item'} onMouseEnter={() => setCursor(idx)} onClick={() => pick(i)}>
              <span className="palette-label">{i.label}</span>
              <span className="palette-hint">{i.hint}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
