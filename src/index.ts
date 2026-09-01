// ── UI mặc định ──────────────────────────────────────────────
export { PerfMonitor } from "./components/PerfMonitor";

// ── Headless / Bring your own UI ─────────────────────────────
/**
 * Chạy đo, không render UI. Đặt trong <Canvas>.
 * Kết hợp <PerfAdaptive /> để adaptive quality theo FPS.
 */
export { PerfHeadless } from "./components/PerfHeadless";

/**
 * Hook đọc số liệu để tự dựng UI.
 * - `usePerfData()` → toàn bộ { fps, cpu, gpu, mem, vram, gl, infos }.
 * - `usePerfData(d => d.fps)` → lấy đúng field cần (chỉ re-render khi field đổi).
 */
export { usePerfData, type PerfData } from "./hooks/usePerfData";

// ── Backend (WebGL / WebGPU) ─────────────────────────────────
/**
 * r3f-monitor tự nhận renderer đang chạy — WebGLRenderer hay WebGPURenderer —
 * và chọn đường đo tương ứng. Không phải cấu hình gì thêm.
 *
 * Lưu ý `backend` khác `api`: WebGPURenderer của three có cả backend WebGL2 và
 * tự rơi về đó khi máy không có `navigator.gpu`, nên `backend: "webgpu"` vẫn có
 * thể đi kèm `api: "webgl2"`.
 */
export type {
  BackendApi,
  BackendKind,
  FrameStats,
  MemorySource,
} from "./backends/types";

// ── Adaptive quality ─────────────────────────────────────────
/**
 * Điều chỉnh `factor` (0-1) để giảm/tăng chất lượng theo FPS.
 * Lấy số liệu {fps, gpu, cpu} từ PerfHeadless — cần <PerfHeadless /> trong
 * <Canvas> (giống usePerfData). API tương thích drei <PerformanceMonitor>.
 */
export {
  PerfAdaptive,
  usePerfAdaptive,
  type PerfAdaptiveProps,
} from "./performance/PerfAdaptive";
export {
  AdaptiveEngine,
  type AdaptiveEngineOptions,
  type AdaptiveCallbacks,
} from "./performance/AdaptiveEngine";
export { detectRefreshRate } from "./performance/detectRefreshRate";

// ── GPU tier ─────────────────────────────────────────────────
/**
 * Phát hiện tier GPU (0-3) qua @pmndrs/detect-gpu — chọn chất lượng
 * khởi điểm theo máy, rồi để PerfAdaptive tinh chỉnh runtime.
 * Hook suspend — component dùng nó cần nằm trong <Suspense>.
 */
export {
  useGpuTier,
  useDetectGPU,
  GpuTier,
  type GpuTierProps,
} from "./performance/useGpuTier";
