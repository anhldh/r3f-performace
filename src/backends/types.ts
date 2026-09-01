import type { ProgramsPerfs } from "../store";

/** Class renderer mà core đang bám vào. */
export type BackendKind = "webgl" | "webgpu";

/**
 * GPU API thật sự chạy bên dưới.
 *
 * Lưu ý: `kind === "webgpu"` KHÔNG đồng nghĩa `api === "webgpu"`.
 * WebGPURenderer của three có cả backend WebGL2 và tự rơi về đó khi máy
 * không có `navigator.gpu` — đó là đường fallback mặc định, không phải ngoại lệ.
 */
export type BackendApi = "webgl2" | "webgpu";

/** Thống kê render của MỘT frame, đã chuẩn hoá giữa hai backend. */
export type FrameStats = {
  /** Draw call trong frame. WebGL: `info.render.calls`. WebGPU: `info.render.drawCalls`. */
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

/**
 * VRAM đo được hay ước lượng.
 *
 * WebGPURenderer theo dõi byte thật (`info.memory.*Size`); WebGLRenderer không
 * có số đó nên phải duyệt scene mà đoán. Cùng một scene sẽ ra hai con số khác
 * nhau — field này để UI nói rõ thay vì để người dùng tưởng là bug.
 */
export type MemorySource = "measured" | "estimated";

export type MemoryStats = {
  /** MB */
  vram: number;
  tex: number;
  geo: number;
  source: MemorySource;
};

export type GpuTiming = {
  /** ms của render pass. 0 khi không đo được. */
  render: number;
  /** ms của compute pass. WebGL luôn 0. */
  compute: number;
};

export type RendererInfos = {
  version: string;
  renderer: string;
  vendor: string;
  backend: BackendKind;
  api: BackendApi;
};

/**
 * Lớp adapter che khác biệt giữa WebGLRenderer và WebGPURenderer.
 *
 * Phần toán (FPS, CPU, throttle, chart) nằm ở `sampler.ts` và dùng chung —
 * backend chỉ lo đọc số từ renderer.
 */
export interface PerfBackend {
  readonly kind: BackendKind;

  /** GPU time có đo được thật không. Với WebGPU chỉ biết chắc sau `start()`. */
  readonly gpuTimingAvailable: boolean;

  /** Bật những gì cần bật trên renderer. Đồng bộ — phần async đi qua `readInfos()`. */
  start(): void;

  /**
   * Vendor/renderer/version. Async vì WebGPU phải hỏi `navigator.gpu.requestAdapter()`.
   * Chỉ dùng để hiển thị nên về trễ một nhịp không sao.
   */
  readInfos(): Promise<RendererInfos>;

  /** Gọi trước khi r3f render frame. */
  beginFrame(): void;

  /** Gọi sau khi r3f render xong frame. */
  endFrame(): void;

  readFrameStats(): FrameStats;
  readGpuTiming(): GpuTiming;
  readMemory(): MemoryStats;

  /** Backend có liệt kê được shader program không. WebGPU: false. */
  readonly supportsProgramAnalysis: boolean;

  /**
   * Quét lại danh sách program. Trả `null` khi không có gì đổi so với lần quét
   * trước — `countGeoDrawCalls` khá nặng nên chỉ chạy khi số program thay đổi,
   * giữ đúng hành vi của v2.
   */
  analyzePrograms(): ProgramsPerfs | null;

  dispose(): void;
}
