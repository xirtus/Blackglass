import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ViewModel } from '@/sim/perspective'

const KIND_COLOR: Record<string, string> = {
  worldMonitor: '#49d6ff',
  caseGraph: '#e8a13d',
  radioSpectrum: '#49d98c',
  publicCamera: '#e04f3f',
  press: '#b8c7dd',
}

export function OsintLayer({ view }: { view: ViewModel }) {
  const ref = useRef<THREE.Group>(null)
  const signals = useMemo(() => (view.perspective === 'OMNISCIENT_REPLAY' ? [] : view.osintSignals.slice(-24)), [view])

  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 3.5) * 0.14
    g.children.forEach((child) => {
      child.scale.setScalar(pulse)
    })
  })

  if (view.perspective === 'OMNISCIENT_REPLAY') return null

  return (
    <group ref={ref}>
      {signals.map((signal) => (
        <mesh key={signal.id} position={[signal.pos.x, 1.2, signal.pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[10, 13 + signal.confidence * 12, 32]} />
          <meshBasicMaterial
            color={KIND_COLOR[signal.sourceKind] ?? '#49d6ff'}
            transparent
            opacity={signal.severity === 'critical' || signal.severity === 'warning' ? 0.5 : 0.28}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}
