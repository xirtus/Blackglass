# THIRD_PARTY — licenses, prior art, reuse policy

Policy (from `site/11-tech-stack.html`): clone/fork only when the license
permits and the code materially shortens the build. For unlicensed or
ambiguous repos, study the architecture and reimplement ideas. Lock
external code to known commits and record it here. No unlicensed code is
vendored in this repository.

## Runtime dependencies

| Package | Version | License | Use |
| --- | --- | --- | --- |
| react / react-dom | ^19 | MIT | UI shell |
| three | ^0.185 | MIT | 3D presentation |
| @react-three/fiber | ^9 | MIT | React renderer for three |
| @react-three/drei | ^10 | MIT | MapControls, Grid, Line helpers |
| zustand | ^5 | MIT | presentation state |

## Runtime data/services

| Source | License / Terms | Use |
| --- | --- | --- |
| Stadia Maps Alidade Smooth raster tiles | Stadia Maps / OpenMapTiles terms; OpenStreetMap data under ODbL | Real street/world atlas backdrop with visible in-app attribution; no tiles vendored |
| hls.js CDN runtime | Apache-2.0 | HLS playback for public camera feeds that expose `.m3u8` streams |

## Character systems and assets

| Source | License / Terms | Use |
| --- | --- | --- |
| Xirtus HumanKit runtime | Project-local reusable source | Seeded civilian bodies, clothing, rigging, LODs, and animation state machine |
| Three.js `Soldier.glb` / Adobe Mixamo | Three.js MIT repository; [Adobe Mixamo royalty-free game use](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) | Field operative with embedded Idle, Walk, and Run clips; SHA-256 recorded in `ASSET_REGISTRY.json` |
| 3JSE Harness v0.1 | Project-local coordination framework | Reuse ladder, sector transition, deterministic-agent, and visual QA contracts for street operations |

## Dev dependencies

| Package | License | Use |
| --- | --- | --- |
| vite / @vitejs/plugin-react | MIT | build tooling |
| typescript | Apache-2.0 | type system |
| vitest | MIT | unit/property tests |
| @playwright/test | Apache-2.0 | browser smoke tests |
| eslint / typescript-eslint / eslint-plugin-react-hooks / eslint-plugin-react-refresh | MIT | lint |
| prettier | MIT | formatting |
| @types/* | MIT | type definitions |

## Prior art — studied, not vendored

| Repo | License status | Posture |
| --- | --- | --- |
| cartesiancs/map3d | check actual license before reuse | study OSM→R3F buildings/GLB export |
| MapLibre GL JS / react-map-gl | BSD / MIT | Phase 2 geographic foundation |
| react-three-map (maintained impls) | per-implementation | study georeferenced R3F bridge |
| NASA-AMMOS/3DTilesRendererJS | Apache-2.0 | optional streamed 3D Tiles |
| noncomputable/AgentMaps | per-repo | study agent architecture; do not adopt Leaflet as renderer |
| janarosmonaliev/pandemic-simulation | per-repo | study contact/spread prototype |
| three-forcegraph / r3f-forcegraph | MIT | future network-graph renderer |
| owenyuwono/gaia, dryad, poseidon, demiurge, apate | per-repo | procedural flora/ocean/terrain ideas for Phase 3+ |
| koala73/worldmonitor | AGPL-3.0 | adapter reference only; no vendored code |
| elm1nst3r/GHOST-osint-crm | verify before any integration | case graph/OSINT CRM concept only; no vendored code |
| WireTapper-style RF/camera discovery tooling | external social post/tool reference | local-signal concept only; no operational scanning code |
| insecam.org public camera directory | do not ingest | blocked source marker only; no scraping, embedding or proxying |
| opengeos/GeoLibre | MIT | visual/layering reference for future MapLibre mode; no vendored code |
| darwinanddavis/worldmaps | verify before any integration | cartographic style reference only; no vendored code |
| bilawalsidhu/gods-eye-view | MIT source; third-party data/assets have separate terms | surveillance/globe presentation reference only; no vendored code |
| reearth/navara | Apache-2.0 OR MIT | 3D GIS/data-visualization reference only; no vendored code |
| opengeos/leafmap | MIT | geospatial workflow reference only; no vendored code |
| opengeos/mapwidget | MIT | map UI/widget reference only; no vendored code |
| simplifaisoul/osiris | MIT | OSINT layer-stack, CCTV, and global-intelligence dashboard reference only; no vendored code or live camera feeds |

If any of the above is integrated, add it to this table with commit hash,
license text location and attribution before merge — the asset gate
enforces the same for binary assets (see `scripts/asset-gate.mjs`).
