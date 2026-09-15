# 08 — Roadmap (Phase 2 → 6)

Mirrors [`site/13-production-roadmap.html`](../site/13-production-roadmap.html).
The harness deliberately stops at the Phase 1B exit gate: the ugly
dots-and-lines mission must be strategically interesting from both sides
before geographic/presentation expansion.

## Phase 2 — D.C.-style vertical slice

1. Add `maplibre-gl` + `react-map-gl`; implement `MapLibreGeoProvider`
   against the `GeoProvider` contract in `src/three/geo.ts`.
2. OSM-derived road/building pipeline (permitted data only); swap
   `WorldLayer` inputs from manifest JSON to geo chunks.
3. Scale `generateScenarioLives` to 500–1,000 explicit + aggregates
   (the generator is already parameterized; move it into the worker).
4. Vehicles/routines/4–6 observation source types with confidence models;
   social-circle expansion; anomaly false-positive tuning.
5. Archive forms full genealogy + aggregate transition tuning.
6. 8–12 interventions across all categories (catalog already supports 9).

## Phase 3 — presentation

- Instanced/LOD population rendering (AgentLayer already instanced;
  add sprite/icon tiers + billboards).
- Procedural vegetation/weather modules; audio (alert language, UI
  clicks, radio chatter, tension layers).
- Final HUD polish: graphs (replace SVG radial with force-directed
  clustering), tooltips, full keyboard workflow, a11y audit.

## Phase 4–5 — scale

- City/state strategic map (MapLibre/deck.gl), server nodes + digital
  transfers, aggregate population mirrors, media reach, persistent
  campaign authority/trust/technology (fields exist in `CampaignState`).
- Planet/network view, copy-estimation confidence, black-program
  tree, systemic damage + endgame scoring.

## Phase 6 — content + polish

- Six-act mission ladder as manifests; hero actors; balancing passes on
  model accuracy/false positives/intervention costs/Hydra growth.
- Accessibility, tutorialization, localization-ready strings, save
  migration coverage, profiling + deployment hardening.

## Non-negotiable build order (unchanged)

SIMULATION truth → DEBUG UI → PLAYER UI → MAP/LOD → ASSETS → SPECTACLE.
