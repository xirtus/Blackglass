/**
 * BLACKGLASS-only surveillance coverage visualization — the HYDRA player
 * never receives this (perspective isolation extends to the renderer).
 */
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { BlackglassView } from '@/sim/perspective'

export function CoverageLayer({ view }: { view: BlackglassView }) {
  const groupRef = useRef<THREE.Group>(null)

  const circles = view.watchCircles.filter((c) => c.coverage > 0.15)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const group = groupRef.current
    if (!group) return
    let i = 0
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const pulse = 1 + Math.sin(t * 2 + i * 1.7) * 0.06
        obj.scale.setScalar(pulse)
        i++
      }
    })
  })

  return (
    <group ref={groupRef}>
      {circles.map((c) => {
        const person = view.people.find((p) => p.id === c.subjectId)
        if (!person?.pos) return null
        const radius = 45 + c.coverage * 140
        return (
          <mesh
            key={c.id}
            position={[person.pos.x, 0.35, person.pos.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={radius}
          >
            <ringGeometry args={[0.82, 1, 64]} />
            <meshBasicMaterial color="#e8a13d" transparent opacity={0.12 + c.coverage * 0.22} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}
