/**
 * Keyboard workflow (10-ui-hud): pause, speed, pin, focus, back, palette.
 */
import { useEffect } from 'react'
import { playerActions, useGameStore } from '@/store/game'
import { useUIStore } from '@/store/ui'

export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useUIStore.getState().setPalette(true)
        return
      }
      if (e.key === 'Escape') {
        const ui = useUIStore.getState()
        if (ui.paletteOpen) ui.setPalette(false)
        else ui.select(null)
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      const { phase } = useGameStore.getState()
      if (phase !== 'play') return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          useGameStore.getState().engine?.clock.togglePause()
          useGameStore.getState().touch()
          break
        case '1':
          playerActions.setSpeed(1)
          break
        case '2':
          playerActions.setSpeed(2)
          break
        case '3':
          playerActions.setSpeed(5)
          break
        case 'p': {
          const sel = useUIStore.getState().selectedId
          if (sel) useUIStore.getState().togglePin(sel)
          break
        }
        case 'b':
          useUIStore.getState().select(null)
          break
        case 'f': {
          const sel = useUIStore.getState().selectedId
          const engine = useGameStore.getState().engine
          if (sel && engine) {
            const p = engine.state.entities.people.get(sel)
            if (p) {
              window.dispatchEvent(new CustomEvent('bg:focus-entity', { detail: { x: p.pos.x, z: p.pos.z } }))
            }
          }
          break
        }
        case 'g':
          useUIStore.getState().setDebug(!useUIStore.getState().debugOpen)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
