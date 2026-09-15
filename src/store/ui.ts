/**
 * UI store: selection, pins, panel chrome, quality tiers.
 * Pure presentation state — never part of the replayable command log.
 */
import { create } from 'zustand'
import type { QualityTier } from '@/core/save'
import { DEFAULT_ATLAS_CITY_ID } from '@/data/atlasLocations'

export type AtlasScale = 'room' | 'street' | 'city' | 'world'

export type PanelId =
  | 'watchIndex'
  | 'trustedNetwork'
  | 'dossier'
  | 'genealogy'
  | 'timeline'
  | 'hypotheses'
  | 'interventions'
  | 'resources'
  | 'public'
  | 'osint'
  | 'graph'
  | 'brief'

interface UIStore {
  selectedId: string | null
  pinnedIds: string[]
  activePanel: PanelId
  collapsed: Partial<Record<PanelId, boolean>>
  paletteOpen: boolean
  quality: QualityTier
  reducedMotion: boolean
  debugOpen: boolean
  atlasScale: AtlasScale
  atlasFocusId: string | null
  atlasCityId: string
  atlasStreetHotspotId: string | null

  select: (id: string | null) => void
  togglePin: (id: string) => void
  toggleCollapse: (id: PanelId) => void
  setPalette: (open: boolean) => void
  setQuality: (q: QualityTier) => void
  setReducedMotion: (v: boolean) => void
  setDebug: (v: boolean) => void
  setActivePanel: (p: PanelId) => void
  setAtlasScale: (scale: AtlasScale) => void
  setAtlasFocus: (id: string | null) => void
  setAtlasCity: (id: string) => void
  setAtlasStreetHotspot: (id: string | null) => void
}

export const useUIStore = create<UIStore>((set) => ({
  selectedId: null,
  pinnedIds: [],
  activePanel: 'interventions',
  collapsed: {} as Partial<Record<PanelId, boolean>>,
  paletteOpen: false,
  quality: 'high',
  reducedMotion: false,
  debugOpen: false,
  atlasScale: 'city',
  atlasFocusId: null,
  atlasCityId: DEFAULT_ATLAS_CITY_ID,
  atlasStreetHotspotId: null,

  select: (id) => set({ selectedId: id }),
  togglePin: (id) =>
    set((s) => ({ pinnedIds: s.pinnedIds.includes(id) ? s.pinnedIds.filter((x) => x !== id) : [...s.pinnedIds, id] })),
  toggleCollapse: (id) => set((s) => ({ collapsed: { ...s.collapsed, [id]: !s.collapsed[id] } })),
  setPalette: (open) => set({ paletteOpen: open }),
  setQuality: (quality) => set({ quality }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setDebug: (debugOpen) => set({ debugOpen }),
  setActivePanel: (activePanel) => set({ activePanel }),
  setAtlasScale: (atlasScale) => set({ atlasScale }),
  setAtlasFocus: (atlasFocusId) => set({ atlasFocusId }),
  setAtlasCity: (atlasCityId) => set({ atlasCityId }),
  setAtlasStreetHotspot: (atlasStreetHotspotId) => set({ atlasStreetHotspotId }),
}))
