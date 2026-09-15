# 07 — Scenario Spec

Implementation of [`site/12-content-pipeline.html`](../site/12-content-pipeline.html).

## Manifest schema

See `src/sim/scenario.ts` (`ScenarioManifest`). Shipped scenario:
`src/data/scenarios/dc_archive_01.json` — a restricted public records
annex ("Meridian Annex"), 24 explicit lives + background aggregate,
one carrier, six watch circles, 12 interventions, 25-minute window.

## Generation pipeline

`load geo → build graph → generate lives → place heroes → seed archive →
spawn observations → validate`. The harness covers steps 2–5 for the
flat map; geo loading is the Phase 2 MapLibre step.

## Validation contract

`validateScenario` fails on: broken road node references, unknown origin
location, non-positive population/bytes/duration, empty intervention list.
Additional engine-level checks: hero reachability on the graph, catalog
references exist, interventions target valid categories — all tested.

## Mod path

Manifests are JSON data consumed through a validated loader; new
scenarios are added by dropping a JSON file into `src/data/scenarios/`
and registering it in `src/data/scenarios.ts`. Simulation core is not
modified per scenario. An external editor can later expose map center,
hero placement, leak parameters, surveillance density and scripted beats.
