export interface AtlasPoint {
  lat: number
  lon: number
}

export type AtlasHotspotKind = 'records' | 'civic' | 'media' | 'transit' | 'diplomatic'

export interface AtlasHotspot extends AtlasPoint {
  id: string
  label: string
  sublabel: string
  kind: AtlasHotspotKind
  opensRoom?: boolean
}

export interface AtlasCamera extends AtlasPoint {
  id: string
  label: string
  operator: string
  type: 'traffic' | 'civic' | 'press' | 'port' | 'transit'
  status: 'live' | 'delayed' | 'metadata'
  heading: number
  fov: number
  range: number
  sourceUrl?: string
  feedUrl?: string
  imageUrl?: string
  mediaType?: 'video' | 'image' | 'hls' | 'metadata'
}

export interface AtlasCameraSource {
  name: string
  url: string
  geoJsonUrl?: string
  apiJsonUrl?: string
  livePageUrl?: string
  access: 'official-open-data' | 'public-live-page' | 'public-directory'
  license: string
}

export interface AtlasLocation extends AtlasPoint {
  id: string
  label: string
  country: string
  zoom: number
  roomLabel: string
  briefing: string
  cameraSource: AtlasCameraSource
  hotspots: AtlasHotspot[]
  cameras: AtlasCamera[]
}

export const ATLAS_LOCATIONS: AtlasLocation[] = [
  {
    id: 'dc',
    label: 'Washington DC',
    country: 'US',
    lat: 38.8895,
    lon: -77.0353,
    zoom: 14,
    roomLabel: 'Meridian Annex',
    briefing: 'National Mall public-records corridor, archive access, agency-adjacent traffic.',
    cameraSource: {
      name: 'DCGIS Closed Circuit TV Street Cameras',
      url: 'https://catalog.data.gov/dataset/closed-circuit-tv-street-cameras',
      geoJsonUrl: 'https://opendata.dc.gov/api/download/v1/items/2bb8375e31a94067a17911ea70f917ef/geojson?layers=11',
      livePageUrl: 'https://opencctv.org/cameras/united-states/maryland/wash-dc/category/traffic',
      access: 'official-open-data',
      license: 'CC BY 4.0',
    },
    hotspots: [
      { id: 'dc-records', label: 'Meridian Annex', sublabel: 'records room', kind: 'records', lat: 38.8977, lon: -77.0365, opensRoom: true },
      { id: 'dc-mall', label: 'National Mall', sublabel: 'public crowd layer', kind: 'civic', lat: 38.8899, lon: -77.0091 },
      { id: 'dc-union', label: 'Union Station', sublabel: 'transit exits', kind: 'transit', lat: 38.8973, lon: -77.0064 },
      { id: 'dc-press', label: 'Press Row', sublabel: 'media relay', kind: 'media', lat: 38.9021, lon: -77.0438 },
    ],
    cameras: [
      { id: 'cam-dc-constitution', label: 'Constitution Ave Cam', operator: 'DCGIS / DDOT', type: 'traffic', status: 'metadata', lat: 38.8924, lon: -77.0282, heading: 96, fov: 54, range: 540 },
      { id: 'cam-dc-union', label: 'Union Station Plaza', operator: 'transit concourse', type: 'transit', status: 'delayed', lat: 38.8971, lon: -77.0062, heading: 244, fov: 62, range: 420 },
      { id: 'cam-dc-mall', label: 'Mall Event Mast', operator: 'DCGIS / DDOT', type: 'civic', status: 'metadata', lat: 38.8895, lon: -77.0230, heading: 278, fov: 74, range: 620 },
    ],
  },
  {
    id: 'london',
    label: 'London',
    country: 'UK',
    lat: 51.5074,
    lon: -0.1278,
    zoom: 13,
    roomLabel: 'Thames Stack',
    briefing: 'Westminster, diplomatic crossings, newsroom relays, dense camera coverage.',
    cameraSource: {
      name: 'Transport for London JamCams',
      url: 'https://tfl.gov.uk/info-for/open-data-users/our-open-data?intcmp=3671',
      apiJsonUrl: 'https://api.tfl.gov.uk/Place/Type/JamCam/',
      access: 'official-open-data',
      license: 'TfL Open Data terms',
    },
    hotspots: [
      { id: 'lon-records', label: 'Thames Stack', sublabel: 'document cache', kind: 'records', lat: 51.5007, lon: -0.1246, opensRoom: true },
      { id: 'lon-waterloo', label: 'Waterloo', sublabel: 'rail interchange', kind: 'transit', lat: 51.5033, lon: -0.1147 },
      { id: 'lon-fleet', label: 'Fleet Street', sublabel: 'press corridor', kind: 'media', lat: 51.5141, lon: -0.1084 },
      { id: 'lon-embassy', label: 'Diplomatic Quarter', sublabel: 'liaison nodes', kind: 'diplomatic', lat: 51.4995, lon: -0.1547 },
    ],
    cameras: [
      {
        id: 'cam-lon-piccadilly',
        label: 'Piccadilly Circus',
        operator: 'TfL JamCams',
        type: 'traffic',
        status: 'live',
        lat: 51.5096,
        lon: -0.13484,
        heading: 310,
        fov: 56,
        range: 520,
        sourceUrl: 'https://api.tfl.gov.uk/Place/Type/JamCam/',
        feedUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.07450.mp4',
        imageUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.07450.jpg',
        mediaType: 'video',
      },
      { id: 'cam-lon-waterloo', label: 'Waterloo Approach', operator: 'rail estate', type: 'transit', status: 'delayed', lat: 51.5034, lon: -0.1135, heading: 194, fov: 64, range: 430 },
      {
        id: 'cam-lon-horseferry',
        label: 'Horseferry Rd / Marsham St',
        operator: 'TfL JamCams',
        type: 'traffic',
        status: 'live',
        lat: 51.4949,
        lon: -0.12891,
        heading: 82,
        fov: 48,
        range: 700,
        sourceUrl: 'https://api.tfl.gov.uk/Place/Type/JamCam/',
        feedUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.04235.mp4',
        imageUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.04235.jpg',
        mediaType: 'video',
      },
    ],
  },
  {
    id: 'vatican',
    label: 'Vatican City',
    country: 'VA',
    lat: 41.9029,
    lon: 12.4534,
    zoom: 15,
    roomLabel: 'Archivio Relay',
    briefing: 'Compact sovereign enclave, church archives, embassy approaches, tourist masking.',
    cameraSource: {
      name: 'St Peter Square public live camera page',
      url: 'https://earthlive.tv/all-cams/GsYf1RRDtcE-st-peter-s-square-vatican-city',
      livePageUrl: 'https://earthlive.tv/all-cams/GsYf1RRDtcE-st-peter-s-square-vatican-city',
      access: 'public-live-page',
      license: 'source page terms',
    },
    hotspots: [
      { id: 'vat-records', label: 'Archivio Relay', sublabel: 'catalog room', kind: 'records', lat: 41.9041, lon: 12.4546, opensRoom: true },
      { id: 'vat-square', label: 'St Peter Square', sublabel: 'public cover', kind: 'civic', lat: 41.9022, lon: 12.4573 },
      { id: 'vat-rail', label: 'Vatican Rail Gate', sublabel: 'service transit', kind: 'transit', lat: 41.9019, lon: 12.4478 },
    ],
    cameras: [
      { id: 'cam-vat-square', label: 'St Peter Square Live', operator: 'public live page', type: 'civic', status: 'live', lat: 41.9024, lon: 12.4566, heading: 262, fov: 70, range: 360 },
      { id: 'cam-vat-gate', label: 'Service Gate', operator: 'public source map', type: 'transit', status: 'metadata', lat: 41.9020, lon: 12.4484, heading: 104, fov: 46, range: 220 },
    ],
  },
  {
    id: 'geneva',
    label: 'Geneva',
    country: 'CH',
    lat: 46.2044,
    lon: 6.1432,
    zoom: 13,
    roomLabel: 'Leman Vault',
    briefing: 'NGO, bank, and diplomatic footprint around lakefront international districts.',
    cameraSource: {
      name: 'SITG Infomobilite traffic camera catalog',
      url: 'https://sitg.ge.ch/donnees/infomob-camera',
      access: 'official-open-data',
      license: 'SITG open access',
    },
    hotspots: [
      { id: 'gev-records', label: 'Leman Vault', sublabel: 'evidence locker', kind: 'records', lat: 46.2066, lon: 6.1429, opensRoom: true },
      { id: 'gev-un', label: 'Palais Sector', sublabel: 'diplomatic mesh', kind: 'diplomatic', lat: 46.2266, lon: 6.1404 },
      { id: 'gev-cornavin', label: 'Cornavin', sublabel: 'rail station', kind: 'transit', lat: 46.2102, lon: 6.1428 },
    ],
    cameras: [
      { id: 'cam-gev-cornavin', label: 'Cornavin Forecourt', operator: 'SITG Infomobilite', type: 'transit', status: 'metadata', lat: 46.2101, lon: 6.1424, heading: 132, fov: 54, range: 350 },
      { id: 'cam-gev-lake', label: 'Leman Quay', operator: 'civic lakefront', type: 'civic', status: 'delayed', lat: 46.2070, lon: 6.1504, heading: 286, fov: 68, range: 520 },
      { id: 'cam-gev-palais', label: 'Palais Approach', operator: 'SITG Infomobilite', type: 'traffic', status: 'metadata', lat: 46.2248, lon: 6.1392, heading: 178, fov: 52, range: 460 },
    ],
  },
  {
    id: 'telaviv',
    label: 'Tel Aviv',
    country: 'IL',
    lat: 32.0853,
    lon: 34.7818,
    zoom: 13,
    roomLabel: 'Yarkon Node',
    briefing: 'Coastal tech, media, airport routes, and embassy-adjacent signal traffic.',
    cameraSource: {
      name: 'OpenCCTV Israel public camera directory',
      url: 'https://opencctv.org/cameras/israel',
      livePageUrl: 'https://opencctv.org/cameras/israel/tel-aviv/hilton-beach-yamit-marina-332854',
      access: 'public-directory',
      license: 'source page terms',
    },
    hotspots: [
      { id: 'tlv-records', label: 'Yarkon Node', sublabel: 'mirror room', kind: 'records', lat: 32.0879, lon: 34.7818, opensRoom: true },
      { id: 'tlv-savidor', label: 'Savidor Center', sublabel: 'rail hub', kind: 'transit', lat: 32.0836, lon: 34.7981 },
      { id: 'tlv-media', label: 'Media Basin', sublabel: 'broadcast relay', kind: 'media', lat: 32.0719, lon: 34.7844 },
    ],
    cameras: [
      { id: 'cam-tlv-savidor', label: 'Savidor Junction', operator: 'public camera directory', type: 'traffic', status: 'metadata', lat: 32.0838, lon: 34.7974, heading: 252, fov: 56, range: 420 },
      {
        id: 'cam-tlv-yarkon',
        label: 'Hilton Beach / Marina',
        operator: 'public webcam directory',
        type: 'civic',
        status: 'delayed',
        lat: 32.0912,
        lon: 34.7710,
        heading: 184,
        fov: 62,
        range: 480,
        sourceUrl: 'https://opencctv.org/cameras/israel/tel-aviv/hilton-beach-yamit-marina-332854',
        feedUrl: 'https://s122.ipcamlive.com/streams/7a9dnqfevb4shozpt/stream.m3u8',
        imageUrl: 'https://opencctv.org/api/feed/bcil-hilton?src=seo',
        mediaType: 'hls',
      },
      { id: 'cam-tlv-media', label: 'Broadcast Roof', operator: 'public camera directory', type: 'press', status: 'metadata', lat: 32.0717, lon: 34.7850, heading: 20, fov: 48, range: 650 },
    ],
  },
  {
    id: 'moscow',
    label: 'Moscow',
    country: 'RU',
    lat: 55.7558,
    lon: 37.6173,
    zoom: 12,
    roomLabel: 'Garden Ring Cache',
    briefing: 'Government core, metro routes, consular traffic, and state-media amplification.',
    cameraSource: {
      name: 'OpenCCTV Moscow public camera directory',
      url: 'https://opencctv.org/cameras/russia/moscow',
      livePageUrl: 'https://opencctv.org/cameras/russia/moscow',
      access: 'public-directory',
      license: 'source page terms',
    },
    hotspots: [
      { id: 'msk-records', label: 'Garden Ring Cache', sublabel: 'archive cell', kind: 'records', lat: 55.7602, lon: 37.6186, opensRoom: true },
      { id: 'msk-kremlin', label: 'Kremlin Perimeter', sublabel: 'civic core', kind: 'civic', lat: 55.7520, lon: 37.6175 },
      { id: 'msk-belorussky', label: 'Belorussky', sublabel: 'station egress', kind: 'transit', lat: 55.7767, lon: 37.5811 },
    ],
    cameras: [
      { id: 'cam-msk-tverskaya', label: 'Tverskaya Mast', operator: 'public camera directory', type: 'traffic', status: 'metadata', lat: 55.7618, lon: 37.6098, heading: 152, fov: 54, range: 620 },
      { id: 'cam-msk-belorussky', label: 'Belorussky Forecourt', operator: 'rail estate', type: 'transit', status: 'delayed', lat: 55.7762, lon: 37.5814, heading: 68, fov: 58, range: 430 },
      { id: 'cam-msk-river', label: 'River Embankment', operator: 'public camera directory', type: 'civic', status: 'metadata', lat: 55.7473, lon: 37.6230, heading: 316, fov: 66, range: 570 },
    ],
  },
  {
    id: 'petersburg',
    label: 'St Petersburg',
    country: 'RU',
    lat: 59.9311,
    lon: 30.3609,
    zoom: 12,
    roomLabel: 'Nevsky Drop',
    briefing: 'Historic archive district, port approaches, rail links, and consular relay paths.',
    cameraSource: {
      name: 'OpenCCTV Saint Petersburg public camera page',
      url: 'https://opencctv.org/cameras/russia/saint-petersburg/saint-petersburg-sky-camera-131657',
      livePageUrl: 'https://opencctv.org/cameras/russia/saint-petersburg/saint-petersburg-sky-camera-131657',
      access: 'public-directory',
      license: 'source page terms',
    },
    hotspots: [
      { id: 'spb-records', label: 'Nevsky Drop', sublabel: 'handoff room', kind: 'records', lat: 59.9343, lon: 30.3351, opensRoom: true },
      { id: 'spb-station', label: 'Moskovsky Station', sublabel: 'rail split', kind: 'transit', lat: 59.9297, lon: 30.3627 },
      { id: 'spb-palace', label: 'Palace Square', sublabel: 'public mask', kind: 'civic', lat: 59.9398, lon: 30.3146 },
    ],
    cameras: [
      {
        id: 'cam-spb-nevsky',
        label: 'Saint Petersburg Sky Camera',
        operator: 'public webcam directory',
        type: 'civic',
        status: 'delayed',
        lat: 59.9343,
        lon: 30.3351,
        heading: 118,
        fov: 56,
        range: 520,
        sourceUrl: 'https://opencctv.org/cameras/russia/saint-petersburg/saint-petersburg-sky-camera-131657',
        mediaType: 'metadata',
      },
      { id: 'cam-spb-station', label: 'Moskovsky Forecourt', operator: 'rail estate', type: 'transit', status: 'delayed', lat: 59.9296, lon: 30.3621, heading: 292, fov: 60, range: 380 },
      { id: 'cam-spb-palace', label: 'Palace Square Mast', operator: 'public camera directory', type: 'civic', status: 'metadata', lat: 59.9391, lon: 30.3158, heading: 212, fov: 70, range: 600 },
    ],
  },
]

export const DEFAULT_ATLAS_CITY_ID = 'dc'

export function getAtlasLocation(id: string | null): AtlasLocation {
  return ATLAS_LOCATIONS.find((location) => location.id === id) ?? ATLAS_LOCATIONS[0]
}
