import type * as THREE from "three";

import type { WebGpuRendererLike } from "./detect";
import type {
  FrameStats,
  GpuTiming,
  MemoryStats,
  PerfBackend,
  RendererInfos,
} from "./types";

/** `TimestampQuery.RENDER` / `.COMPUTE` của three chỉ là hai string này. */
const RENDER = "render" as const;
const COMPUTE = "compute" as const;

type GpuAdapterInfo = {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
};

/**
 * Adapter cho `WebGPURenderer` — phủ CẢ backend WebGPU lẫn backend WebGL2 của nó,
 * vì three expose chung một API cho hai đường (`WebGLTimestampQueryPool` dùng
 * `EXT_disjoint_timer_query_webgl2` bên dưới, nhưng lộ ra cùng
 * `resolveTimestampsAsync()` / `info.render.timestamp`).
 */
export class WebGpuPerfBackend implements PerfBackend {
  readonly kind = "webgpu" as const;

  /**
   * Node material biên dịch thẳng ra pipeline WGSL; `info.memory.programs` chỉ là
   * con số, không phải mảng có `cacheKey` để ghép ngược về material. Đường đi cho
   * bản sau là `renderer.inspector` (three r185+).
   */
  readonly supportsProgramAnalysis = false;

  private gl: WebGpuRendererLike;
  private timingOn = false;

  // `_scene` chưa dùng: bản phân tích program dựa trên `renderer.inspector` sẽ cần,
  // giữ chữ ký khớp với WebGLPerfBackend cho `createBackend`.
  constructor(gl: WebGpuRendererLike, _scene: THREE.Scene) {
    this.gl = gl;
  }

  get gpuTimingAvailable() {
    return this.timingOn;
  }

  start() {
    this.gl.info.autoReset = false;

    // `trackTimestamp` mặc định false và thường được truyền lúc `new WebGPURenderer()`.
    // Bật được sau `init()` vì three request TẤT CẢ feature adapter hỗ trợ khi tạo
    // device (`requiredFeatures: supportedFeatures`), không gate theo cờ này — nên
    // device đã sẵn `timestamp-query`. Nhờ vậy người dùng không phải sửa chỗ khởi
    // tạo renderer để đo được GPU.
    try {
      if (this.gl.hasFeature("timestamp-query")) {
        this.gl.backend.trackTimestamp = true;
        this.timingOn = true;
      }
    } catch {
      this.timingOn = false;
    }
  }

  async readInfos(): Promise<RendererInfos> {
    const isWebGpu = this.gl.backend.isWebGPUBackend === true;

    if (!isWebGpu) {
      // Rơi về backend WebGL2 thì lại có context WebGL thật để hỏi — dùng nó thay
      // vì trả "Unknown", vì đây là đường mặc định trên máy không có WebGPU.
      const ctx = this.gl.backend.gl;
      const debugInfo: any = ctx?.getExtension("WEBGL_debug_renderer_info");

      return {
        version: ctx
          ? ctx.getParameter(ctx.VERSION)
          : "WebGPURenderer (WebGL 2 backend)",
        renderer:
          (debugInfo &&
            ctx?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) ||
          ctx?.getParameter(ctx.RENDERER) ||
          "Unknown renderer",
        vendor:
          (debugInfo && ctx?.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)) ||
          "Unknown vendor",
        backend: "webgpu",
        api: "webgl2",
      };
    }

    // `getContext()` của Renderer trả `unknown`, không có WEBGL_debug_renderer_info.
    // Nguồn duy nhất cho vendor/device là adapter info.
    let info: GpuAdapterInfo = {};
    try {
      const adapter = await navigator.gpu?.requestAdapter();
      info = ((adapter as unknown as { info?: GpuAdapterInfo })?.info ??
        {}) as GpuAdapterInfo;
    } catch {
      /* giữ giá trị mặc định bên dưới */
    }

    const renderer =
      info.description ||
      [info.vendor, info.architecture].filter(Boolean).join(" ") ||
      "Unknown renderer";

    return {
      version: "WebGPU",
      renderer,
      vendor: info.vendor || "Unknown vendor",
      backend: "webgpu",
      api: "webgpu",
    };
  }

  beginFrame() {
    this.gl.info.reset();
  }

  endFrame() {
    if (!this.timingOn) return;

    // three KHÔNG tự resolve: `info[type].timestamp` chỉ được ghi bên trong
    // `resolveTimestampsAsync()`. Không gọi thì query pool đầy (2048) rồi warn.
    // Fire-and-forget — three tự chặn gọi chồng bằng cờ `pendingResolve`, nên kết
    // quả về trễ vài frame. Chấp nhận được với một HUD.
    void this.gl.resolveTimestampsAsync(RENDER).catch(() => {});
    if (this.gl.info.compute.frameCalls > 0) {
      void this.gl.resolveTimestampsAsync(COMPUTE).catch(() => {});
    }
  }

  readFrameStats(): FrameStats {
    const { render, compute, memory } = this.gl.info;
    return {
      // `render.calls` là cộng dồn từ lúc chạy; số của FRAME là `drawCalls`.
      calls: render.drawCalls,
      triangles: render.triangles,
      points: render.points,
      lines: render.lines,
      geometries: memory.geometries,
      textures: memory.textures,
      programs: memory.programs,
      computeCalls: compute.frameCalls,
    };
  }

  readGpuTiming(): GpuTiming {
    return {
      render: this.gl.info.render.timestamp,
      compute: this.gl.info.compute.timestamp,
    };
  }

  /** Byte thật do three theo dõi — không phải ước lượng như đường WebGL. */
  readMemory(): MemoryStats {
    const memory = this.gl.info.memory;
    const geo = memory.attributesSize + memory.indexAttributesSize;

    return {
      vram: memory.total / 1024 / 1024,
      tex: memory.texturesSize / 1024 / 1024,
      geo: geo / 1024 / 1024,
      source: "measured",
    };
  }

  analyzePrograms(): null {
    return null;
  }

  dispose() {
    this.timingOn = false;
  }
}
