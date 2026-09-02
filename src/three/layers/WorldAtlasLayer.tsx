import { Billboard, Line, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ViewModel } from '@/sim/perspective'

const NODES = [
  { id: 'dc', label: 'D.C. ARCHIVE', x: -170, y: 42, z: 112, tone: '#ff745e' },
  { id: 'lon', label: 'LONDON MIRROR', x: -35, y: 68, z: -180, tone: '#49d6ff' },
  { id: 'ber', label: 'BERLIN OSINT', x: 40, y: 76, z: -170, tone: '#49d98c' },
  { id: 'sg', label: 'SINGAPORE CACHE', x: 205, y: -30, z: -35, tone: '#e8a13d' },
  { id: 'sao', label: 'SAO PAULO MEDIA', x: -120, y: -105, z: 140, tone: '#d36dff' },
] as const

function globePoint(node: (typeof NODES)[number]): [number, number, number] {
  return [node.x, node.y, node.z]
}

function arcBetween(a: (typeof NODES)[number], b: (typeof NODES)[number]): [number, number, number][] {
  const av = new THREE.Vector3(...globePoint(a)).normalize().multiplyScalar(245)
  const bv = new THREE.Vector3(...globePoint(b)).normalize().multiplyScalar(245)
  const mid = av.clone().add(bv).normalize().multiplyScalar(335)
  const curve = new THREE.QuadraticBezierCurve3(av, mid, bv)
  return curve.getPoints(28).map((p) => [p.x, p.y, p.z])
}

function Satellite({ radius, speed, color }: { radius: number; speed: number; color: string }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * speed
  })
  return (
    <group ref={ref} rotation={[0.6, 0, 0.25]}>
      <mesh position={[radius, 0, 0]}>
        <boxGeometry args={[18, 7, 11]} />
        <meshStandardMaterial color="#d8e8ff" emissive={color} emissiveIntensity={0.8} metalness={0.65} roughness={0.28} />
      </mesh>
      <Line points={[[radius, 0, 0], [210, 0, 0]]} color={color} lineWidth={1.2} transparent opacity={0.45} />
    </group>
  )
}

export function WorldAtlasLayer({ view }: { view: ViewModel }) {
  const groupRef = useRef<THREE.Group>(null)
  const signalCount = view.perspective === 'OMNISCIENT_REPLAY' ? view.osintSignals.length : view.osintSignals.length
  const arcs = useMemo(
    () => [
      [NODES[0], NODES[1]],
      [NODES[0], NODES[2]],
      [NODES[1], NODES[3]],
      [NODES[2], NODES[4]],
      [NODES[4], NODES[0]],
    ] as const,
    [],
  )

  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.rotation.y = clock.getElapsedTime() * 0.035
  })

  return (
    <group ref={groupRef} position={[0, 20, 0]}>
      <mesh>
        <sphereGeometry args={[230, 64, 32]} />
        <meshStandardMaterial
          color="#0c2631"
          emissive="#06141b"
          emissiveIntensity={0.65}
          roughness={0.68}
          metalness={0.22}
          transparent
          opacity={0.96}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[234, 32, 16]} />
        <meshBasicMaterial color="#49d6ff" wireframe transparent opacity={0.14} toneMapped={false} />
      </mesh>
      {arcs.map(([a, b]) => (
        <Line key={`${a.id}:${b.id}`} points={arcBetween(a, b)} color={a.tone} lineWidth={2.2} transparent opacity={0.64} />
      ))}
      {NODES.map((node) => {
        const p = globePoint(node)
        return (
          <group key={node.id} position={p}>
            <mesh>
              <sphereGeometry args={[7, 16, 12]} />
              <meshBasicMaterial color={node.tone} toneMapped={false} />
            </mesh>
            <Billboard position={[0, 24, 0]}>
              <Text fontSize={17} color={node.tone} anchorX="center" anchorY="middle" outlineWidth={0.9} outlineColor="#05070b">
                {node.label}
              </Text>
            </Billboard>
          </group>
        )
      })}
      <Satellite radius={310} speed={0.28} color="#49d6ff" />
      <Satellite radius={360} speed={-0.18} color="#e8a13d" />
      <Billboard position={[0, 312, 0]}>
        <Text fontSize={24} color="#e6eefb" anchorX="center" anchorY="middle" outlineWidth={1.1} outlineColor="#05070b">
          ORBITAL OSINT ATLAS // {NODES.length} GLOBAL NODES // {signalCount} LIVE SIGNALS
        </Text>
      </Billboard>
    </group>
  )
}
