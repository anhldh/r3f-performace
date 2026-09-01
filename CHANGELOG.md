# R3F-MONITOR

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/).

## 3.0.0 - 2026-08-31

**WebGPU support.** `<PerfMonitor />` and `<PerfHeadless />` now detect the
renderer at runtime and measure either three's `WebGPURenderer` or the classic
`WebGLRenderer` — no configuration, no separate component.

**Existing WebGL projects need no changes.**

### Added

- **WebGPU measurement path.** Picked from the renderer instance at runtime, and
  covers both of `WebGPURenderer`'s backends (WebGPU and its WebGL 2 fallback).
  GPU time comes from three's timestamp queries, which r3f-monitor enables
  itself — you do not have to pass `trackTimestamp` when creating the renderer.
- **GPU compute metric.** `COMPUTE` (ms) and `DISPATCH` (dispatches per frame)
  appear in both UIs, but only once the scene actually dispatches compute — an
  ordinary scene never does, so the row stays hidden. Note that `GPU` covers the
  render pass only: total GPU time is `GPU + COMPUTE`.
- **Measured VRAM on WebGPU.** three tracks real allocated bytes there, so the
  figure is exact instead of estimated by walking the scene graph. The new
  `usePerfData().vramSource` (`"measured"` | `"estimated"`) says which one you
  are looking at — the two backends will report different numbers for the same
  scene, and that is not a bug.
- `usePerfData()` gains `gpuCompute`, `vramSource`, `gl.computeCalls`, and
  `infos.backend` / `infos.api`. `backend` is the renderer class, `api` is the
  GPU API actually in use, so a `WebGPURenderer` that fell back reports
  `backend: "webgpu"` with `api: "webgl2"`.

### Changed

- Measurement core split into a renderer-agnostic sampler (FPS, CPU, throttling,
  chart) plus a per-renderer backend adapter. No API change.
- `usePerfData().gl` now reads a normalized per-frame snapshot instead of the
  renderer's `info` directly — the two renderers disagree on field names, and
  `render.calls` means "this frame" on WebGL but "since startup" on WebGPU.
- TypeScript: the store's `gl` widened from `THREE.WebGLRenderer` to a union
  including `WebGPURenderer`. Only affects code reading `usePerf((s) => s.gl)`.

### Not supported on WebGPU

- **`deepAnalyze`.** Node materials compile straight to WGSL pipelines, leaving
  no enumerable program list to map back to materials. It warns once and every
  other metric keeps working. WebGL is unaffected.

## 2.2.0 - 2026-07-14

### Added

- **Adaptive quality.**
  - **`<PerfAdaptive />`** — automatically raises/lowers a quality `factor`
    (0–1) based on sustained FPS. API mirrors drei's `<PerformanceMonitor>`
    (`iterations`, `threshold`, `step`, `bounds`, `flipflops`,
    `onIncline` / `onDecline` / `onChange` / `onFallback`), so existing code
    ports 1:1. It renders nothing and only listens to the measurement engine —
    mount `<PerfHeadless />` or `<PerfMonitor />` alongside it.
  - **`usePerfAdaptive()`** — hook for children of `<PerfAdaptive />`,
    equivalent of drei's `usePerformanceMonitor`.
  - **`AdaptiveEngine`** — the decision core as a plain framework-agnostic
    class (`addSample(fps, gpu?, cpu?)`), usable without React.
  - Each sample carries the real **GPU/CPU render times**, so callbacks can
    tell GPU-bound from CPU-bound and pick the right quality lever.
- **`useGpuTier()`** (+ drei-compatible alias `useDetectGPU`, render-prop
  component `<GpuTier>`) — suspending wrapper around `@pmndrs/detect-gpu` to
  pick a sensible starting quality per device.
- **`detectRefreshRate()`** — measures the display refresh rate from the rAF
  cadence (median of the shortest frame intervals, robust to mount jank).
  `<PerfAdaptive />` runs it automatically to seed the engine's `refreshrate`
  (refined by the highest FPS seen), so FPS bounds are right even when the
  scene is heavy from the very first frame.
- Adaptive decisions run **before** the next frame renders (queued from the
  measurement tick, flushed pre-frame), so quality changes like `setDpr` never
  composite a cleared buffer — no one-frame flash.
- The engine consumes **raw (non-EMA) FPS**, reacting to sudden drops in
  ~1s instead of several seconds; the UI keeps showing the smoothed value.

### Changed

- **Measurement core extracted into a ref-counted singleton** (`perfCore`).
  Mounting several measuring components at once (e.g. `<PerfHeadless />` +
  `<PerfMonitor />`, or toggling the UI on/off) now runs exactly **one**
  engine — no more conflicting GPU timer queries, doubled log events, or
  double-counted accumulated stats. The first mount's options win; a console
  warning is logged if a later mount passes different options. No API change.

### Fixed

- Docs: `fpsTiers` / `onTierChange` were documented in 2.1.0 but never
  shipped. Adaptive quality is now provided by `<PerfAdaptive />`.

## 2.1.0 - 2026-06-30

### Added

- **Headless mode.** Bring your own UI and/or drive adaptive quality without the
  built-in panel:
  - **`<PerfHeadless />`** — runs the measurement engine only, no UI. Place it
    inside `<Canvas>`. Accepts `logsPerSecond`, plus `fpsTiers` + `onTierChange`
    for adaptive quality.
  - **`usePerfData()`** — read the live metrics from anywhere (works outside
    `<Canvas>`). Call with no args for the full snapshot, or pass a selector
    (`usePerfData((d) => d.fps)`) to subscribe to a single field and avoid
    unnecessary re-renders.
  - **Adaptive quality** — pass `fpsTiers` to `<PerfHeadless />` and receive
    `onTierChange` callbacks when the sustained FPS crosses a tier boundary.

### Changed

- Internal refactor to share the measurement store between `<PerfMonitor />` and
  `<PerfHeadless />`. No behavior change for existing `<PerfMonitor />` users; no
  API changes.

## 2.0.0 - 2026-06-02

Reworked measurement core. The `1.x` line (last release `1.2.0`) is now closed
and keeps the legacy logic; pin to `1.2.0` if you depend on the old behavior.

### Added

- **New measurement engine** (WebGL-only):
  - **FPS** measured over a real 1-second sliding window, reported as a continuous (non-integer) value and smoothed with a light EMA to remove ±1 flicker.
  - **CPU** measured as render-phase wall-clock time accumulated per frame via `performance.now()`.
  - **GPU** measured with a WebGL2 timer-query queue (`EXT_disjoint_timer_query_webgl2`), reported in true milliseconds.
- Bar graph (`graphType: "bar"`): left-scrolling render with a fixed high-water vertical scale and a per-metric gradient fill; header now shows the current value with a colored unit suffix.

### Changed

- **GPU time is now reported in real milliseconds** instead of the previous scaled value. Re-baseline any thresholds that compared against `1.x` numbers.
- CPU measurement switched from the `performance.mark`/`performance.measure` (User Timing) approach to `performance.now()` accumulation (lighter, avoids the iOS `measure` null quirk).

### Removed

- **Overclock mode.** The `overClock` prop and the V-Sync-bypass FPS estimation (`requestIdleCallback`-based) have been removed, along with the related `overclockingFps` state and 120Hz auto-detection. (Still available in `1.2.0`.)

### Migration

- Remove the `overClock` prop from `<PerfMonitor />`. To keep overclock, pin to `r3f-monitor@1.2.0`.

## 1.2.0

Final release of the `1.x` line — retains the legacy FPS/CPU/GPU logic and overclock mode.

## 1.0.2

### Fixed

- Fix some errors and warnings.

## 1.0.0

### Added

- Introduced the new monitor UI.

## 0.1.0

### Added

- Initial release.
