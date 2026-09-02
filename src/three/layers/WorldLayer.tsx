/**
 * Static world geometry: roads, building extrusions, origin marker.
 * Everything here is manifest data + procedural presentation.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Billboard, Line, Ring, Text } from '@react-three/drei'
import { manifest } from '@/data/scenarios'
import type { BuildingFootprint } from '@/sim/scenario'
import { useUIStore } from '@/store/ui'

const BUILDING_EDGE = '#4c6686'
const ROAD_COLOR = '#2f5a70'
const ROAD_GLOW = '#58dcff'
const PATH_COLOR = '#68d89f'
const ORIGIN_COLOR = '#e04f3f'

const BUILDING_STYLE: Record<BuildingFootprint['kind'], { color: string; emissive: string; accent: string }> = {
  archive: { color: '#1d2330', emissive: '#431c19', accent: '#ff745e' },
  government: { color: '#172437', emissive: '#071b30', accent: '#57c8ff' },
  office: { color: '#182b27', emissive: '#092018', accent: '#50daa0' },
  residential: { color: '#242416', emissive: '#211805', accent: '#d8b64f' },
  commercial: { color: '#241a2c', emissive: '#210b2d', accent: '#d36dff' },
  transit: { color: '#2b2216', emissive: '#2b1505', accent: '#ffad49' },
}

function RoadGeometry() {
  const roads = useMemo(() => {
    const nodeById = new Map(manifest.graph.nodes.map((n) => [n.id, n]))
    return manifest.graph.roads.map((road) => ({
      ...road,
      points: road.nodes
        .map((nid) => nodeById.get(nid))
        .filter((n): n is NonNullable<typeof n> => n !== undefined)
        .map((n) => [n.pos.x, 0.08, n.pos.z] as [number, number, number]),
    }))
  }, [])
  return (
    <group>
      {roads.map((road) => (
        <group key={road.id}>
          <Line
            points={road.points}
            color={road.kind === 'path' ? PATH_COLOR : ROAD_GLOW}
            lineWidth={road.kind === 'path' ? 3 : 6}
            transparent
            opacity={road.kind === 'path' ? 0.18 : 0.16}
          />
          <Line
            points={road.points}
            color={road.kind === 'path' ? PATH_COLOR : ROAD_COLOR}
            lineWidth={road.kind === 'path' ? 1.4 : 2.2}
            transparent
            opacity={road.kind === 'path' ? 0.75 : 0.82}
          />
          {road.name && road.points.length >= 2 && road.kind === 'road' && (
            <Billboard position={road.points[Math.floor(road.points.length / 2)]}>
              <Text fontSize={15} color="#86a2bd" anchorX="center" anchorY="middle" fillOpacity={0.52}>
                {road.name.toUpperCase()}
              </Text>
            </Billboard>
          )}
        </group>
      ))}
    </group>
  )
}

function BuildingMesh({ b }: { b: BuildingFootprint }) {
  const setAtlasScale = useUIStore((s) => s.setAtlasScale)
  const setAtlasFocus = useUIStore((s) => s.setAtlasFocus)
  const height = b.h
  const style = BUILDING_STYLE[b.kind]
  const isLandmark = b.kind === 'archive' || b.kind === 'government' || b.kind === 'transit'
  const drillIn = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    setAtlasFocus(b.id)
    if (b.kind === 'archive') setAtlasScale('room')
  }
  return (
    <group position={[b.pos.x, height / 2, b.pos.z]} onClick={drillIn}>
      <mesh
        scale={[b.w, height, b.d]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={style.color} emissive={style.emissive} emissiveIntensity={0.75} roughness={0.78} metalness={0.22} />
      </mesh>
      <lineSegments scale={[b.w, height, b.d]}>
        <edgesGeometry args={[new THREE.BoxGeometry(1, 1, 1)]} />
        <lineBasicMaterial color={BUILDING_EDGE} transparent opacity={0.72} />
      </lineSegments>
      <mesh position={[0, height * 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[b.w * 0.92, b.d * 0.92]} />
        <meshBasicMaterial color={style.accent} transparent opacity={b.kind === 'archive' ? 0.28 : 0.11} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {b.kind === 'archive' && (
        <>
          <mesh position={[0, height * 0.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[Math.max(b.w, b.d) * 0.68, 64]} />
            <meshBasicMaterial color={ORIGIN_COLOR} transparent opacity={0.02} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <Ring args={[0.8, 1.0, 48]} position={[0, height * 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={Math.max(b.w, b.d) * 0.75}>
            <meshBasicMaterial color={ORIGIN_COLOR} transparent opacity={0.55} side={THREE.DoubleSide} />
          </Ring>
        </>
      )}
      {isLandmark && (
        <Billboard position={[0, height + 18, 0]}>
          <Text
            fontSize={18}
            color={style.accent}
            anchorX="center"
            anchorY="middle"
            fillOpacity={0.9}
            outlineWidth={0.9}
            outlineColor="#05070b"
          >
            {b.name.toUpperCase()}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

export function WorldLayer() {
  const ref = useRef<THREE.Group>(null)

  useLayoutEffect(() => {
    // Buildings sit flat on the ground plane.
    ref.current?.updateMatrixWorld()
  }, [])

  return (
    <group ref={ref}>
      <RoadGeometry />
      {manifest.buildings.map((b) => (
        <BuildingMesh key={b.id} b={b} />
      ))}
    </group>
  )
}
