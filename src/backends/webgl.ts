import * as THREE from "three";

import { estimateMemory } from "../helpers/estimateMemory";
import { countGeoDrawCalls } from "../helpers/countGeoDrawCalls";
import type { ProgramsPerf, ProgramsPerfs } from "../store";
import type {
  FrameStats,
  GpuTiming,
  MemoryStats,
  PerfBackend,
  RendererInfos,
} from "./types";

const isUUID = (uuid: string) =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    uuid,
  );

const getMUIIndex = (muid: string) => muid === "muiPerf";

const addMuiPerfID = (
  material: THREE.Material,
  currentObjectWithMaterials: Record<string, any>,
) => {
  material.defines ||= {};
  if (!material.defines.muiPerf) {
    material.defines = Object.assign(material.defines || {}, {
      muiPerf: material.uuid,
    });
    material.needsUpdate = true;
  }

  const uuid = material.uuid;
  if (!currentObjectWithMaterials[uuid]) {
    currentObjectWithMaterials[uuid] = { meshes: {}, material };
  }
  material.needsUpdate = false;
  return uuid;
};

/**
 * Adapter cho `THREE.WebGLRenderer` — đường đo của v2.
 *
 * GPU time đi qua `EXT_disjoint_timer_query_webgl2` tự quản: mở query trước
 * frame, đóng sau frame, đẩy vào hàng đợi rồi đọc kết quả ở các frame sau (query
 * không sẵn sàng ngay trong frame). Nghĩa là số GPU trễ vài frame — giống hệt
 * đường WebGPU, nên hai backend nhất quán về mặt này.
 */
export class WebGLPerfBackend implements PerfBackend {
  readonly kind = "webgl" as const;
  readonly supportsProgramAnalysis = true;

  private gl: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private ctx: WebGLRenderingContext | WebGL2RenderingContext;
  private ext: any = null;

  private activeQuery: WebGLQuery | null = null;
  private queries: WebGLQuery[] = [];
  private gpuDuration = 0;
  private lastProgramCount = -1;

  constructor(gl: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.gl = gl;
    this.scene = scene;
    this.ctx = gl.getContext();
  }

  get gpuTimingAvailable() {
    return this.ext !== null;
  }

  start() {
    this.ext = this.ctx.getExtension("EXT_disjoint_timer_query_webgl2");
    if (this.gl.info) this.gl.info.autoReset = false;
  }

  async readInfos(): Promise<RendererInfos> {
    const ctx = this.ctx;
    const debugInfo: any = ctx.getExtension("WEBGL_debug_renderer_info");

    let renderer: string | null = null;
    let vendor: string | null = null;

    if (debugInfo) {
      renderer = ctx.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      vendor = ctx.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    }

    return {
      version: ctx.getParameter(ctx.VERSION),
      renderer: renderer || ctx.getParameter(ctx.RENDERER),
      vendor: vendor || "Unknown vendor",
      backend: "webgl",
      api: "webgl2",
    };
  }

  beginFrame() {
    this.gl.info?.reset();

    const ctx = this.ctx as WebGL2RenderingContext;
    const ext = this.ext;
    if (!ext) return;

    // Đọc kết quả các query đã xong trước khi mở query mới.
    this.drainQueries();

    if (this.activeQuery) ctx.endQuery(ext.TIME_ELAPSED_EXT);

    this.activeQuery = ctx.createQuery();
    if (this.activeQuery) ctx.beginQuery(ext.TIME_ELAPSED_EXT, this.activeQuery);
  }

  endFrame() {
    const ctx = this.ctx as WebGL2RenderingContext;
    const ext = this.ext;
    if (!ext || !this.activeQuery) return;

    ctx.endQuery(ext.TIME_ELAPSED_EXT);
    this.queries.push(this.activeQuery);
    this.activeQuery = null;
  }

  private drainQueries() {
    const ctx = this.ctx as WebGL2RenderingContext;
    const ext = this.ext;
    if (!ext) return;

    this.gpuDuration = 0;

    for (let i = this.queries.length - 1; i >= 0; i--) {
      const query = this.queries[i];
      const available = ctx.getQueryParameter(query, ctx.QUERY_RESULT_AVAILABLE);
      const disjoint = ctx.getParameter(ext.GPU_DISJOINT_EXT);

      if (available && !disjoint) {
        const elapsed = ctx.getQueryParameter(query, ctx.QUERY_RESULT);
        // nanoseconds -> milliseconds
        this.gpuDuration += elapsed * 1e-6;
        ctx.deleteQuery(query);
        this.queries.splice(i, 1);
      }
    }
  }

  readFrameStats(): FrameStats {
    const info = this.gl.info;
    return {
      calls: info.render.calls,
      triangles: info.render.triangles,
      points: info.render.points,
      lines: info.render.lines,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      computeCalls: 0,
    };
  }

  readGpuTiming(): GpuTiming {
    return { render: this.gpuDuration, compute: 0 };
  }

  readMemory(): MemoryStats {
    const stats = estimateMemory(this.scene);
    return {
      vram: stats.total / 1024 / 1024,
      tex: stats.texture / 1024 / 1024,
      geo: stats.geometry / 1024 / 1024,
      source: "estimated",
    };
  }

  /**
   * Ghép `gl.info.programs[]` với material trong scene qua define `muiPerf`
   * nhét vào shader — chỉ WebGL mới làm được, node material của WebGPU không
   * đi qua đường này.
   */
  analyzePrograms(): ProgramsPerfs | null {
    const currentObjectWithMaterials: Record<string, any> = {};
    const programs: ProgramsPerfs = new Map();

    this.scene.traverse((object: any) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) {
        return;
      }
      if (!object.material) return;

      const isTroika =
        Array.isArray(object.material) && object.material.length > 1;

      const uuid = isTroika
        ? addMuiPerfID(object.material[1], currentObjectWithMaterials)
        : addMuiPerfID(object.material, currentObjectWithMaterials);

      currentObjectWithMaterials[uuid].meshes[object.uuid] = object;
    });

    this.gl.info?.programs?.forEach((program: any) => {
      const cacheKeySplited = program.cacheKey.split(",");
      const muiPerfTracker =
        cacheKeySplited[cacheKeySplited.findIndex(getMUIIndex) + 1];

      if (!isUUID(muiPerfTracker) || !currentObjectWithMaterials[muiPerfTracker])
        return;

      const { material, meshes } = currentObjectWithMaterials[muiPerfTracker];

      programs.set(muiPerfTracker, {
        program,
        material,
        meshes,
        drawCounts: { total: 0, type: "triangle", data: [] },
        expand: false,
        visible: true,
      } as ProgramsPerf);
    });

    // Phải so bằng KẾT QUẢ, không so bằng `info.programs.length`: lần quét đầu
    // mới nhét define `muiPerf` vào material và bắt recompile, nên cacheKey chưa
    // chứa nó — map ra rỗng. Số program thì đã đúng ngay từ đầu, gate theo nó sẽ
    // chặn mất lần quét thứ hai và danh sách rỗng vĩnh viễn.
    if (programs.size === this.lastProgramCount) return null;
    this.lastProgramCount = programs.size;

    countGeoDrawCalls(programs);
    return programs;
  }

  dispose() {
    const ctx = this.ctx as WebGL2RenderingContext;
    const ext = this.ext;

    try {
      if (ext && this.activeQuery) {
        ctx.endQuery(ext.TIME_ELAPSED_EXT);
        ctx.deleteQuery(this.activeQuery);
      }
    } catch {
      /* query có thể đã không còn active */
    }
    this.activeQuery = null;

    for (const query of this.queries) {
      try {
        ctx.deleteQuery(query);
      } catch {
        /* empty */
      }
    }
    this.queries.length = 0;
    this.gpuDuration = 0;
    this.lastProgramCount = -1;
  }
}
