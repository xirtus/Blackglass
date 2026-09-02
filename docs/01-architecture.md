# 01 — Technical Architecture

Implementation of [`site/11-tech-stack.html`](../site/11-tech-stack.html).

## Layer map

```
React UI / command layer (src/ui, src/store)
│
├── zustand stores (session / ui) — presentation state only
├── command bus (src/core/commands.ts) — the only mutation path
│
├── GameEngine (src/sim/engine.ts) — authoritative host
│   ├── fixed-step clock (src/core/clock.ts)
│   ├── named RNG streams (src/core/rng.ts)
│   ├── systems (src/sim/systems.ts) — schedule, movement, contact,
│   │   handoff, observation, confidence decay, anomaly, hydra,
│   │   intervention, end-state
│   ├── synthetic life generator (src/sim/life.ts)
│   ├── intervention catalog (src/data/interventions.json)
│   └── controllers (src/sim/controllers.ts) — human + bounded AI
│
├── perspective policy (src/sim/perspective.ts)
│   └── selectVisibleState → BlackglassView | HydraView | OmniscientView
│
├── geographic presentation (src/three/) — R3F + drei
│   ├── GeoProvider contract (src/three/geo.ts) — flat now, MapLibre later
│   ├── MapBackdropLayer (procedural GIS texture), WorldLayer (roads,
│   │   buildings, labels), AgentLayer (instanced), SurveillanceLayer
│   │   (source towers/sweep/beams), CoverageLayer (BG only), SelectionLayer
│   └── MapCanvas (orthographic map camera, pan/zoom)
│
└── intelligence presentation (src/ui/) — semantic DOM HUD
```

## Contracts that must survive refactors

1. **Simulation is the source of truth.** A Three.js `Object3D` is never
   an authoritative agent record (`src/sim/types.ts`, engine test).
2. **Commands only.** Player and AI actions are timestamped, faction-scoped
   commands validated against the same rules, then logged for replay
   (`src/core/commands.ts`, `GameEngine.issueCommand`).
3. **Deterministic RNG streams per subsystem.** Adding a cosmetic draw
   cannot reshuffle the world (`src/core/rng.ts`, tested).
4. **Perspective isolation.** `selectVisibleState` constructs view models
   field-by-field; UI selectors never read raw simulation state for
   gameplay data. Tested by key-set assertions in
   `src/sim/perspective.test.ts`.
5. **Versioned saves.** `SAVE_SCHEMA_VERSION` + migration registry +
   checksum (`src/core/save.ts`, tested).
6. **Fixed-step sim, free-step presentation.** The engine steps at 0.25 s
   sim-time; React renders at frame rate from view models.

## Geographic seam (Phase 2)

`src/three/geo.ts` defines `GeoProvider { toLocal, fromLocal, metersPerUnit }`.
Phase 1 ships `FlatGeoProvider` for the local meter-space map. Phase 2 adds
MapLibre GL JS + react-map-gl with a react-three-map-style bridge
implementing the same contract; all layers already consume the contract,
so the swap does not touch simulation or HUD code. `docs/08-roadmap.md`
lists the exact integration steps.

## Performance budgets honored by the harness

- Instanced agents: one draw call for the whole population (`AgentLayer`).
- No per-agent React components; no skinned meshes.
- Event log ring buffer (`EventLog.MAX_IN_MEMORY`) prevents unbounded
  memory in long runs.
- Simulation is worker-ready: the engine is pure TS; `src/workers/` keeps
  the message protocol seam alive (tested against the inline path).
- Quality tiers lower DPR/antialiasing without touching simulation truth.
