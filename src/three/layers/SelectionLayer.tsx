/**
 * Selection ring + movement trail for the currently selected entity.
 */
import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useUIStore } from '@/store/ui'
import type { ViewModel } from '@/sim/perspective'

const TRAIL_LEN = 70

/** Trail history lives outside React state (presentation-only data). */
const trailStore = new Map<string, THREE.Vector3[]>()

export function SelectionLayer({ view }: { view: ViewModel }) {
  const selectedId = useUIStore((s) => s.selectedId)
  const pinnedIds = useUIStore((s) => s.pinnedIds)
  const ringRef = useRef<THREE.Mesh>(null)
  const [trailTick, setTrailTick] = useState(0)

  const focusIds = useMemo(
    () => [...new Set([selectedId, ...pinnedIds].filter((x): x is string => x !== null))],
    [selectedId, pinnedIds],
  )

  const positionsOf = (id: string): { x: number; z: number } | null => {
    if (view.perspective === 'OMNISCIENT_REPLAY') {
      const p = view.people.find((x) => x.id === id)
      return p ? { x: p.pos.x, z: p.pos.z } : null
    }
    if (view.perspective === 'HYDRA') {
      const h = view.holders.find((x) => x.id === id)
      return h?.pos ? { x: h.pos.x, z: h.pos.z } : null
    }
    const p = view.people.find((x) => x.id === id)
    if (p?.pos) return { x: p.pos.x, z: p.pos.z }
    const v = view.vehicles.find((x) => x.id === id)
    if (v?.pos) return { x: v.pos.x, z: v.pos.z }
    return null
  }

  useFrame(() => {
    for (const id of focusIds) {
      const pos = positionsOf(id)
      if (!pos) continue
      const arr = trailStore.get(id) ?? []
      const last = arr[arr.length - 1]
      if (!last || last.distanceTo(new THREE.Vector3(pos.x, 0.3, pos.z)) > 3) {
        arr.push(new THREE.Vector3(pos.x, 0.3, pos.z))
      }
      if (arr.length > TRAIL_LEN) arr.shift()
      trailStore.set(id, arr)
    }
    // Repaint trail lines once per second (cheap geometry update).
    if (Math.floor(performance.now() / 1000) % 4 === 0) setTrailTick((t) => (t + 1) % 4096)
  })

  useFrame(({ clock }) => {
    const ring = ringRef.current
    if (!ring) return
    const t = clock.getElapsedTime()
    const s = 16 + Math.sin(t * 3) * 3
    ring.scale.setScalar(s)
    const mat = ring.material as THREE.MeshBasicMaterial
    mat.opacity = 0.55 + Math.sin(t * 3) * 0.2
  })

  const selectedPos = selectedId ? positionsOf(selectedId) : null

  return (
    <group>
      {selectedId && selectedPos && (
        <mesh ref={ringRef} position={[selectedPos.x, 0.4, selectedPos.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.85, 1, 40]} />
          <meshBasicMaterial color="#49d6ff" transparent opacity={0.6} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
      {focusIds.map((id) => {
        void trailTick
        const points = trailStore.get(id)
        if (!points || points.length < 2) return null
        const pts = points.map((p) => [p.x, p.y, p.z] as [number, number, number])
        return <Line key={id} points={pts} color={id === selectedId ? '#49d6ff' : '#e8a13d'} lineWidth={1.5} transparent opacity={0.55} />
      })}
    </group>
  )
}
