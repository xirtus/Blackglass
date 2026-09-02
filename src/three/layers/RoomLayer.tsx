import { Billboard, Line, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ViewModel } from '@/sim/perspective'

const SHELVES = [
  [-210, -90, 130, 18],
  [-210, -35, 130, 18],
  [-210, 20, 130, 18],
  [-210, 75, 130, 18],
  [-50, -90, 130, 18],
  [-50, -35, 130, 18],
  [-50, 20, 130, 18],
  [-50, 75, 130, 18],
] as const

const DESKS = [
  [130, -85, 70, 34],
  [130, -25, 70, 34],
  [130, 35, 70, 34],
] as const

function RoomSweep() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.getElapsedTime() * 0.42
  })
  return (
    <mesh ref={ref} position={[0, 2.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[310, 96, 0, Math.PI / 4]} />
      <meshBasicMaterial color="#49d6ff" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export function RoomLayer({ view }: { view: ViewModel }) {
  const activityCount =
    view.perspective === 'HYDRA'
      ? Math.max(1, view.holders.length + view.copies.length)
      : view.perspective === 'BLACKGLASS'
        ? Math.max(1, view.watchCircles.length + view.osintSignals.length)
        : Math.max(1, view.people.length + view.copies.length)
  const documentPoints = useMemo(
    () => [
      [-245, 3, 75],
      [-130, 3, 18],
      [-20, 3, -30],
      [92, 3, -24],
      [165, 3, 40],
    ] as [number, number, number][],
    [],
  )

  return (
    <group>
      <mesh position={[0, -0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[640, 420]} />
        <meshStandardMaterial color="#14202b" emissive="#07111a" emissiveIntensity={0.45} roughness={0.74} metalness={0.16} />
      </mesh>
      <lineSegments position={[0, 0, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(640, 8, 420)]} />
        <lineBasicMaterial color="#6f8fad" transparent opacity={0.45} />
      </lineSegments>
      <mesh position={[0, 5, -198]} scale={[640, 44, 8]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#1e2e40" emissive="#0c2236" emissiveIntensity={0.55} />
      </mesh>
      {SHELVES.map(([x, z, w, d], i) => (
        <group key={i} position={[x, 13, z]}>
          <mesh scale={[w, 26, d]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#352b18" emissive="#221806" emissiveIntensity={0.7} roughness={0.85} />
          </mesh>
          <Line
            points={[
              [-w / 2, 15, 0],
              [w / 2, 15, 0],
            ]}
            color="#e8a13d"
            lineWidth={1.2}
            transparent
            opacity={0.55}
          />
        </group>
      ))}
      {DESKS.map(([x, z, w, d], i) => (
        <group key={i} position={[x, 9, z]}>
          <mesh scale={[w, 18, d]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#213c47" emissive="#0c3139" emissiveIntensity={0.75} roughness={0.6} />
          </mesh>
          <mesh position={[0, 11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w * 0.68, d * 0.56]} />
            <meshBasicMaterial color="#49d6ff" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      ))}
      <Line points={documentPoints} color="#ff745e" lineWidth={3} transparent opacity={0.85} />
      {documentPoints.map((p, i) => (
        <mesh key={i} position={p} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[9, 13, 32]} />
          <meshBasicMaterial color={i === 0 ? '#ff745e' : '#49d98c'} transparent opacity={0.75} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
      <RoomSweep />
      <Billboard position={[0, 65, -206]}>
        <Text fontSize={22} color="#ff745e" anchorX="center" anchorY="middle" outlineWidth={1} outlineColor="#05070b">
          MERIDIAN ANNEX RECORDS ROOM
        </Text>
      </Billboard>
      <Billboard position={[150, 54, 100]}>
        <Text fontSize={16} color="#49d6ff" anchorX="center" anchorY="middle" outlineWidth={0.7} outlineColor="#05070b">
          {activityCount} ACTIVE TRACKS
        </Text>
      </Billboard>
    </group>
  )
}
