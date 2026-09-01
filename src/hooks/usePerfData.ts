import { usePerf } from "../store";
import type {
  BackendApi,
  BackendKind,
  MemorySource,
} from "../backends/types";

/**
 * Toàn bộ số liệu hiệu năng đã throttle, sẵn sàng để render UI.
 * - fps/cpu/gpu/mem/vram: số "nóng", đổi theo `logsPerSecond` (~10 lần/giây).
 * - gl: thống kê render của frame gần nhất.
 * - infos: thông tin renderer (đứng yên cả phiên).
 */
export type PerfData = {
  fps: number;
  cpu: number;
  gpu: number;
  /** ms của compute pass. WebGPU only — WebGL luôn 0. */
  gpuCompute: number;
  mem: number;
  vram: number;
  /** `measured` (WebGPU, byte thật) hay `estimated` (WebGL, đoán từ scene). */
  vramSource: MemorySource;
  gl: {
    calls: number;
    triangles: number;
    points: number;
    lines: number;
    geometries: number;
    textures: number;
    programs: number;
    /** Compute dispatch trong frame. WebGL luôn 0. */
    computeCalls: number;
  };
  infos: {
    version: string;
    renderer: string;
    vendor: string;
    /** Class renderer: `webgl` = WebGLRenderer, `webgpu` = WebGPURenderer. */
    backend: BackendKind;
    /** GPU API thật bên dưới — WebGPURenderer có thể đang chạy backend `webgl2`. */
    api: BackendApi;
  };
};

/** Gom state thô của store thành PerfData phẳng. */
const select = (s: import("../store").State): PerfData => ({
  fps: s.log?.fps ?? 0,
  cpu: s.log?.cpu ?? 0,
  gpu: s.log?.gpu ?? 0,
  gpuCompute: s.log?.gpuCompute ?? 0,
  mem: s.log?.mem ?? 0,
  vram: s.estimatedMemory.vram,
  vramSource: s.estimatedMemory.source,
  // Đọc snapshot đã chuẩn hoá thay vì chọc vào `s.gl.info`: WebGLRenderer và
  // WebGPURenderer có shape `info` khác nhau (vd draw call của frame là
  // `render.calls` bên này nhưng `render.drawCalls` bên kia).
  gl: s.glStats,
  infos: s.infos,
});

/**
 * Hook đọc số liệu hiệu năng để tự dựng UI ("bring your own UI").
 *
 * Cần render <PerfHeadless /> bên trong <Canvas> để có dữ liệu. Update theo
 * nhịp `logsPerSecond` của PerfHeadless, không re-render mỗi frame.
 *
 * @example
 * // Lấy tất cả
 * const { fps, gpu, gl, infos } = usePerfData();
 *
 * @example
 * // Chỉ lấy field cần → chỉ re-render khi field đó đổi
 * const fps = usePerfData((d) => d.fps);
 */
export function usePerfData(): PerfData;
export function usePerfData<T>(selector: (data: PerfData) => T): T;
export function usePerfData<T>(selector?: (data: PerfData) => T) {
  return usePerf((s) => {
    const data = select(s);
    return selector ? selector(data) : data;
  });
}
