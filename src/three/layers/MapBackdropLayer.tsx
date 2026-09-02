import { useMemo } from 'react'
import * as THREE from 'three'

function makeTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 768
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  bg.addColorStop(0, '#102018')
  bg.addColorStop(0.38, '#111b22')
  bg.addColorStop(0.72, '#16150f')
  bg.addColorStop(1, '#09161c')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.globalAlpha = 0.34
  ctx.strokeStyle = '#2c564f'
  ctx.lineWidth = 2
  for (let i = -260; i < canvas.width + 260; i += 54) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + 360, canvas.height)
    ctx.stroke()
  }

  ctx.globalAlpha = 0.24
  ctx.strokeStyle = '#6e5f37'
  ctx.lineWidth = 1
  for (let y = 36; y < canvas.height; y += 42) {
    ctx.beginPath()
    for (let x = 0; x <= canvas.width; x += 32) {
      const yy = y + Math.sin((x + y) * 0.018) * 7
      if (x === 0) ctx.moveTo(x, yy)
      else ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }

  ctx.globalAlpha = 0.5
  const river = ctx.createLinearGradient(0, 0, 280, canvas.height)
  river.addColorStop(0, '#0a3544')
  river.addColorStop(1, '#082835')
  ctx.fillStyle = river
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(120, 90, 70, 230, 170, 330)
  ctx.bezierCurveTo(275, 450, 155, 610, 245, canvas.height)
  ctx.lineTo(0, canvas.height)
  ctx.closePath()
  ctx.fill()

  ctx.globalAlpha = 0.22
  ctx.strokeStyle = '#7de8ff'
  for (let y = 18; y < canvas.height; y += 64) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(115, y + 24, 70, y + 54, 210, y + 84)
    ctx.stroke()
  }

  ctx.globalAlpha = 0.14
  ctx.fillStyle = '#f2e8b6'
  for (let i = 0; i < 950; i++) {
    const x = (i * 73 + (i % 17) * 19) % canvas.width
    const y = (i * 41 + (i % 23) * 31) % canvas.height
    ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, 1)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = 4
  return texture
}

export function MapBackdropLayer() {
  const texture = useMemo(() => makeTexture(), [])

  return (
    <group>
      <mesh position={[0, -0.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2100, 1600, 1, 1]} />
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? '#ffffff' : '#101820'}
          roughness={0.82}
          metalness={0.12}
          emissive="#061017"
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh position={[-760, -0.65, 10]} rotation={[-Math.PI / 2, 0, -0.08]}>
        <planeGeometry args={[230, 1430, 1, 1]} />
        <meshBasicMaterial color="#0b5368" transparent opacity={0.34} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[675, 680, 160]} />
        <meshBasicMaterial color="#39506b" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}
