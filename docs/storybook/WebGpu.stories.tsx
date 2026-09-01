import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { PerfMonitor } from "../../src/components/PerfMonitor";
import { usePerfData } from "../../src/hooks/usePerfData";
import { CameraControls } from "./CameraControls";
import { ComputeParticles } from "./ComputeParticles";
import { CpuParticles } from "./CpuParticles";
import { PrimitiveScene } from "./PrimitiveScene";
import { WebGpuCanvas } from "./WebGpuCanvas";

const LOADS = [
  { id: "light", label: "Light", count: 24, particles: 25_000 },
  { id: "medium", label: "Medium", count: 150, particles: 100_000 },
  { id: "heavy", label: "Heavy", count: 500, particles: 250_000 },
] as const;

type LoadId = (typeof LOADS)[number]["id"];

type SceneDemoProps = {
  /** Which renderer to mount the identical scene under. */
  mode?: "webgpu" | "webgl";
};

/**
 * Reads what r3f-monitor itself detected, rather than what the story asked for —
 * that is the whole point of the comparison. On a machine without WebGPU the
 * WebGPU story will report `api: "webgl2"` here, because WebGPURenderer silently
 * falls back to its own WebGL 2 backend.
 */
function BackendReadout() {
  const infos = usePerfData((data) => data.infos);
  const vram = usePerfData((data) => data.vram);
  const vramSource = usePerfData((data) => data.vramSource);
  const cpu = usePerfData((data) => data.cpu);
  const gpuCompute = usePerfData((data) => data.gpuCompute);

  const ready = infos.renderer !== "";
  const api = infos.api === "webgpu" ? "WebGPU" : "WebGL 2";
  const rendererClass =
    infos.backend === "webgpu" ? "WebGPURenderer" : "WebGLRenderer";

  return (
    <div className={`backend-badge is-${infos.api}`}>
      <span className="backend-dot" />
      <div className="backend-body">
        <strong>{ready ? api : "initialising…"}</strong>
        <span className="backend-sub">{rendererClass}</span>
      </div>
      <dl className="backend-facts">
        <div>
          <dt>CPU</dt>
          <dd>
            {cpu.toFixed(2)}
            <small>ms</small>
          </dd>
        </div>
        <div>
          <dt>GPU compute</dt>
          <dd>
            {infos.api === "webgpu" ? gpuCompute.toFixed(3) : "n/a"}
            {infos.api === "webgpu" && <small>ms</small>}
          </dd>
        </div>
        <div>
          <dt>VRAM</dt>
          <dd>
            {vram.toFixed(1)}
            <small>MB · {vramSource}</small>
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Storybook renders every story inside `iframe.html?id=…`, so this frame's own URL
 * already is the standalone page — opening it in a tab gives a full-window render
 * with nothing else competing for the GPU.
 */
function OpenInTab() {
  const href = typeof window === "undefined" ? "#" : window.location.href;

  return (
    <a className="open-standalone" href={href} target="_blank" rel="noreferrer">
      Open in new tab ↗
    </a>
  );
}

function SceneDemo({ mode = "webgpu" }: SceneDemoProps) {
  const [load, setLoad] = useState<LoadId>("light");
  const active = LOADS.find((entry) => entry.id === load) ?? LOADS[0];

  const contents = (
    <>
      <PerfMonitor displayType="tab" position="top-right" showGraph />
      <PrimitiveScene count={active.count} />
      <CameraControls />
    </>
  );

  const camera = { position: [0, 1.6, 8] as [number, number, number], fov: 48 };

  return (
    <main className="demo-shell">
      {mode === "webgpu" ? (
        <WebGpuCanvas className="demo-canvas" camera={camera} dpr={[1, 2]}>
          {contents}
          <ComputeParticles count={active.particles} size={0.05} />
        </WebGpuCanvas>
      ) : (
        <Canvas className="demo-canvas" camera={camera} dpr={[1, 2]}>
          {contents}
          <CpuParticles count={active.particles} size={0.05} />
        </Canvas>
      )}

      <BackendReadout />
      <OpenInTab />

      <div className="scene-toolbar" role="group" aria-label="Scene load">
        <span className="scene-toolbar-label">Load</span>
        {LOADS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={entry.id === load ? "is-active" : undefined}
            aria-pressed={entry.id === load}
            onClick={() => setLoad(entry.id)}
          >
            {entry.label}
            <small>
              {entry.count} obj · {entry.particles / 1000}k pts
            </small>
          </button>
        ))}
      </div>
    </main>
  );
}

const meta = {
  title: "WebGPU/Scene Example",
  component: SceneDemo,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: [
          "Groundwork for r3f-monitor v3. The **same scene** is mounted twice below — once on three's `WebGPURenderer`, once on the classic `WebGLRenderer`. Set both stories to the same load and compare.",
          "",
          "### The point of the comparison",
          "",
          "On plain meshes the two backends land in much the same place, so this scene adds a **particle field** where they genuinely diverge. WebGL has no compute shaders — this is not a case of *slower*, it is a case of *absent*:",
          "",
          "| | WebGL story | WebGPU story |",
          "| --- | --- | --- |",
          "| Where the simulation runs | JavaScript loop on the main thread, whole position buffer re-uploaded each frame | TSL compute shader, positions and velocities stay in GPU storage buffers |",
          "| What it costs | **CPU ms** — the metric that stalls your frame | **GPU compute ms** — main thread untouched |",
          "| Measured at 250k particles | ~7-9 ms CPU per frame | ~0.02 ms GPU compute |",
          "",
          "Same maths, same visual result. Push the load to **Heavy** and watch the CPU figure on the WebGL panel: that is the entire frame budget at 120 Hz spent before anything is drawn. The WebGPU panel barely moves, and the cost appears on a metric WebGL has no equivalent for.",
          "",
          "### Other numbers that differ",
          "",
          "`<PerfMonitor />` needs no configuration for either — it detects the renderer at runtime. But the two renderers can report different things:",
          "",
          "| | WebGLRenderer | WebGPURenderer |",
          "| --- | --- | --- |",
          "| **VRAM** | `estimated` — walks the scene and adds up buffer sizes, guessing texture memory from dimensions | `measured` — three tracks real allocated bytes, so the number is higher *and* correct |",
          "| **Draw calls** | `info.render.calls` | `info.render.drawCalls` (`render.calls` there is cumulative, not per-frame) |",
          "| **Programs** | one per material variant, enumerable | node materials compiled to WGSL pipelines; only a count |",
          "| **GPU ms** | `EXT_disjoint_timer_query_webgl2` | timestamp queries, resolved through the same API on either backend |",
          "",
          "So expect the VRAM figures to disagree: that is the two renderers measuring different things, not a bug. `usePerfData().vramSource` tells you which you are looking at.",
        ].join("\n"),
      },
      story: { inline: false, iframeHeight: 520 },
    },
  },
  argTypes: {
    mode: { table: { disable: true } },
  },
} satisfies Meta<typeof SceneDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WebGPU: Story = {
  name: "WebGPU",
  args: { mode: "webgpu" },
  parameters: {
    docs: {
      description: {
        story:
          "Rendered by `WebGPURenderer` through a Canvas with an async `gl` factory. The particle field runs as a TSL compute shader, so its cost shows up under **GPU compute** and the CPU figure stays flat. The badge reports what r3f-monitor detected — on a machine with no `navigator.gpu` it reads *WebGL 2 / WebGPURenderer*, because the renderer falls back to its own WebGL 2 backend; compute is unavailable there, so that fallback is the one case where this story degrades.",
      },
      source: {
        language: "tsx",
        code: `import { Canvas } from "@react-three/fiber";
import { WebGPURenderer } from "three/webgpu";

<Canvas
  camera={{ position: [0, 1.6, 8], fov: 48 }}
  gl={async (props) => {
    const renderer = new WebGPURenderer({
      canvas: props.canvas as HTMLCanvasElement,
      antialias: props.antialias,
    });
    await renderer.init();
    return renderer;
  }}
>
  {/* Detects WebGPURenderer at runtime — no extra config */}
  <PerfMonitor displayType="tab" />
  <PrimitiveScene count={24} />
  <ComputeParticles count={100_000} />
</Canvas>`,
      },
    },
  },
};

export const WebGL: Story = {
  name: "WebGL",
  args: { mode: "webgl" },
  parameters: {
    docs: {
      description: {
        story:
          "The identical scene on a plain `<Canvas>` — the default `WebGLRenderer`, i.e. the path r3f-monitor v2 has always measured. The particle field here is simulated by a JavaScript loop because WebGL has no compute shaders, so its cost lands on **CPU**. Set this story to Heavy, then flip to the WebGPU story on Heavy: same picture, and the CPU figure collapses from ~8 ms to near zero.",
      },
      source: {
        language: "tsx",
        code: `import { Canvas } from "@react-three/fiber";

// Same scene, default WebGLRenderer — nothing about <PerfMonitor /> changes
<Canvas camera={{ position: [0, 1.6, 8], fov: 48 }}>
  <PerfMonitor displayType="tab" />
  <PrimitiveScene count={24} />
  <ComputeParticles count={100_000} />
</Canvas>`,
      },
    },
  },
};
