import type * as THREE from "three";

import type { PerfBackend } from "./types";
import { WebGLPerfBackend } from "./webgl";
import { WebGpuPerfBackend } from "./webgpu";

/**
 * Bề mặt của `WebGPURenderer` mà r3f-monitor đọc tới.
 *
 * KHÔNG import giá trị nào từ `three/webgpu`. Nếu import tĩnh thì consumer chỉ
 * dùng WebGL vẫn phải kéo cả build WebGPU (~1MB) vào bundle. May là ta không
 * cần giá trị nào: chỉ đọc property trên instance user đưa vào, còn hằng
 * `TimestampQuery.RENDER` thực chất là string `"render"`.
 */
export type WebGpuRendererLike = {
  isWebGPURenderer: true;
  backend: {
    isWebGPUBackend?: boolean;
    trackTimestamp?: boolean;
    /** Chỉ có trên backend WebGL2 của WebGPURenderer. */
    gl?: WebGL2RenderingContext;
  };
  info: {
    autoReset: boolean;
    render: {
      calls: number;
      frameCalls: number;
      drawCalls: number;
      triangles: number;
      points: number;
      lines: number;
      timestamp: number;
    };
    compute: {
      calls: number;
      frameCalls: number;
      timestamp: number;
    };
    memory: {
      geometries: number;
      textures: number;
      texturesSize: number;
      attributes: number;
      attributesSize: number;
      indexAttributesSize: number;
      programs: number;
      total: number;
    };
    reset(): void;
  };
  hasFeature(name: string): boolean;
  resolveTimestampsAsync(type?: "render" | "compute"): Promise<number | undefined>;
};

export type AnyRenderer = THREE.WebGLRenderer | WebGpuRendererLike;

/**
 * Phân biệt bằng runtime, không bằng type.
 *
 * `useThree().gl` trong r3f 9.x khai báo cứng là `THREE.WebGLRenderer` kể cả khi
 * runtime là WebGPURenderer, nên type ở đây không đáng tin.
 */
export function isWebGpuRenderer(gl: unknown): gl is WebGpuRendererLike {
  return (
    typeof gl === "object" &&
    gl !== null &&
    (gl as { isWebGPURenderer?: boolean }).isWebGPURenderer === true
  );
}

/** Chọn adapter theo renderer thật đang chạy. */
export function createBackend(
  gl: AnyRenderer,
  scene: THREE.Scene,
): PerfBackend {
  return isWebGpuRenderer(gl)
    ? new WebGpuPerfBackend(gl, scene)
    : new WebGLPerfBackend(gl as THREE.WebGLRenderer, scene);
}
