import { Html, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { AtlasHotspot, AtlasLocation } from '@/data/atlasLocations'
import { streetPeopleFor, type StreetPerson } from '@/data/streetProfiles'
import { MAP_ATTRIBUTION, mapTileUrl } from '@/maps/tiles'
import { useGameStore } from '@/store/game'
import { useUIStore } from '@/store/ui'
import { createHuman, type Human, type TeamKit } from '@/vendor/humankit'

const OPERATIVE_URL = '/models/mixamo-operative.glb'
const MIXAMO_FORWARD_CORRECTION = Math.PI

interface StreetOperationsProps {
  city: AtlasLocation
  hotspot: AtlasHotspot
  onExit: () => void
}

export function StreetOperations({ city, hotspot, onExit }: StreetOperationsProps) {
  const people = useMemo(() => streetPeopleFor(city, hotspot), [city, hotspot])
  const [selected, setSelected] = useState<StreetPerson | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const spectator = useGameStore((state) => state.humanFaction === 'SPECTATOR')
  const keys = useStreetKeys(!spectator)

  useEffect(() => {
    if (!spectator) return
    let index = 0
    const resolveNext = () => {
      setSelected(people[index % people.length])
      index++
    }
    const initial = window.setTimeout(resolveNext, 1800)
    const interval = window.setInterval(resolveNext, 8500)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
    }
  }, [people, spectator])

  return (
    <div className="street-operations" data-testid="street-operations" data-map-ready={mapReady}>
      <Canvas
        className="street-canvas"
        camera={{ position: [10, 8, 13], fov: 44, near: 0.1, far: 260 }}
        dpr={[1, 1.7]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        data-testid="street-canvas"
      >
        <color attach="background" args={['#aab3b8']} />
        <fog attach="fog" args={['#9ca8ad', 45, 135]} />
        <hemisphereLight args={['#e5edf2', '#27302c', 1.35]} />
        <directionalLight position={[20, 34, 14]} intensity={2.6} color="#fff1d6" castShadow shadow-mapSize={[1024, 1024]} />
        <StreetMapFloor hotspot={hotspot} onReady={setMapReady} />
        <CityMassing seed={city.id.length * 97 + hotspot.id.length * 31} />
        <StreetFurniture />
        <Suspense fallback={<OperativeFallback />}>
          <FieldOperative keys={keys} autopilot={spectator} />
        </Suspense>
        {people.map((person) => (
          <Pedestrian key={person.id} person={person} selected={selected?.id === person.id} onSelect={() => setSelected(person)} />
        ))}
        <CameraRig />
      </Canvas>

      <div className="street-mission-bar">
        <div>
          <span>STREET OPERATIONS // {city.label.toUpperCase()}</span>
          <small>{hotspot.label} / {hotspot.lat.toFixed(5)}, {hotspot.lon.toFixed(5)}</small>
        </div>
        <div className="street-status">
          <span className={spectator ? 'street-mode ai' : 'street-mode'}>{spectator ? 'AI PATROL' : 'FIELD CONTROL'}</span>
          <button type="button" className="ctl" onClick={onExit} data-testid="street-exit">MAP</button>
        </div>
      </div>

      <div className="street-controls" data-testid="street-controls">
        <span>{spectator ? 'AUTONOMOUS FOOT PATROL' : 'WASD MOVE / SHIFT RUN'}</span>
        <small>RIGHT-DRAG ORBIT / WHEEL ZOOM / SELECT A PERSON</small>
      </div>

      <PersonDossier person={selected} onClose={() => setSelected(null)} />
      <div className="street-attribution">{MAP_ATTRIBUTION} / Three.js Mixamo rig / Xirtus HumanKit</div>
    </div>
  )
}

function useStreetKeys(enabled: boolean): MutableRefObject<Set<string>> {
  const keys = useRef(new Set<string>())
  useEffect(() => {
    const activeKeys = keys.current
    if (!enabled) {
      activeKeys.clear()
      return
    }
    const down = (event: KeyboardEvent) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
        event.preventDefault()
        activeKeys.add(event.code)
      }
    }
    const up = (event: KeyboardEvent) => activeKeys.delete(event.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      activeKeys.clear()
    }
  }, [enabled])
  return keys
}

function FieldOperative({ keys, autopilot }: { keys: MutableRefObject<Set<string>>; autopilot: boolean }) {
  const group = useRef<THREE.Group>(null)
  const gltf = useGLTF(OPERATIVE_URL) as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] }
  const model = useMemo(() => {
    const next = clone(gltf.scene) as THREE.Group
    next.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return next
  }, [gltf.scene])
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model])
  const clips = useMemo(() => new Map(gltf.animations.map((clip) => [clip.name, clip])), [gltf.animations])
  const activeAction = useRef<THREE.AnimationAction | null>(null)
  const activeName = useRef('')
  const autoAngle = useRef(0)
  const { camera } = useThree()

  const play = (name: 'Idle' | 'Walk' | 'Run') => {
    if (activeName.current === name) return
    const clip = clips.get(name)
    if (!clip) return
    const next = mixer.clipAction(clip)
    next.reset().fadeIn(0.18).play()
    activeAction.current?.fadeOut(0.18)
    activeAction.current = next
    activeName.current = name
  }

  useEffect(() => {
    const clip = clips.get('Idle')
    if (clip) {
      const action = mixer.clipAction(clip)
      action.reset().play()
      activeAction.current = action
      activeName.current = 'Idle'
    }
    return () => {
      mixer.stopAllAction()
    }
  }, [clips, mixer])

  useFrame((_, dt) => {
    const root = group.current
    if (!root) return
    const delta = Math.min(dt, 0.05)
    const movement = new THREE.Vector3()
    let running = false

    if (autopilot) {
      autoAngle.current += delta * 0.19
      const target = new THREE.Vector3(Math.sin(autoAngle.current) * 19, 0, Math.cos(autoAngle.current * 0.73) * 14)
      movement.copy(target).sub(root.position)
      if (movement.lengthSq() > 0.2) movement.normalize()
    } else {
      const forwardInput = (keys.current.has('KeyW') ? 1 : 0) - (keys.current.has('KeyS') ? 1 : 0)
      const sideInput = (keys.current.has('KeyD') ? 1 : 0) - (keys.current.has('KeyA') ? 1 : 0)
      running = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')
      const forward = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize()
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize()
      movement.addScaledVector(forward, forwardInput).addScaledVector(right, sideInput)
      if (movement.lengthSq() > 1) movement.normalize()
    }

    if (movement.lengthSq() > 0.001) {
      const speed = autopilot ? 2.15 : running ? 5.3 : 2.8
      root.position.addScaledVector(movement, speed * delta)
      root.position.x = THREE.MathUtils.clamp(root.position.x, -38, 38)
      root.position.z = THREE.MathUtils.clamp(root.position.z, -38, 38)
      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, Math.atan2(movement.x, movement.z), 1 - Math.exp(-delta * 12))
      play(running ? 'Run' : 'Walk')
    } else {
      play('Idle')
    }
    mixer.update(delta)
  })

  return (
    <group ref={group} name="field-operative" data-role="operative">
      <primitive object={model} rotation={[0, MIXAMO_FORWARD_CORRECTION, 0]} />
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.58, 0.72, 30]} />
        <meshBasicMaterial color="#49d6ff" transparent opacity={0.82} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0, 2.25, 0]} center distanceFactor={12} zIndexRange={[5, 0]}>
        <span className="operative-label" data-testid="street-operative">FIELD OPERATIVE</span>
      </Html>
    </group>
  )
}

function OperativeFallback() {
  return (
    <group position={[0, 0.9, 0]}>
      <mesh castShadow><capsuleGeometry args={[0.34, 1.1, 5, 10]} /><meshStandardMaterial color="#243f4d" /></mesh>
    </group>
  )
}

function Pedestrian({ person, selected, onSelect }: { person: StreetPerson; selected: boolean; onSelect: () => void }) {
  const group = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const human = useMemo<Human>(() => {
    const palette: TeamKit[] = [
      { primary: 0x27384a, secondary: 0x20262e, accent: 0xbac7d1 },
      { primary: 0x5b2430, secondary: 0x2d3138, accent: 0xc7aa70 },
      { primary: 0x3a4630, secondary: 0x252a30, accent: 0xbec7b1 },
      { primary: 0x65513a, secondary: 0x26343d, accent: 0xc9c2b6 },
    ]
    const next = createHuman({ seed: person.seed, tier: 'distant', kit: palette[person.seed % palette.length], sleeve: 'long', trouserLength: 'long' })
    next.enableGroundAlign(() => 0)
    return next
  }, [person.seed])
  const routeIndex = useRef(1)

  useEffect(() => {
    human.play(selected || hovered ? 'idle_fidget' : 'walk', { fade: 0.2 })
  }, [hovered, human, selected])

  useFrame((_, dt) => {
    const root = group.current
    if (!root) return
    const delta = Math.min(dt, 0.05)
    if (!selected && !hovered) {
      const target = new THREE.Vector3(...person.route[routeIndex.current])
      const direction = target.sub(root.position)
      if (direction.lengthSq() < 0.45) routeIndex.current = (routeIndex.current + 1) % person.route.length
      else {
        direction.normalize()
        root.position.addScaledVector(direction, delta * (0.75 + (person.seed % 5) * 0.08))
        root.rotation.y = Math.atan2(direction.x, direction.z)
      }
    }
    human.update(delta)
  })

  return (
    <group ref={group} position={person.position}>
      <primitive object={human.root} />
      <mesh position={[0, 1.05, 0]} onClick={(event) => { event.stopPropagation(); onSelect() }}>
        <capsuleGeometry args={[0.52, 1.5, 4, 8]} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.58, 0.78, 32]} />
          <meshBasicMaterial color="#e8a13d" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Html position={[0, 2.18, 0]} center distanceFactor={12} zIndexRange={[6, 0]}>
        <button
          type="button"
          className={selected ? 'person-target selected' : 'person-target'}
          onClick={(event) => { event.stopPropagation(); onSelect() }}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          data-testid={`street-person-${person.id}`}
          aria-label={`Resolve identity for ${person.name}`}
        >
          <span>{selected ? person.name : 'UNKNOWN'}</span>
          <small>{selected ? `${person.confidence}% MATCH` : 'PERSON SEARCH'}</small>
        </button>
      </Html>
    </group>
  )
}

function CameraRig() {
  const { camera, gl, scene } = useThree()
  const yaw = useRef(0.72)
  const pitch = useRef(0.43)
  const distance = useRef(13)
  const dragging = useRef<{ x: number; y: number } | null>(null)
  const target = useRef(new THREE.Vector3(0, 1.2, 0))

  useEffect(() => {
    const node = gl.domElement
    const down = (event: PointerEvent) => {
      if (event.button === 2) dragging.current = { x: event.clientX, y: event.clientY }
    }
    const move = (event: PointerEvent) => {
      const drag = dragging.current
      if (!drag) return
      yaw.current -= (event.clientX - drag.x) * 0.008
      pitch.current = THREE.MathUtils.clamp(pitch.current + (event.clientY - drag.y) * 0.005, 0.18, 1.08)
      dragging.current = { x: event.clientX, y: event.clientY }
    }
    const up = () => { dragging.current = null }
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      distance.current = THREE.MathUtils.clamp(distance.current + Math.sign(event.deltaY) * 1.1, 6, 22)
    }
    const context = (event: MouseEvent) => event.preventDefault()
    node.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    node.addEventListener('wheel', wheel, { passive: false })
    node.addEventListener('contextmenu', context)
    return () => {
      node.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      node.removeEventListener('wheel', wheel)
      node.removeEventListener('contextmenu', context)
    }
  }, [gl])

  useFrame((_, dt) => {
    const operative = scene.getObjectByName('field-operative')
    if (!operative) return
    const desiredTarget = operative.position.clone().add(new THREE.Vector3(0, 1.35, 0))
    target.current.lerp(desiredTarget, 1 - Math.exp(-dt * 8))
    const radius = distance.current
    const desired = new THREE.Vector3(
      Math.sin(yaw.current) * Math.cos(pitch.current) * radius,
      Math.sin(pitch.current) * radius,
      Math.cos(yaw.current) * Math.cos(pitch.current) * radius,
    ).add(target.current)
    camera.position.lerp(desired, 1 - Math.exp(-dt * 7))
    camera.lookAt(target.current)
  })
  return null
}

function StreetMapFloor({ hotspot, onReady }: { hotspot: AtlasHotspot; onReady: (ready: boolean) => void }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const url = useMemo(() => osmTileUrl(hotspot.lat, hotspot.lon, 17), [hotspot.lat, hotspot.lon])

  useEffect(() => {
    let active = true
    let loadedTexture: THREE.Texture | null = null
    onReady(false)
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(url, (loaded) => {
      if (!active) {
        loaded.dispose()
        return
      }
      loaded.colorSpace = THREE.SRGBColorSpace
      loaded.anisotropy = 4
      loadedTexture = loaded
      setTexture(loaded)
      onReady(true)
    }, undefined, () => {
      setTexture(null)
      onReady(false)
    })
    return () => {
      active = false
      loadedTexture?.dispose()
    }
  }, [onReady, url])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.035, 0]} receiveShadow>
        <planeGeometry args={[92, 92]} />
        <meshBasicMaterial key={texture?.uuid ?? 'street-map-fallback'} map={texture ?? undefined} color={texture ? '#ffffff' : '#4f5a55'} toneMapped={false} />
      </mesh>
      <gridHelper args={[92, 46, '#4e8796', '#65716d']} position={[0, 0.005, 0]} material-transparent material-opacity={0.16} />
    </group>
  )
}

function CityMassing({ seed }: { seed: number }) {
  const buildings = useMemo(() => Array.from({ length: 26 }, (_, index) => {
    const side = index % 4
    const along = ((index * 17 + seed) % 72) - 36
    const edge = 31 + ((index * 7 + seed) % 8)
    const x = side < 2 ? along : (side === 2 ? -edge : edge)
    const z = side < 2 ? (side === 0 ? -edge : edge) : along
    return {
      key: index,
      position: [x, 2.8 + ((index * 13 + seed) % 18) * 0.35, z] as [number, number, number],
      size: [5 + ((index + seed) % 7), 5.6 + ((index * 13 + seed) % 18) * 0.7, 5 + ((index * 3 + seed) % 8)] as [number, number, number],
      color: ['#555f61', '#6a6259', '#59666b', '#716c61'][index % 4],
    }
  }), [seed])

  return (
    <group>
      {buildings.map((building) => (
        <mesh key={building.key} position={building.position} castShadow receiveShadow>
          <boxGeometry args={building.size} />
          <meshStandardMaterial color={building.color} roughness={0.88} metalness={0.08} />
        </mesh>
      ))}
    </group>
  )
}

function StreetFurniture() {
  return (
    <group>
      {[-24, -12, 0, 12, 24].map((z) => (
        <group key={z} position={[-8.5, 0, z]}>
          <mesh position={[0, 2.15, 0]} castShadow><cylinderGeometry args={[0.07, 0.1, 4.3, 8]} /><meshStandardMaterial color="#26333a" metalness={0.7} /></mesh>
          <mesh position={[0.35, 4.22, 0]} rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.16, 0.78, 0.24]} /><meshStandardMaterial color="#d9e8d8" emissive="#d9e8d8" emissiveIntensity={1.5} /></mesh>
        </group>
      ))}
      <mesh position={[8.2, 0.42, -9]} castShadow><boxGeometry args={[2.8, 0.84, 0.75]} /><meshStandardMaterial color="#344c55" /></mesh>
      <mesh position={[8.2, 1.65, -9.32]}><planeGeometry args={[2.2, 1.1]} /><meshStandardMaterial color="#d7d4c7" emissive="#526671" emissiveIntensity={0.25} /></mesh>
    </group>
  )
}

function PersonDossier({ person, onClose }: { person: StreetPerson | null; onClose: () => void }) {
  const togglePin = useUIStore((state) => state.togglePin)
  const pinned = useUIStore((state) => person ? state.pinnedIds.includes(person.id) : false)

  if (!person) {
    return (
      <div className="street-dossier empty" data-testid="street-dossier">
        <span>PERSON SEARCH</span>
        <strong>SELECT A PEDESTRIAN</strong>
        <small>Identity resolution, linked accounts, devices, communications, affiliations, and source knowledge.</small>
      </div>
    )
  }

  return (
    <aside className="street-dossier" data-testid="street-dossier">
      <div className="dox-head">
        <div><span>DOX // RESOLVED</span><small>{person.confidence}% identity confidence</small></div>
        <button type="button" onClick={onClose} aria-label="Close person dossier">×</button>
      </div>
      <div className="dox-identity">
        <div className="dox-photo" aria-hidden><span>{person.name.split(' ').map((part) => part[0]).join('')}</span></div>
        <div><h3>{person.name}</h3><p>{person.occupation}</p><small>{person.age} / {person.employer}</small></div>
        <span className={`dox-risk risk-${person.risk.toLowerCase()}`}>{person.risk}</span>
      </div>
      <dl className="dox-fields">
        <div><dt>ADDRESS</dt><dd>{person.address}</dd></div>
        <div><dt>HANDLE</dt><dd>{person.handle}</dd></div>
        <div><dt>PHONE</dt><dd>{person.phone}</dd></div>
        <div><dt>DEVICE</dt><dd>{person.device}</dd></div>
      </dl>
      <section className="dox-section">
        <h4>WHAT THEY KNOW</h4>
        <p>{person.knowledge}</p>
      </section>
      <section className="dox-section">
        <h4>PRIVATE MESSAGES</h4>
        <div className="message-stack">
          {person.messages.map((message, index) => (
            <article key={`${message.time}-${index}`}>
              <header><span>{message.channel}</span><small>{message.direction} / {message.time}</small></header>
              <p>{message.body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="dox-section">
        <h4>LINKED NETWORKS</h4>
        <div className="dox-links">{person.affiliations.map((link) => <span key={link}>{link}</span>)}</div>
      </section>
      <div className="dox-actions">
        <button type="button" className={pinned ? 'ctl active' : 'ctl'} onClick={() => togglePin(person.id)}>{pinned ? 'PINNED' : 'PIN SUBJECT'}</button>
      </div>
    </aside>
  )
}

function osmTileUrl(lat: number, lon: number, zoom: number): string {
  const n = 2 ** zoom
  const x = Math.floor(((lon + 180) / 360) * n)
  const latRad = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(lat, -85.05112878, 85.05112878))
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  return mapTileUrl(zoom, x, y)
}

useGLTF.preload(OPERATIVE_URL)
