import { type FC, useEffect, useMemo } from "react";
import {
  addAfterEffect,
  addEffect,
  addTail,
  useThree,
} from "@react-three/fiber";
import * as THREE from "three";

import { overLimitFps, GLPerf } from "../internal";
import { countGeoDrawCalls } from "../helpers/countGeoDrawCalls";
import { getPerf, type ProgramsPerfs, setPerf } from "../store";
import type { PerfProps } from "../types";
import { emitEvent } from "../events/vanilla";
import { estimateMemory } from "../helpers/estimateMemory";

const updateMatrixWorldTemp = THREE.Object3D.prototype.updateMatrixWorld;
const updateWorldMatrixTemp = THREE.Object3D.prototype.updateWorldMatrix;
const updateMatrixTemp = THREE.Object3D.prototype.updateMatrix;

const maxGl = ["calls", "triangles", "points", "lines"] as const;
const maxLog = ["gpu", "cpu", "mem", "fps"] as const;

export const matriceWorldCount = { value: 0 };
export const matriceCount = { value: 0 };

const isUUID = (uuid: string) =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    uuid,
  );

const addMuiPerfID = (
  material: THREE.Material,
  currentObjectWithMaterials: any,
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
  // tránh flip needsUpdate liên tục
  material.needsUpdate = false;
  return uuid;
};

type Chart = {
  data: { [index: string]: number[] };
  id: number;
  circularId: number;
};

const getMUIIndex = (muid: string) => muid === "muiPerf";

/**
 * Performance profiler component (StrictMode-safe)
 */
export const PerfHeadless: FC<PerfProps> = ({
  overClock,
  logsPerSecond,
  chart,
  deepAnalyze,
  matrixUpdate,
}) => {
  const { gl, scene } = useThree();
  setPerf({ gl, scene });

  const memoryUpdateRate = 1000;
  let lastMemoryUpdate = 0;

  const PerfLib = useMemo(() => {
    const perf = new GLPerf({
      trackGPU: true,
      overClock: overClock,
      chartLen: chart ? chart.length : 120,
      chartHz: chart ? chart.hz : 60,
      logsPerSecond: logsPerSecond || 10,
      gl: gl.getContext(),

      chartLogger: (chart: Chart) => {
        setPerf({ chart });
      },

      paramLogger: (logger: any) => {
        const log = {
          maxMemory: logger.maxMemory,
          gpu: logger.gpu,
          cpu: logger.cpu,
          mem: logger.mem,
          fps: logger.fps,
          totalTime: logger.duration,
          frameCount: logger.frameCount,
        };

        setPerf({ log });

        // NOTE: accumulated đang bị mutate tại chỗ (giữ nguyên để tương thích)
        const { accumulated }: any = getPerf();
        const glRender: any = gl.info.render;

        accumulated.totalFrames++;
        accumulated.gl.calls += glRender.calls;
        accumulated.gl.triangles += glRender.triangles;
        accumulated.gl.points += glRender.points;
        accumulated.gl.lines += glRender.lines;

        accumulated.log.gpu += logger.gpu;
        accumulated.log.cpu += logger.cpu;
        accumulated.log.mem += logger.mem;
        accumulated.log.fps += logger.fps;

        for (let i = 0; i < maxGl.length; i++) {
          const key = maxGl[i];
          const value = glRender[key];
          if (value > accumulated.max.gl[key]) accumulated.max.gl[key] = value;
        }

        for (let i = 0; i < maxLog.length; i++) {
          const key = maxLog[i];
          const value = logger[key];
          if (value > accumulated.max.log[key])
            accumulated.max.log[key] = value;
        }

        setPerf({ accumulated });

        const glInfo = {
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          points: gl.info.render.points,
          lines: gl.info.render.lines,
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
          programs: gl.info.programs?.length || 0,
        };

        emitEvent("log", [log, glInfo]);
      },
    });

    // Infos (vendor/renderer)
    const ctx = gl.getContext();
    let glRenderer: string | null = null;
    let glVendor: string | null = null;

    const rendererInfo: any = ctx.getExtension("WEBGL_debug_renderer_info");
    const glVersion = ctx.getParameter(ctx.VERSION);

    if (rendererInfo) {
      glRenderer = ctx.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL);
      glVendor = ctx.getParameter(rendererInfo.UNMASKED_VENDOR_WEBGL);
    }

    glVendor ||= "Unknown vendor";
    glRenderer ||= ctx.getParameter(ctx.RENDERER);

    setPerf({
      startTime: window.performance.now(),
      infos: {
        version: glVersion,
        renderer: glRenderer as string,
        vendor: glVendor,
      },
    });

    return perf;
    // IMPORTANT: useMemo chỉ tạo 1 instance trên 1 mount.
    // StrictMode dev sẽ mount/unmount/mount => instance mới sẽ được tạo, và cleanup sẽ dispose.
  }, [overClock, chart, logsPerSecond, gl]);

  // sync settings changes
  useEffect(() => {
    if (!PerfLib) return;

    PerfLib.overClock = overClock || false;
    if (overClock === false) {
      setPerf({ overclockingFps: false });
      overLimitFps.value = 0;
      overLimitFps.isOverLimit = 0;
    }

    PerfLib.chartHz = chart?.hz || 60;
    PerfLib.chartLen = chart?.length || 120;
  }, [PerfLib, overClock, chart?.hz, chart?.length]);

  // main r3f hooks + optional deep analyze
  useEffect(() => {
    if (!gl.info) return;

    gl.info.autoReset = false;

    // optional: matrix update counting
    if (matrixUpdate) {
      THREE.Object3D.prototype.updateMatrixWorld = function (
        ...args: Parameters<typeof updateMatrixWorldTemp>
      ) {
        if (this.matrixWorldNeedsUpdate || args[0]) matriceWorldCount.value++;
        return updateMatrixWorldTemp.apply(this, args);
      };

      THREE.Object3D.prototype.updateWorldMatrix = function (
        ...args: Parameters<typeof updateWorldMatrixTemp>
      ) {
        matriceWorldCount.value++;
        return updateWorldMatrixTemp.apply(this, args);
      };

      THREE.Object3D.prototype.updateMatrix = function (
        ...args: Parameters<typeof updateMatrixTemp>
      ) {
        matriceCount.value++;
        return updateMatrixTemp.apply(this, args);
      };
    }

    // PRE frame: reset stats + start CPU mark + GPU begin
    const unsubEffect = addEffect(() => {
      if (getPerf().paused) setPerf({ paused: false });

      // GPU begin (StrictMode-safe, không patch Scene.prototype)
      PerfLib?.begin("profiler");

      if (window.performance) {
        window.performance.mark("cpu-started");
        (PerfLib as any).startCpuProfiling = true;
      }

      matriceWorldCount.value = 0;
      matriceCount.value = 0;

      gl.info.reset();
    });

    // AFTER frame: GPU end + nextFrame + deepAnalyze
    const unsubAfter = addAfterEffect(() => {
      // end GPU for the frame
      PerfLib?.end("profiler");

      if (PerfLib && !PerfLib.paused) {
        PerfLib.nextFrame(window.performance.now());

        if (overClock && typeof window.requestIdleCallback !== "undefined") {
          PerfLib.idleCbId = requestIdleCallback(PerfLib.nextFps);
        }
      }

      const now = window.performance.now();

      // --- THÊM ĐOẠN NÀY ĐỂ TÍNH VRAM ---
      if (now - lastMemoryUpdate > memoryUpdateRate) {
        lastMemoryUpdate = now;

        // Tính VRAM ước tính
        const vramStats = estimateMemory(scene);

        // Lấy RAM JS hiện tại từ PerfLib (đã tính ở GLPerf.ts)
        // PerfLib.currentMem trả về MB, ta giữ nguyên hoặc convert tùy ý
        const jsMem = (PerfLib as any).currentMem || 0;

        // Lưu vào store để UI lấy ra hiển thị
        // Bạn cần mở rộng type trong store nếu TypeScript báo lỗi
        setPerf({
          estimatedMemory: {
            vram: vramStats.total / 1024 / 1024, // Đổi ra MB
            tex: vramStats.texture / 1024 / 1024,
            geo: vramStats.geometry / 1024 / 1024,
            ram: jsMem, // Đã là MB
          },
        });
      }
      // ----------------------------------

      if (!deepAnalyze) return;

      const currentObjectWithMaterials: any = {};
      const programs: ProgramsPerfs = new Map();

      scene.traverse((object: any) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          if (!object.material) return;

          let uuid = object.material.uuid;
          const isTroika =
            Array.isArray(object.material) && object.material.length > 1;

          uuid = isTroika
            ? addMuiPerfID(object.material[1], currentObjectWithMaterials)
            : addMuiPerfID(object.material, currentObjectWithMaterials);

          currentObjectWithMaterials[uuid].meshes[object.uuid] = object;
        }
      });

      gl?.info?.programs?.forEach((program: any) => {
        const cacheKeySplited = program.cacheKey.split(",");
        const muiPerfTracker =
          cacheKeySplited[cacheKeySplited.findIndex(getMUIIndex) + 1];

        if (
          isUUID(muiPerfTracker) &&
          currentObjectWithMaterials[muiPerfTracker]
        ) {
          const { material, meshes } =
            currentObjectWithMaterials[muiPerfTracker];

          programs.set(muiPerfTracker, {
            program,
            material,
            meshes,
            drawCounts: { total: 0, type: "triangle", data: [] },
            expand: false,
            visible: true,
          });
        }
      });

      // NOTE: triggerProgramsUpdate++ đang mutate, giữ nguyên behavior cũ
      if (programs.size !== getPerf().programs.size) {
        countGeoDrawCalls(programs);
        setPerf({
          programs,
          triggerProgramsUpdate: getPerf().triggerProgramsUpdate + 1,
        });
      }
    });

    return () => {
      // cleanup requestIdleCallback
      if (PerfLib && typeof window.cancelIdleCallback !== "undefined") {
        window.cancelIdleCallback(PerfLib.idleCbId);
      }

      // dispose GPU query state (bạn cần implement trong GLPerf)
      PerfLib?.dispose?.();

      // restore matrix prototypes (FIX BUG: restore đúng biến)
      if (matrixUpdate) {
        THREE.Object3D.prototype.updateMatrixWorld = updateMatrixWorldTemp;
        THREE.Object3D.prototype.updateWorldMatrix = updateWorldMatrixTemp;
        THREE.Object3D.prototype.updateMatrix = updateMatrixTemp;
      }

      unsubEffect();
      unsubAfter();
    };
  }, [PerfLib, gl, scene, deepAnalyze, overClock, matrixUpdate]);

  // tail: when r3f stops rendering
  useEffect(() => {
    const unsub = addTail(() => {
      if (PerfLib) {
        PerfLib.paused = true;
        matriceCount.value = 0;
        matriceWorldCount.value = 0;

        setPerf({
          paused: true,
          log: {
            maxMemory: 0,
            gpu: 0,
            mem: 0,
            cpu: 0,
            fps: 0,
            totalTime: 0,
            frameCount: 0,
          },
        });
      }
      return false;
    });

    return () => unsub();
  }, [PerfLib]);

  return null;
};
