// src/helpers/estimateMemory.ts
import * as THREE from "three";

export function estimateMemory(scene: THREE.Object3D) {
  let textureMemory = 0;
  let geometryMemory = 0;

  const geometriesSeen = new Set<string>();
  const texturesSeen = new Set<string>();

  scene.traverse((object) => {
    if ((object as any).isMesh) {
      const mesh = object as THREE.Mesh;

      // --- 1. Tính Geometry ---
      if (mesh.geometry && !geometriesSeen.has(mesh.geometry.uuid)) {
        geometriesSeen.add(mesh.geometry.uuid);

        // Attributes (position, normal, uv...)
        const attributes = mesh.geometry.attributes;
        for (const name in attributes) {
          const attr = attributes[name];
          // attr.array.byteLength là chính xác nhất
          if (attr.array) geometryMemory += attr.array.byteLength;
        }
        // Indices
        if (mesh.geometry.index && mesh.geometry.index.array) {
          geometryMemory += mesh.geometry.index.array.byteLength;
        }
      }

      // --- 2. Tính Material & Textures ---
      const material = mesh.material;
      const materials = Array.isArray(material) ? material : [material];

      materials.forEach((mat) => {
        if (!mat) return;

        for (const key in mat) {
          const value = mat[key as keyof THREE.Material];
          if (value && (value as THREE.Texture).isTexture) {
            const tex = value as THREE.Texture;

            if (!texturesSeen.has(tex.uuid)) {
              texturesSeen.add(tex.uuid);

              // Nếu là CompressedTexture (KTX2, DDS...)
              if ((tex as any).isCompressedTexture && (tex as any).mipmaps) {
                // Cộng tổng dung lượng các mipmaps đã nén
                (tex as any).mipmaps.forEach((mip: any) => {
                  if (mip.data) textureMemory += mip.data.byteLength;
                });
              }
              // Nếu là Texture thường (JPG, PNG...) -> Tính kích thước giải nén
              else if (tex.image) {
                const image = tex.image as { width?: number; height?: number };
                const width = image.width || 0;
                const height = image.height || 0;
                // 4 bytes (RGBA) * 1.33 (Mipmaps estimate)
                const mipmapFactor = tex.generateMipmaps ? 1.33 : 1;
                textureMemory += width * height * 4 * mipmapFactor;
              }
            }
          }
        }
      });
    }
  });

  return {
    geometry: geometryMemory,
    texture: textureMemory,
    total: geometryMemory + textureMemory,
  };
}
