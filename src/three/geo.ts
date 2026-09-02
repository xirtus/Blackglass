/**
 * Geographic projection contract (08-world-maps).
 *
 * Phase 1 (this harness): a flat local meter-space grid — `FlatGeoProvider`.
 * Phase 2: MapLibre/react-map-gl + a maintained react-three-map-style
 * bridge implement the same interface for lon/lat-anchored city content.
 * Rendering code depends on this interface only, so Phase 2 slots in
 * without touching layers or the simulation.
 */
import type { Vec2 } from '@/sim/types'

export interface GeoProvider {
  readonly kind: 'flat' | 'maplibre'
  /** Local meters from a geo coordinate. */
  toLocal(lon: number, lat: number): Vec2
  /** Geo coordinate from local meters. */
  fromLocal(pos: Vec2): [number, number]
  /** Meters per unit of the provider's native space (1 for flat). */
  readonly metersPerUnit: number
}

export class FlatGeoProvider implements GeoProvider {
  readonly kind = 'flat' as const
  readonly metersPerUnit = 1

  toLocal(lon: number, lat: number): Vec2 {
    // Approximate equirectangular around the scenario center for tooltips.
    return { x: lon * 111_320, z: -lat * 110_574 }
  }

  fromLocal(pos: Vec2): [number, number] {
    return [pos.x / 111_320, -pos.z / 110_574]
  }
}

/**
 * Phase 2 note: a MapLibreGeoProvider would wrap the map's camera/projection,
 * exposing the same two methods with a real CRS. The contract above is the
 * seam — see docs/01-architecture.md.
 */
export const geoProvider: GeoProvider = new FlatGeoProvider()
