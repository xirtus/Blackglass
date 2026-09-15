# Street Operations

Street Operations is the person-scale sector between the real city atlas and
the internal records-room plan. Enter it by selecting any non-records hotspot
on a city map, or use the `STREET` scale control.

## Vertical slice

- Mixamo-rigged field operative with Idle, Walk, and Run blending
- `WASD` movement, run modifier, right-drag orbit, wheel zoom
- seeded HumanKit pedestrians with stable IDs and walking routes
- direct person selection in the 3D scene
- identity, account, device, affiliation, message, and knowledge resolution
- autonomous patrol and identity resolution during AI Watch
- Stadia Maps/OpenStreetMap tile underlay anchored to the selected hotspot coordinates

The implementation follows the 3JSE sector-hub and geospatial-surveillance
recipes: persistent city/hotspot context, deterministic agents, an explicit
transition back to the atlas, and visual/browser evidence before completion.
