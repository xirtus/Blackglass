# BLACKGLASS // HYDRA — Architecture Docs

Design bible: [`site/`](../site/index.html) (static microsite, rev 1.1).
Master build prompt: [`site/16-prompt.html`](../site/16-prompt.html).
This folder documents the implementation harness that executes that plan.

## What this repository is

| Path | Purpose |
| --- | --- |
| `site/` | The static game-design microsite (the plan, rev 1.1). |
| `src/` | The game harness: simulation, Three.js view, DOM HUD. |
| `docs/` | Implementation architecture + scenario/simulation specs. |
| `e2e/` | Playwright smoke suite + screenshot regression. |
| `ASSET_REGISTRY.json` | License-gated asset registry. |
| `THIRD_PARTY.md` | Dependency + prior-art license record. |

## The one-paragraph architecture

One authoritative, deterministic `SimulationState` is mutated only through
timestamped faction commands (the command bus). Systems tick at a fixed
4 Hz step; rendering subscribes to perspective-filtered view models built
by `selectVisibleState`, never to raw state. BLACKGLASS and HYDRA are
command producers over the same world; a bounded AI implements whichever
side the human does not play. A scenario seed + command log + versioned
rules reproduce any run; saves are replay inputs plus a fast-load snapshot.

## Current phase (of the production roadmap)

- **Phase 0 (done):** repository, contracts, RNG streams, command bus,
  versioned saves, license gate, test harness.
- **Phase 1 (done):** ugly-but-complete dual loop on a flat dark map —
  carrier, handoff → descendant copies, Watch Index, interventions,
  pause/speed, end states, omniscient replay.
- **Phase 1B (done):** both perspectives selectable from the title screen,
  bounded BLACKGLASS AI, HYDRA workspace + disclosure actions, control
  transfer, replay.
- **Phase 2+ (designed, not built):** MapLibre geography, synthetic
  population at 500–1,000 explicit, full HUD polish, national/global scale.
  See `08-roadmap.md`.
