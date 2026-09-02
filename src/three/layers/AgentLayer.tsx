/**
 * Instanced agent markers — one draw call for the whole population.
 * Rendering subscribes to the perspective-filtered view only, so a
 * BLACKGLASS map shows observed positions (not ground truth) and the
 * HYDRA map shows only controlled holders.
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { QualityTier } from '@/core/save'
import { useUIStore } from '@/store/ui'
import type { ViewModel } from '@/sim/perspective'

interface Marker {
  id: string
  kind: 'person' | 'vehicle' | 'holder'
  color: string
  size: number
}

const COLOR = {
  person: '#5b7ea6',
  personFresh: '#93b8e0',
  personStale: '#3a4c63',
  vehicle: '#8b97ad',
  holder: '#e0a94f',
  holderActive: '#66e0a3',
}

export function AgentLayer({ view, quality }: { view: ViewModel; quality: QualityTier }) {
  const select = useUIStore((s) => s.select)
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const glowRef = useRef<THREE.InstancedMesh>(null)
  const positions = useRef<Map<string, THREE.Vector3>>(new Map())

  const markers = useMemo<Marker[]>(() => {
    if (view.perspective === 'HYDRA') {
      return view.holders.map((h) => ({
        id: h.id,
        kind: 'holder' as const,
        color: h.id === view.activeHolderId ? COLOR.holderActive : COLOR.holder,
        size: 7,
      }))
    }
    if (view.perspective === 'OMNISCIENT_REPLAY') {
      return view.people.map((p) => ({
        id: p.id,
        kind: 'person' as const,
        color: p.knowledge.copyIds.length > 0 ? COLOR.personFresh : COLOR.person,
        size: p.knowledge.copyIds.length > 0 ? 7 : 5,
      }))
    }
    const people: Marker[] = view.people
      .filter((p) => p.pos !== null)
      .map((p) => ({
        id: p.id,
        kind: 'person' as const,
        color: p.posAge < 60 ? COLOR.personFresh : p.posAge < 900 ? COLOR.person : COLOR.personStale,
        size: 5,
      }))
    const vehicles: Marker[] = view.vehicles
      .filter((v) => v.pos !== null)
      .map((v) => ({ id: v.id, kind: 'vehicle' as const, color: COLOR.vehicle, size: 4 }))
    return [...people, ...vehicles]
  }, [view])

  const count = markers.length

  useFrame(({ camera }) => {
    const mesh = meshRef.current
    const glow = glowRef.current
    if (!mesh || count === 0) return

    const dummy = new THREE.Object3D()
    const tmp = new THREE.Color()
    let visible = 0

    for (let i = 0; i < count; i++) {
      const m = markers[i]
      let pos: { x: number; z: number } | undefined
      if (view.perspective === 'HYDRA') {
        pos = view.holders.find((h) => h.id === m.id)?.pos ?? undefined
      } else if (view.perspective === 'OMNISCIENT_REPLAY') {
        pos = view.people.find((p) => p.id === m.id)?.pos ?? undefined
      } else if (m.kind === 'person') {
        pos = view.people.find((p) => p.id === m.id)?.pos ?? undefined
      } else {
        pos = view.vehicles.find((v) => v.id === m.id)?.pos ?? undefined
      }
      if (!pos) {
        dummy.position.set(0, -1000, 0)
        dummy.scale.setScalar(0.0001)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        mesh.setColorAt(i, tmp.set('#000000'))
        if (glow) {
          glow.setMatrixAt(i, dummy.matrix)
          glow.setColorAt(i, tmp.set('#000000'))
        }
        continue
      }
      // Smooth presentation interpolation between tick positions.
      const prev = positions.current.get(m.id)
      const target = new THREE.Vector3(pos.x, 0.6, pos.z)
      const cur = prev ? prev.lerp(target, 0.25) : target.clone()
      positions.current.set(m.id, cur)

      dummy.position.copy(cur)
      dummy.scale.setScalar(m.size)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, tmp.set(m.color))
      if (glow) {
        dummy.position.set(cur.x, 0.42, cur.z)
        dummy.scale.setScalar(m.size * 2.4)
        dummy.updateMatrix()
        glow.setMatrixAt(i, dummy.matrix)
        glow.setColorAt(i, tmp.set(m.color))
      }
      visible++
    }
    mesh.count = visible
    if (glow) glow.count = visible
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    if (glow) {
      glow.instanceMatrix.needsUpdate = true
      if (glow.instanceColor) glow.instanceColor.needsUpdate = true
    }
    void camera
  })

  return (
    <group>
      <instancedMesh ref={glowRef} args={[undefined, undefined, count]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, quality === 'low' ? 12 : 28]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation()
          const i = e.instanceId
          if (i !== undefined && i < markers.length) select(markers[i].id)
        }}
      >
        <circleGeometry args={[1, quality === 'low' ? 10 : 20]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.98} />
      </instancedMesh>
    </group>
  )
}
