import { Line, Ring } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { manifest } from '@/data/scenarios'
import type { BlackglassView, ViewModel } from '@/sim/perspective'

const SOURCE_COLOR: Record<string, string> = {
  worldMonitor: '#49d6ff',
  caseGraph: '#e8a13d',
  radioSpectrum: '#49d98c',
  publicCamera: '#e04f3f',
  press: '#b8c7dd',
}

function anchorPosition(id: string): { x: number; z: number } | null {
  const node = manifest.graph.nodes.find((n) => n.id === id)
  if (node) return node.pos
  const b = manifest.buildings.find((x) => x.id === id)
  return b?.pos ?? null
}

function SurveillanceSweep() {
  const ref = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (ref.current) ref.current.rotation.y = t * 0.16
  })

  const spokes = useMemo(() => Array.from({ length: 18 }, (_, i) => (i / 18) * Math.PI * 2), [])

  return (
    <group ref={ref} position={[0, 0.18, 0]}>
      <Ring args={[500, 505, 160]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#49d6ff" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </Ring>
      <Ring args={[255, 258, 120]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#49d98c" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </Ring>
      {spokes.map((angle) => (
        <Line
          key={angle}
          points={[
            [Math.cos(angle) * 80, 0.22, Math.sin(angle) * 80],
            [Math.cos(angle) * 690, 0.22, Math.sin(angle) * 690],
          ]}
          color="#49d6ff"
          lineWidth={0.65}
          transparent
          opacity={0.08}
        />
      ))}
      <mesh position={[0, 0.24, 0]} rotation={[-Math.PI / 2, 0, -0.35]}>
        <circleGeometry args={[680, 96, 0, Math.PI / 5]} />
        <meshBasicMaterial color="#49d6ff" transparent opacity={0.09} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

function SourceTower({ x, z, color, coverage }: { x: number; z: number; color: string; coverage: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 18, 0]}>
        <cylinderGeometry args={[4, 6, 36, 8]} />
        <meshStandardMaterial color="#0b1118" emissive={color} emissiveIntensity={0.9} roughness={0.5} metalness={0.45} />
      </mesh>
      <mesh position={[0, 38, 0]}>
        <sphereGeometry args={[5.8, 16, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.92} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={38 + coverage * 110}>
        <ringGeometry args={[0.96, 1, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.18 + coverage * 0.16} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function SurveillanceLayer({ view }: { view: ViewModel }) {
  const signals = view.perspective === 'OMNISCIENT_REPLAY' ? view.osintSignals.slice(-18) : view.osintSignals.slice(-18)
  const sources = useMemo(
    () => (view.perspective === 'BLACKGLASS' ? (view as BlackglassView).osintSources.filter((s) => s.enabled && s.mode !== 'blocked') : []),
    [view],
  )
  const towers = useMemo(
    () =>
      sources.flatMap((source) =>
        source.anchorLocationIds
          .map((id) => {
            const pos = anchorPosition(id)
            return pos ? { id: `${source.id}:${id}`, source, pos } : null
          })
          .filter((item): item is NonNullable<typeof item> => item !== null),
      ),
    [sources],
  )

  return (
    <group>
      <SurveillanceSweep />
      {towers.map((tower) => (
        <SourceTower
          key={tower.id}
          x={tower.pos.x}
          z={tower.pos.z}
          color={SOURCE_COLOR[tower.source.kind] ?? '#49d6ff'}
          coverage={tower.source.coverage}
        />
      ))}
      {signals.map((signal) => {
        const color = SOURCE_COLOR[signal.sourceKind] ?? '#49d6ff'
        const anchor = towers.find((tower) => tower.source.id === signal.sourceId)?.pos
        return (
          <group key={signal.id}>
            {anchor && (
              <Line
                points={[
                  [anchor.x, 48, anchor.z],
                  [signal.pos.x, 12, signal.pos.z],
                ]}
                color={color}
                lineWidth={1.25 + signal.confidence * 2}
                transparent
                opacity={0.26 + signal.confidence * 0.28}
              />
            )}
            <Ring args={[12, 18 + signal.confidence * 24, 48]} position={[signal.pos.x, 0.55, signal.pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
              <meshBasicMaterial color={color} transparent opacity={0.24 + signal.confidence * 0.24} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
            </Ring>
          </group>
        )
      })}
    </group>
  )
}
