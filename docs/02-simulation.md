# 02 — Simulation Spec

Implementation of [`site/04-simulation.html`](../site/04-simulation.html).

## Determinism contract

- Master seed comes from the scenario manifest (`seed: 184203`).
- Subsystems draw from named streams: `life.identity`, `life.social`,
  `life.devices`, `life.vehicles`, `life.schedule`, `sim.errand`,
  `sim.handoff`, `sim.observation`, `sim.intervention`, `sim.ids`,
  `ai.blackglass`, `ai.hydra`, `model.ATHENA|ORACLE|JANUS`.
- `RngStreams.exportState()` persists stream positions into the save
  snapshot; replays rebuild streams from the seed + command log.
- Tested: same seed → identical world; cosmetic stream consumption does
  not disturb sim streams; replay fingerprints match.

## Simulation LOD (designed; LOD0/1 active in the harness)

| LOD | Representation |
| --- | --- |
| 0 Hero | Selected/copy-holding people: full schedule + movement |
| 1 Local | Explicit people on the flat map: graph movement, events |
| 2 Regional | Designed: discrete travel/contact events (no render) |
| 3 Aggregate | Designed: compartments + sampled representatives |
| 4 Global | Designed: city/server aggregates + high-value nodes |

The harness runs all 24 explicit lives at LOD1. Promotion/demotion must
preserve causality and copy genealogy — the `InfoCopy.parentId` /
`descendants[]` structure is the invariant all future LODs keep.

## Systems (tick order)

`schedule → movement → contact → handoff → observation → confidenceDecay →
anomaly → hydra → intervention → endState`, then AI controller tick.
See `src/sim/systems.ts` for the implementation of each.

## Clocks

- **Observation clock:** sensors fire on tick-hashed periods (road 12 s,
  access 20 s, device 30 s, social 60 s, financial 180 s, aerial 900 s,
  human 240 s of sim-time).
- **Human clock:** schedules drive home/work anchors; errand draws create
  benign routine deviations — the false-positive fuel.
- **Information clock:** digital transfers outpace people; release events
  jump exposure and demand instantly.

## Traffic

Vehicles move along the road graph with speed scaled by grid state and
congestion. Signal phases/blackout congestion are Phase 2+ refinements;
the infrastructure state fields already exist.
