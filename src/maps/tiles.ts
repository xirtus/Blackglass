const DEFAULT_TILE_TEMPLATE = 'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}@2x.png'

const tileTemplate = import.meta.env.VITE_MAP_TILE_TEMPLATE || DEFAULT_TILE_TEMPLATE
const stadiaApiKey = import.meta.env.VITE_STADIA_MAPS_API_KEY

export const MAP_ATTRIBUTION = 'Stadia Maps / OpenMapTiles / OpenStreetMap contributors'

export function mapTileUrl(zoom: number, x: number, y: number): string {
  const url = tileTemplate
    .replace('{z}', String(zoom))
    .replace('{x}', String(x))
    .replace('{y}', String(y))

  if (!stadiaApiKey || !url.includes('tiles.stadiamaps.com')) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}api_key=${encodeURIComponent(stadiaApiKey)}`
}
