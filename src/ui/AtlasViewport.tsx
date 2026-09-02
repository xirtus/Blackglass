import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { ATLAS_LOCATIONS, getAtlasLocation, type AtlasCamera, type AtlasHotspot, type AtlasLocation } from '@/data/atlasLocations'
import type { ViewModel } from '@/sim/perspective'
import { useUIStore } from '@/store/ui'

const TILE_SIZE = 256
const WORLD_CENTER = { lat: 28, lon: 18 }
const WORLD_ZOOM = 2
const HLS_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js'

interface AtlasViewportProps {
  view: ViewModel | null
}

interface TileSpec {
  key: string
  src: string
  left: number
  top: number
}

interface TilePoint {
  x: number
  y: number
}

interface StageSize {
  width: number
  height: number
}

type InteractionMode = 'rotate' | 'pan'
type SensorMode = 'visual' | 'night' | 'thermal' | 'edge'
type RegistryStatus = 'source-records' | 'loading' | 'official-geojson' | 'official-api' | 'unavailable'

interface MapLayers {
  cctv: boolean
  viewshed: boolean
  events: boolean
  orbit: boolean
  extrusions: boolean
}

const SENSOR_MODES: { id: SensorMode; label: string }[] = [
  { id: 'visual', label: 'EO' },
  { id: 'night', label: 'NVG' },
  { id: 'thermal', label: 'FLIR' },
  { id: 'edge', label: 'EDGE' },
]

export function AtlasViewport({ view }: AtlasViewportProps) {
  const atlasScale = useUIStore((s) => s.atlasScale)
  const setAtlasScale = useUIStore((s) => s.setAtlasScale)
  const atlasCityId = useUIStore((s) => s.atlasCityId)
  const setAtlasCity = useUIStore((s) => s.setAtlasCity)
  const selectedCity = getAtlasLocation(atlasCityId)

  return (
    <div className={`atlas-viewport atlas-${atlasScale}`} data-testid="atlas-viewport">
      <div className="atlas-controls" data-testid="atlas-controls">
        {(['room', 'city', 'world'] as const).map((scale) => (
          <button key={scale} className={atlasScale === scale ? 'ctl active' : 'ctl'} onClick={() => setAtlasScale(scale)} data-testid={`atlas-${scale}`}>
            {scale.toUpperCase()}
          </button>
        ))}
      </div>

      {atlasScale === 'room' ? (
        <RecordsRoomBlueprint city={selectedCity} view={view} />
      ) : (
        <RealMapStage
          key={`${atlasScale}:${selectedCity.id}`}
          mode={atlasScale}
          selectedCity={selectedCity}
          view={view}
          onPickCity={(cityId) => {
            setAtlasCity(cityId)
            setAtlasScale('city')
          }}
          onEnterRoom={() => setAtlasScale('room')}
        />
      )}

      <CityPicker
        activeCityId={selectedCity.id}
        onPick={(cityId) => {
          setAtlasCity(cityId)
          if (atlasScale === 'room') setAtlasScale('city')
        }}
      />

      <div className="atlas-caption" data-testid="atlas-caption">
        {atlasScale === 'room' && `${selectedCity.roomLabel.toUpperCase()} // INTERNAL RECORDS-ROOM SCHEMATIC // ${selectedCity.label}`}
        {atlasScale === 'city' && `${selectedCity.label.toUpperCase()} // OpenStreetMap street atlas, click ${selectedCity.roomLabel} to enter`}
        {atlasScale === 'world' && 'WORLD OSINT ATLAS // public map tiles, global leak mirrors, city drill-down'}
      </div>
    </div>
  )
}

function CityPicker({ activeCityId, onPick }: { activeCityId: string; onPick: (cityId: string) => void }) {
  return (
    <div className="atlas-city-picker" data-testid="atlas-city-picker">
      {ATLAS_LOCATIONS.map((city) => (
        <button key={city.id} className={city.id === activeCityId ? 'atlas-city active' : 'atlas-city'} onClick={() => onPick(city.id)} data-testid={`atlas-city-${city.id}`}>
          <span>{city.label}</span>
          <small>{city.country}</small>
        </button>
      ))}
    </div>
  )
}

function RealMapStage({
  mode,
  selectedCity,
  view,
  onPickCity,
  onEnterRoom,
}: {
  mode: 'city' | 'world'
  selectedCity: AtlasLocation
  view: ViewModel | null
  onPickCity: (cityId: string) => void
  onEnterRoom: () => void
}) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ x: number; y: number; center: AtlasLocation | { lat: number; lon: number }; bearing: number } | null>(null)
  const initialCenter = mode === 'world' ? WORLD_CENTER : { lat: selectedCity.lat, lon: selectedCity.lon }
  const initialZoom = mode === 'world' ? WORLD_ZOOM : selectedCity.zoom
  const [stageSize, setStageSize] = useState<StageSize>({ width: 960, height: 540 })
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('rotate')
  const [sensorMode, setSensorMode] = useState<SensorMode>('visual')
  const [layers, setLayers] = useState<MapLayers>({ cctv: true, viewshed: true, events: true, orbit: true, extrusions: true })
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(mode === 'city' ? selectedCity.cameras[0]?.id ?? null : null)
  const [center, setCenter] = useState(initialCenter)
  const [zoom, setZoom] = useState(initialZoom)
  const [bearing, setBearing] = useState(0)

  useEffect(() => {
    const node = mapRef.current
    if (!node) return
    const resize = () => {
      const rect = node.getBoundingClientRect()
      setStageSize({ width: Math.max(320, rect.width), height: Math.max(240, rect.height) })
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const tiles = useMemo(() => buildTiles(center, zoom, stageSize), [center, zoom, stageSize])
  const markerPoints = useMemo(() => {
    if (mode === 'world') {
      return ATLAS_LOCATIONS.map((city) => ({
        id: city.id,
        label: city.label,
        sublabel: city.country,
        kind: 'diplomatic' as const,
        lat: city.lat,
        lon: city.lon,
        cityId: city.id,
      }))
    }
    return selectedCity.hotspots.map((hotspot) => ({ ...hotspot, cityId: selectedCity.id }))
  }, [mode, selectedCity])
  const registry = usePublicCameraRegistry(selectedCity, mode)
  const cameraPoints = mode === 'city' ? registry.cameras : []
  const signalPoints = useMemo(() => {
    if (!view || !('osintSignals' in view)) return []
    return view.osintSignals.slice(0, 8).map((signal, index) => {
      const offset = (index - 3.5) * 0.0018
      return {
        id: signal.id,
        label: signal.sourceKind.toUpperCase(),
        sublabel: signal.severity,
        lat: selectedCity.lat + offset,
        lon: selectedCity.lon - offset * 1.3,
      }
    })
  }, [selectedCity.lat, selectedCity.lon, view])
  const selectedCamera = cameraPoints.find((camera) => camera.id === selectedCameraId) ?? cameraPoints[0] ?? null

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, center, bearing }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (interactionMode === 'rotate') {
      setBearing(normalizeBearing(drag.bearing + dx * 0.35))
      return
    }
    const originTile = lonLatToTileFloat(drag.center, zoom)
    setCenter(tileFloatToLonLat({ x: originTile.x - dx / TILE_SIZE, y: originTile.y - dy / TILE_SIZE }, zoom))
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const minZoom = mode === 'world' ? 2 : 11
    const maxZoom = mode === 'world' ? 4 : 16
    setZoom((value) => clamp(value + (event.deltaY < 0 ? 1 : -1), minZoom, maxZoom))
  }

  return (
    <div className={`real-map-shell sensor-${sensorMode}`}>
      <div className="map-toolstrip" data-testid="map-toolstrip">
        <button className={interactionMode === 'rotate' ? 'ctl active' : 'ctl'} onClick={() => setInteractionMode('rotate')} data-testid="map-mode-rotate">
          ROTATE
        </button>
        <button className={interactionMode === 'pan' ? 'ctl active' : 'ctl'} onClick={() => setInteractionMode('pan')} data-testid="map-mode-pan">
          PAN
        </button>
        <button className="ctl" onClick={() => setBearing(0)} data-testid="map-bearing-reset">
          NORTH
        </button>
        <button className="ctl" onClick={() => setZoom((value) => clamp(value + 1, mode === 'world' ? 2 : 11, mode === 'world' ? 4 : 16))} data-testid="map-zoom-in">
          +
        </button>
        <button className="ctl" onClick={() => setZoom((value) => clamp(value - 1, mode === 'world' ? 2 : 11, mode === 'world' ? 4 : 16))} data-testid="map-zoom-out">
          -
        </button>
      </div>
      <div className="map-readout" data-testid="map-readout">
        <span>{mode === 'world' ? 'GLOBAL' : selectedCity.label}</span>
        <small>
          Z{zoom} / {Math.round(bearing)} DEG
        </small>
      </div>
      <LayerStack
        layers={layers}
        sensorMode={sensorMode}
        mode={mode}
        city={selectedCity}
        signalCount={signalPoints.length}
        onToggle={(id) => setLayers((current) => ({ ...current, [id]: !current[id] }))}
        onSensorMode={setSensorMode}
      />
      {mode === 'city' && (
        <CameraAccessPanel
          cameras={cameraPoints}
          selectedCamera={selectedCamera}
          source={selectedCity.cameraSource}
          registryStatus={registry.status}
          simTime={view?.simTime ?? 0}
          onSelect={(camera) => {
            setSelectedCameraId(camera.id)
            setCenter({ lat: camera.lat, lon: camera.lon })
            setZoom((value) => Math.max(value, 15))
            setLayers((current) => ({ ...current, cctv: true, viewshed: true }))
          }}
        />
      )}
      <div
        ref={mapRef}
        className={`real-map-stage map-${interactionMode}`}
        data-testid="real-map-stage"
        data-center={`${center.lat.toFixed(4)},${center.lon.toFixed(4)}`}
        data-bearing={bearing.toFixed(1)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div className="real-map-rotator" style={{ transform: `rotate(${bearing}deg)` }}>
          {tiles.map((tile) => (
            <img
              key={tile.key}
              className="real-map-tile"
              src={tile.src}
              style={{ left: tile.left, top: tile.top }}
              alt=""
              loading="eager"
              draggable={false}
              onError={(event) => event.currentTarget.classList.add('tile-failed')}
            />
          ))}
          <div className="map-grid-overlay" />
          {mode === 'world' && layers.orbit && <WorldOrbitOverlay />}
          {mode === 'city' && layers.extrusions && <CityExtrusionLayer city={selectedCity} center={center} zoom={zoom} size={stageSize} />}
          {layers.events && signalPoints.map((signal) => <SignalMarker key={signal.id} signal={signal} center={center} zoom={zoom} size={stageSize} bearing={bearing} />)}
          {layers.cctv &&
            cameraPoints.map((camera) => (
              <CameraMarker
                key={camera.id}
                camera={camera}
                center={center}
                zoom={zoom}
                size={stageSize}
                bearing={bearing}
                showViewshed={layers.viewshed}
                selected={camera.id === selectedCamera?.id}
                onClick={() => {
                  setSelectedCameraId(camera.id)
                  setLayers((current) => ({ ...current, cctv: true, viewshed: true }))
                }}
              />
            ))}
          {markerPoints.map((marker) => (
            <AtlasMarker
              key={marker.id}
              marker={marker}
              center={center}
              zoom={zoom}
              size={stageSize}
              bearing={bearing}
              onClick={() => {
                if (mode === 'world') onPickCity(marker.cityId)
                else if ('opensRoom' in marker && marker.opensRoom) onEnterRoom()
              }}
            />
          ))}
        </div>
      </div>
      <div className="map-attribution">OpenStreetMap contributors / public web tile layer / real public CCTV sources</div>
    </div>
  )
}

function CameraAccessPanel({
  cameras,
  selectedCamera,
  source,
  registryStatus,
  simTime,
  onSelect,
}: {
  cameras: AtlasCamera[]
  selectedCamera: AtlasCamera | null
  source: AtlasLocation['cameraSource']
  registryStatus: RegistryStatus
  simTime: number
  onSelect: (camera: AtlasCamera) => void
}) {
  const activeSourceUrl = selectedCamera?.sourceUrl ?? source.livePageUrl ?? source.url
  const media = cameraMediaFor(selectedCamera, source)
  return (
    <div className="camera-access-panel" data-testid="camera-access-panel">
      <div className="camera-access-head">
        <span>CCTV ACCESS</span>
        <small>{registryStatusLabel(registryStatus)}</small>
      </div>
      <div className="camera-feed-view" data-testid="camera-feed-view">
        {selectedCamera ? (
          <>
            <CameraMedia camera={selectedCamera} media={media} />
            <div className="feed-crosshair" />
            <div className="feed-osd">
              <span>{selectedCamera.label}</span>
              <small>
                {formatClock(simTime)} / {media.label} / {selectedCamera.status.toUpperCase()}
              </small>
            </div>
          </>
        ) : (
          <div className="feed-osd">
            <span>NO FEED</span>
            <small>CCTV layer offline</small>
          </div>
        )}
      </div>
      <div className="camera-source-row" data-testid="camera-source-row">
        <span>{source.name}</span>
        <a href={activeSourceUrl} target="_blank" rel="noreferrer" data-testid="camera-source-link">
          OPEN SOURCE
        </a>
        {source.livePageUrl && (
          <a href={source.livePageUrl} target="_blank" rel="noreferrer" data-testid="camera-live-link">
            LIVE PAGE
          </a>
        )}
      </div>
      <div className="camera-feed-meta">
        <span>HEADING {selectedCamera?.heading ?? 0} DEG</span>
        <span>FOV {selectedCamera?.fov ?? 0}</span>
        <span>RANGE {selectedCamera?.range ?? 0} M</span>
        <span>{source.license}</span>
      </div>
      <div className="camera-feed-list">
        {cameras.map((camera) => (
          <button key={camera.id} className={camera.id === selectedCamera?.id ? 'camera-feed active' : 'camera-feed'} onClick={() => onSelect(camera)} data-testid={`camera-feed-${camera.id}`}>
            <span>{camera.label}</span>
            <small>{camera.operator}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

function CameraMedia({ camera, media }: { camera: AtlasCamera; media: CameraMediaSpec }) {
  if (media.type === 'video' && media.url) {
    return <video key={media.url} className="camera-feed-media" src={media.url} poster={camera.imageUrl} autoPlay muted loop playsInline controls data-testid="camera-real-video" />
  }
  if (media.type === 'hls' && media.url) {
    return <HlsCameraVideo key={media.url} src={media.url} poster={camera.imageUrl} />
  }
  if (media.type === 'image' && media.url) {
    return <img key={media.url} className="camera-feed-media" src={media.url} alt={`${camera.label} public camera frame`} data-testid="camera-real-image" />
  }
  return (
    <div className={`camera-feed-raster feed-${camera.type}`} data-testid="camera-metadata-fallback">
      <span>NO PUBLIC MEDIA URL IN SOURCE</span>
    </div>
  )
}

function HlsCameraVideo({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let hls: HlsInstance | null = null
    let cancelled = false

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return () => {
        video.removeAttribute('src')
        video.load()
      }
    }

    loadHls()
      .then((Hls) => {
        if (cancelled || !video) return
        if (!Hls.isSupported()) {
          setFailed(true)
          return
        }
        hls = new Hls({ enableWorker: false })
        hls.loadSource(src)
        hls.attachMedia(video)
      })
      .catch(() => setFailed(true))

    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [src])

  if (failed) {
    return (
      <div className="camera-feed-raster" data-testid="camera-hls-fallback">
        <span>HLS PLAYER UNAVAILABLE - OPEN SOURCE LINK</span>
      </div>
    )
  }

  return <video ref={videoRef} className="camera-feed-media" poster={poster} autoPlay muted playsInline controls data-testid="camera-real-hls" />
}

function LayerStack({
  layers,
  sensorMode,
  mode,
  city,
  signalCount,
  onToggle,
  onSensorMode,
}: {
  layers: MapLayers
  sensorMode: SensorMode
  mode: 'city' | 'world'
  city: AtlasLocation
  signalCount: number
  onToggle: (id: keyof MapLayers) => void
  onSensorMode: (mode: SensorMode) => void
}) {
  const layerRows: { id: keyof MapLayers; label: string; count: number }[] = [
    { id: 'cctv', label: 'CCTV', count: mode === 'city' ? city.cameras.length : ATLAS_LOCATIONS.reduce((sum, location) => sum + location.cameras.length, 0) },
    { id: 'viewshed', label: 'VIEWSHED', count: mode === 'city' ? city.cameras.length : 0 },
    { id: 'events', label: 'OSINT HITS', count: signalCount },
    { id: 'orbit', label: 'ORBIT', count: mode === 'world' ? 4 : 1 },
    { id: 'extrusions', label: '3D MASSING', count: mode === 'city' ? city.hotspots.length : 0 },
  ]

  return (
    <div className="atlas-layer-stack" data-testid="atlas-layer-stack">
      <div className="layer-head">
        <span>OSIRIS / GEOLIBRE LAYERS</span>
        <small>viewport-aware</small>
      </div>
      <div className="sensor-strip" data-testid="sensor-strip">
        {SENSOR_MODES.map((preset) => (
          <button key={preset.id} className={sensorMode === preset.id ? 'sensor-chip active' : 'sensor-chip'} onClick={() => onSensorMode(preset.id)} data-testid={`sensor-${preset.id}`}>
            {preset.label}
          </button>
        ))}
      </div>
      {layerRows.map((layer) => (
        <label key={layer.id} className="layer-toggle">
          <input type="checkbox" checked={layers[layer.id]} onChange={() => onToggle(layer.id)} data-testid={`layer-${layer.id}`} />
          <span>{layer.label}</span>
          <small>{layer.count}</small>
        </label>
      ))}
    </div>
  )
}

function AtlasMarker({
  marker,
  center,
  zoom,
  size,
  bearing,
  onClick,
}: {
  marker: AtlasHotspot & { cityId: string }
  center: { lat: number; lon: number }
  zoom: number
  size: StageSize
  bearing: number
  onClick: () => void
}) {
  const point = lonLatToScreen(marker, center, zoom, size)
  const hidden = point.left < -120 || point.left > size.width + 120 || point.top < -80 || point.top > size.height + 80
  return (
    <button
      className={`atlas-marker marker-${marker.kind}`}
      style={{ left: point.left, top: point.top, display: hidden ? 'none' : undefined }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      data-testid={`atlas-marker-${marker.id}`}
    >
      <span className="marker-pin" />
      <span className="marker-label" style={{ transform: `translate(-50%, -100%) rotate(${-bearing}deg)` }}>
        <strong>{marker.label}</strong>
        <small>{marker.sublabel}</small>
      </span>
    </button>
  )
}

function CameraMarker({
  camera,
  center,
  zoom,
  size,
  bearing,
  showViewshed,
  selected,
  onClick,
}: {
  camera: AtlasCamera
  center: { lat: number; lon: number }
  zoom: number
  size: StageSize
  bearing: number
  showViewshed: boolean
  selected: boolean
  onClick: () => void
}) {
  const point = lonLatToScreen(camera, center, zoom, size)
  const hidden = point.left < -140 || point.left > size.width + 140 || point.top < -140 || point.top > size.height + 140
  const metersPerPixel = 156543.03392 * Math.cos((camera.lat * Math.PI) / 180) / 2 ** zoom
  const coneLength = clamp(camera.range / metersPerPixel, 34, 180)
  const coneWidth = clamp(coneLength * (camera.fov / 42), 42, 210)
  return (
    <button
      className={`cctv-node cctv-${camera.type} ${selected ? 'selected' : ''}`}
      style={{ left: point.left, top: point.top, display: hidden ? 'none' : undefined }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      aria-label={`Open ${camera.label} camera feed`}
      data-testid={`cctv-${camera.id}`}
    >
      {showViewshed && (
        <span
          className="camera-viewshed"
          style={{
            width: coneWidth,
            height: coneLength,
            transform: `translate(-50%, -4px) rotate(${camera.heading}deg)`,
          }}
        />
      )}
      <span className="camera-icon" />
      <span className="camera-label" style={{ transform: `translate(-50%, -100%) rotate(${-bearing}deg)` }}>
        <strong>{camera.label}</strong>
        <small>
          {camera.operator} / {camera.status}
        </small>
      </span>
    </button>
  )
}

function SignalMarker({
  signal,
  center,
  zoom,
  size,
  bearing,
}: {
  signal: { id: string; label: string; sublabel: string; lat: number; lon: number }
  center: { lat: number; lon: number }
  zoom: number
  size: StageSize
  bearing: number
}) {
  const point = lonLatToScreen(signal, center, zoom, size)
  return (
    <div className="signal-marker" style={{ left: point.left, top: point.top }} data-testid={`signal-${signal.id}`}>
      <span />
      <small style={{ transform: `translate(-50%, -100%) rotate(${-bearing}deg)` }}>{signal.label}</small>
    </div>
  )
}

function CityExtrusionLayer({ city, center, zoom, size }: { city: AtlasLocation; center: { lat: number; lon: number }; zoom: number; size: StageSize }) {
  return (
    <>
      {city.hotspots.map((hotspot, index) => {
        const point = lonLatToScreen({ lat: hotspot.lat + 0.0007, lon: hotspot.lon - 0.0009 }, center, zoom, size)
        return (
          <span
            key={hotspot.id}
            className={`city-extrusion massing-${hotspot.kind}`}
            style={{ left: point.left, top: point.top, height: 24 + index * 7 }}
            data-testid={`massing-${hotspot.id}`}
          />
        )
      })}
    </>
  )
}

function WorldOrbitOverlay() {
  return (
    <div className="world-orbit-overlay" data-testid="world-orbit-overlay">
      <span className="orbit-ring ring-a" />
      <span className="orbit-ring ring-b" />
      <span className="orbit-satellite sat-a">SENTINEL PASS</span>
      <span className="orbit-satellite sat-b">SIGINT RELAY</span>
      <span className="orbit-sweep" />
    </div>
  )
}

function RecordsRoomBlueprint({ city, view }: { city: AtlasLocation; view: ViewModel | null }) {
  const signals = view && 'osintSignals' in view ? view.osintSignals.length : 0
  const copies = view && 'copies' in view ? view.copies.length : 0
  const tracked = trackedActorCount(view)
  return (
    <div className="room-blueprint" data-testid="room-blueprint">
      <div className="room-header">
        <span>{city.roomLabel}</span>
        <small>{city.label} / composite interior plan</small>
      </div>
      <div className="room-plan">
        <div className="room-zone zone-entry">
          <strong>ENTRY SALLYPORT</strong>
          <small>badge choke</small>
        </div>
        <div className="room-zone zone-desk">
          <strong>WATCH DESK</strong>
          <small>{tracked} tracks</small>
        </div>
        <div className="room-zone zone-stacks">
          <strong>ARCHIVE STACKS</strong>
          <small>paper chain</small>
        </div>
        <div className="room-zone zone-server">
          <strong>AIR-GAP RACK</strong>
          <small>{copies} copy hypotheses</small>
        </div>
        <div className="room-zone zone-scan">
          <strong>SCANNER BAY</strong>
          <small>{signals} OSINT hits</small>
        </div>
        <div className="room-zone zone-exit">
          <strong>SERVICE EXIT</strong>
          <small>blind interval</small>
        </div>
        <div className="room-table table-a" />
        <div className="room-table table-b" />
        <div className="camera-cone cone-a" />
        <div className="camera-cone cone-b" />
        <div className="laser-line laser-a" />
        <div className="laser-line laser-b" />
        <button className="room-node node-records" data-testid="room-node-records">
          MASTER INDEX
        </button>
        <button className="room-node node-deaddrop" data-testid="room-node-deaddrop">
          DEAD DROP
        </button>
      </div>
      <div className="room-footer">
        <span>Fictionalized schematic</span>
        <span>Street context: {city.briefing}</span>
      </div>
    </div>
  )
}

function trackedActorCount(view: ViewModel | null): number {
  if (!view) return 0
  if ('people' in view) return view.people.length
  if ('holders' in view) return view.holders.length
  return 0
}

function usePublicCameraRegistry(city: AtlasLocation, mode: 'city' | 'world'): { cameras: AtlasCamera[]; status: RegistryStatus } {
  const [remoteCameras, setRemoteCameras] = useState<AtlasCamera[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const url = city.cameraSource.apiJsonUrl ?? city.cameraSource.geoJsonUrl
    if (mode !== 'city' || !url) return
    let cancelled = false
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`camera registry ${response.status}`)
        return response.json() as Promise<GeoJsonFeatureCollection | TflJamCam[]>
      })
      .then((payload) => {
        if (cancelled) return
        const parsed = city.cameraSource.apiJsonUrl ? parseTflJamCams(payload as TflJamCam[], city) : parseCameraGeoJson(payload as GeoJsonFeatureCollection, city)
        if (parsed.length === 0) {
          setFailed(true)
          return
        }
        setRemoteCameras(parsed)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [city, mode])

  if (remoteCameras) return { cameras: remoteCameras, status: city.cameraSource.apiJsonUrl ? 'official-api' : 'official-geojson' }
  if (mode === 'city' && (city.cameraSource.geoJsonUrl || city.cameraSource.apiJsonUrl) && !failed) return { cameras: city.cameras, status: 'loading' }
  return { cameras: city.cameras, status: failed ? 'unavailable' : 'source-records' }
}

interface GeoJsonFeatureCollection {
  features?: {
    geometry?: { type?: string; coordinates?: unknown }
    properties?: Record<string, unknown>
  }[]
}

interface TflJamCam {
  id?: string
  commonName?: string
  lat?: number
  lon?: number
  additionalProperties?: { key?: string; value?: string }[]
}

function parseTflJamCams(payload: TflJamCam[], city: AtlasLocation): AtlasCamera[] {
  if (!Array.isArray(payload)) return []
  const cameras: (AtlasCamera & { distance: number })[] = []
  payload.forEach((camera, index) => {
    if (typeof camera.lat !== 'number' || typeof camera.lon !== 'number') return
    const imageUrl = readTflProp(camera, 'imageUrl')
    const videoUrl = readTflProp(camera, 'videoUrl')
    const available = readTflProp(camera, 'available') !== 'false'
    if (!imageUrl && !videoUrl) return
    cameras.push({
        id: camera.id ? camera.id.replace(/[^a-zA-Z0-9_-]/g, '-') : `tfl-${index}`,
        label: camera.commonName ?? `TfL JamCam ${index + 1}`,
        operator: 'TfL JamCams',
        type: 'traffic' as const,
        status: available ? ('live' as const) : ('delayed' as const),
        lat: camera.lat,
        lon: camera.lon,
        heading: (index * 31) % 360,
        fov: 56,
        range: 520,
        sourceUrl: city.cameraSource.url,
        feedUrl: videoUrl ?? imageUrl,
        imageUrl,
        mediaType: videoUrl ? ('video' as const) : ('image' as const),
        distance: distanceSq({ lat: camera.lat, lon: camera.lon }, city),
    })
  })
  return cameras
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12)
    .map(({ distance: _distance, ...camera }) => camera)
}

function readTflProp(camera: TflJamCam, key: string): string | undefined {
  return camera.additionalProperties?.find((property) => property.key === key)?.value
}

function parseCameraGeoJson(geojson: GeoJsonFeatureCollection, city: AtlasLocation): AtlasCamera[] {
  const features = geojson.features ?? []
  const cameras: (AtlasCamera & { distance: number })[] = []
  features.forEach((feature, index) => {
    if (feature.geometry?.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) return
    const [lon, lat] = feature.geometry.coordinates
    if (typeof lat !== 'number' || typeof lon !== 'number') return
    const distance = distanceSq({ lat, lon }, city)
    const label = readProp(feature.properties, ['NAME', 'CAMERAID', 'LOCATION', 'ADDRESS', 'OBJECTID']) ?? `DCGIS CCTV ${index + 1}`
    cameras.push({
        id: `dcgis-${readProp(feature.properties, ['OBJECTID', 'ID']) ?? index}`,
        label: String(label).slice(0, 42),
        operator: 'DCGIS official GeoJSON',
        type: 'traffic' as const,
        status: 'metadata' as const,
        lat,
        lon,
        heading: (index * 47) % 360,
        fov: 54,
        range: 460,
        sourceUrl: city.cameraSource.url,
        distance,
    })
  })
  return cameras
    .filter((camera): camera is AtlasCamera & { distance: number } => Boolean(camera))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12)
    .map(({ distance: _distance, ...camera }) => camera)
}

function readProp(props: Record<string, unknown> | undefined, names: string[]): unknown {
  if (!props) return null
  for (const name of names) {
    const value = props[name] ?? props[name.toLowerCase()]
    if (value !== null && value !== undefined && String(value).trim() !== '') return value
  }
  return null
}

function distanceSq(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  return (a.lat - b.lat) ** 2 + (a.lon - b.lon) ** 2
}

function registryStatusLabel(status: RegistryStatus): string {
  if (status === 'official-api') return 'official live API'
  if (status === 'official-geojson') return 'official GeoJSON'
  if (status === 'loading') return 'loading official registry'
  if (status === 'unavailable') return 'source fallback'
  return 'source records'
}

interface CameraMediaSpec {
  type: 'video' | 'image' | 'hls' | 'metadata'
  url: string | null
  label: string
}

function cameraMediaFor(camera: AtlasCamera | null, source: AtlasLocation['cameraSource']): CameraMediaSpec {
  if (!camera) return { type: 'metadata', url: null, label: 'NO FEED' }
  if (camera.feedUrl && camera.mediaType === 'video') return { type: 'video', url: camera.feedUrl, label: 'REAL VIDEO' }
  if (camera.feedUrl && camera.mediaType === 'hls') return { type: 'hls', url: camera.feedUrl, label: 'REAL HLS' }
  if (camera.imageUrl && (!camera.mediaType || camera.mediaType === 'image')) return { type: 'image', url: camera.imageUrl, label: 'REAL IMAGE' }
  if (source.livePageUrl) return { type: 'metadata', url: source.livePageUrl, label: 'OPEN SOURCE' }
  return { type: 'metadata', url: null, label: 'METADATA ONLY' }
}

interface HlsInstance {
  loadSource: (source: string) => void
  attachMedia: (media: HTMLMediaElement) => void
  destroy: () => void
}

interface HlsConstructor {
  new (config?: Record<string, unknown>): HlsInstance
  isSupported: () => boolean
}

declare global {
  interface Window {
    Hls?: HlsConstructor
    __leakswatHlsPromise?: Promise<HlsConstructor>
  }
}

function loadHls(): Promise<HlsConstructor> {
  if (window.Hls) return Promise.resolve(window.Hls)
  if (window.__leakswatHlsPromise) return window.__leakswatHlsPromise
  window.__leakswatHlsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = HLS_SCRIPT_SRC
    script.async = true
    script.onload = () => {
      if (window.Hls) resolve(window.Hls)
      else reject(new Error('hls.js did not initialize'))
    }
    script.onerror = () => reject(new Error('failed to load hls.js'))
    document.head.appendChild(script)
  })
  return window.__leakswatHlsPromise
}

function buildTiles(center: { lat: number; lon: number }, zoom: number, size: StageSize): TileSpec[] {
  const centerTile = lonLatToTileFloat(center, zoom)
  const columns = Math.ceil(size.width / TILE_SIZE) + 4
  const rows = Math.ceil(size.height / TILE_SIZE) + 4
  const baseX = Math.floor(centerTile.x)
  const baseY = Math.floor(centerTile.y)
  const max = 2 ** zoom
  const tiles: TileSpec[] = []
  for (let row = -Math.ceil(rows / 2); row <= Math.ceil(rows / 2); row++) {
    for (let col = -Math.ceil(columns / 2); col <= Math.ceil(columns / 2); col++) {
      const x = baseX + col
      const y = baseY + row
      if (y < 0 || y >= max) continue
      const wrappedX = ((x % max) + max) % max
      tiles.push({
        key: `${zoom}:${wrappedX}:${y}:${col}:${row}`,
        src: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: size.width / 2 + (x - centerTile.x) * TILE_SIZE,
        top: size.height / 2 + (y - centerTile.y) * TILE_SIZE,
      })
    }
  }
  return tiles
}

function lonLatToScreen(point: { lat: number; lon: number }, center: { lat: number; lon: number }, zoom: number, size: StageSize) {
  const markerTile = lonLatToTileFloat(point, zoom)
  const centerTile = lonLatToTileFloat(center, zoom)
  const max = 2 ** zoom
  let dx = markerTile.x - centerTile.x
  if (Math.abs(dx) > max / 2) dx -= Math.sign(dx) * max
  return {
    left: size.width / 2 + dx * TILE_SIZE,
    top: size.height / 2 + (markerTile.y - centerTile.y) * TILE_SIZE,
  }
}

function lonLatToTileFloat(point: { lat: number; lon: number }, zoom: number): TilePoint {
  const latRad = clamp(point.lat, -85.05112878, 85.05112878) * (Math.PI / 180)
  const n = 2 ** zoom
  return {
    x: ((point.lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  }
}

function tileFloatToLonLat(point: TilePoint, zoom: number) {
  const n = 2 ** zoom
  const lon = (point.x / n) * 360 - 180
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * point.y) / n)))
  return { lat: (latRad * 180) / Math.PI, lon: normalizeLon(lon) }
}

function normalizeLon(lon: number): number {
  if (lon < -180 || lon > 180) return ((((lon + 180) % 360) + 360) % 360) - 180
  return lon
}

function normalizeBearing(value: number): number {
  return ((value % 360) + 360) % 360
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}
