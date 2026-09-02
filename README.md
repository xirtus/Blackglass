# BLACKGLASS // HYDRA — game harness

OSINT Dual-perspective information-war strategy game.
**BLACKGLASS // CONTAINMENT** (the fictional intelligence platform trying
to suppress a leak) vs **HYDRA // DISCLOSURE** (the disclosure network
trying to make credible information impossible to contain). Both play the
*same* deterministic world — only visibility, commands and goals differ.

This repository is the **Phase 0/1 harness** that executes the design
bible in [`site/`](./site/index.html) (read the master build prompt in
[`site/16-prompt.html`](./site/16-prompt.html)). All surveillance data is
synthetic; private locations are fictionalized; harmful procedures are
abstract strategic commands only.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + property + perspective-isolation tests
npm run test:e2e   # Playwright smoke suite (installs browser on first run)
npm run build      # production build → dist/
npm run asset:gate # license gate for external assets
```

Controls: `Space` pause · `1/2/3` speed · `⌘K` command palette · `P` pin ·
`B` deselect · `F` focus camera · `G` debug overlay.

## What the harness contains

- **Simulation** (`src/sim/`) — authoritative, deterministic, worker-ready.
  Synthetic life generator, fixed-step systems (movement, contact,
  handoff → descendant copies, observations, confidence decay, ATHENA/
  ORACLE/JANUS anomaly models, Hydra aggregation + Streisand feedback,
  interventions, end states), data-driven intervention catalog, metrics.
- **Command bus** (`src/core/commands.ts`) — the only mutation path;
  a scenario seed + command log + versioned rules reproduce any run.
- **Perspective policy** (`src/sim/perspective.ts`) — strict
  `selectVisibleState` view models; UI and AI never read hidden truth
  (key-set isolation tests prove it).
- **Three.js layer** (`src/three/`) — R3F + drei orthographic map camera,
  instanced agent markers, roads/buildings from manifest data, selection
  rings/trails, BLACKGLASS-only coverage rings. GeoProvider seam ready
  for the Phase 2 MapLibre bridge.
- **DOM HUD** (`src/ui/`) — alert strip, Watch Index / Trusted Network,
  dossier, timeline, social graph, copy genealogy, analyst board,
  intervention drawer / disclosure actions, resources, public monitor,
  command palette, keyboard workflow, omniscient replay screen.
- **Saves** (`src/core/save.ts`) — versioned schema, migration registry,
  checksum, IndexedDB + memory adapters.
- **Tests** — deterministic RNG, save migration, life generation,
  genealogy invariants, Hydra math, intervention validation, replay
  equivalence, perspective isolation; Playwright smoke + screenshots.
- **Docs** — `docs/01-architecture.md` … `docs/08-roadmap.md`.

## Repository layout

```
site/    design bible (the plan, static microsite)
docs/    implementation architecture + specs
src/     game harness (sim → perspective → three → ui)
e2e/     Playwright smoke suite
scripts/ asset license gate
```

## Deploy

`npm run build` → `dist/`. Netlify (`netlify.toml`) and Vercel
(`vercel.json`) configs included. The `site/` design bible deploys
separately as a plain static folder.

## Safety / fiction boundary

Fictional satirical game. Synthetic data only; no real surveillance
systems, private data, or real floor plans. Kinetic interventions are
abstract commands with no operational detail; black-program systems are
deliberately science-fictional. See `site/15-legal-content.html`.
