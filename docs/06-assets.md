# 06 — Asset Strategy

Implementation of [`site/09-assets.html`](../site/09-assets.html).

## Harness state

Everything visible is procedural: grid, road graph, extruded building
footprints, instanced agent dots, rings, SVG graphs. Zero external art
assets — the registry is therefore currently empty, and that is correct.

## Registry + license gate

`ASSET_REGISTRY.json` holds every external asset before import:
creator, source URL, license, attribution text, acquisition date,
modification/commercial permission, scale, triangle count, texture
memory, optimization status. `npm run asset:gate` fails CI on any entry
missing license fields or non-commercial/ND licensing without an
explicit exception. Policy: CC0/CC-BY/explicit commercial-friendly
royalty-free; ambiguous/NC/ND requires review and justification.

## Planned mix (Phase 3)

~60% procedural/geographic, ~30% licensed library (target 250–350 bases),
~10% custom hero assets. LOD ladder: `GLOBAL aggregate → CITY icon →
STREET instanced → SELECTED rigged GLB → CINEMATIC hero`.
Prior-art study targets and their license posture are recorded in
`THIRD_PARTY.md`.
