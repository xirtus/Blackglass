import * as THREE from 'three';

export interface HumanReport {
  triangles: number;
  drawCalls: number;
  skinnedMeshes: number;
  bones: number;
  textureBytes: number;
  geometryBytes: number;
  perMesh: { name: string; triangles: number; vertices: number }[];
}

export function inspectObject(root: THREE.Object3D): HumanReport {
  let triangles = 0, drawCalls = 0, skinnedMeshes = 0, geometryBytes = 0, textureBytes = 0;
  const perMesh: HumanReport['perMesh'] = [];
  const bones = new Set<THREE.Bone>();
  const textures = new Set<THREE.Texture>();
  root.traverse((o) => {
    if (o instanceof THREE.Bone) bones.add(o);
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      drawCalls++;
      const g = mesh.geometry;
      const idx = g.getIndex();
      const tris = (idx ? idx.count : g.getAttribute('position').count) / 3;
      triangles += tris;
      for (const a of Object.values(g.attributes)) geometryBytes += (a as THREE.BufferAttribute).array.byteLength;
      if (idx) geometryBytes += idx.array.byteLength;
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes++;
      perMesh.push({ name: mesh.name || mesh.type, triangles: Math.round(tris), vertices: g.getAttribute('position').count });
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const sm = m as THREE.MeshStandardMaterial;
        for (const t of [sm.map, sm.normalMap, sm.roughnessMap, sm.bumpMap]) if (t) textures.add(t);
      }
    }
  });
  for (const t of textures) {
    const img = t.image as { width?: number; height?: number } | undefined;
    if (img?.width && img?.height) textureBytes += img.width * img.height * 4;
  }
  return {
    triangles: Math.round(triangles), drawCalls, skinnedMeshes, bones: bones.size,
    textureBytes, geometryBytes, perMesh,
  };
}

export function formatReport(name: string, r: HumanReport): string {
  const mb = (b: number) => (b / 1048576).toFixed(2) + ' MB';
  return [
    `Character: ${name}`,
    `  triangles: ${r.triangles}`,
    `  drawCalls: ${r.drawCalls}`,
    `  skinnedMeshes: ${r.skinnedMeshes}`,
    `  bones: ${r.bones}`,
    `  geometry: ${mb(r.geometryBytes)}`,
    `  textures (VRAM est): ${mb(r.textureBytes)}`,
    ...r.perMesh.map((m) => `    - ${m.name}: ${m.triangles} tris, ${m.vertices} verts`),
  ].join('\n');
}
