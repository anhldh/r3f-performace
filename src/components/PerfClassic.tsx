import { type FC, useRef, useState } from "react";

import { useEvent } from "../events/react";
import { useHasCompute } from "../hooks/useHasCompute";
import { setPerf, usePerf } from "../store";
import type { PerfPropsGui } from "../types";
import s from "../style/classic.module.css";

import { ProgramsUI } from "./Program";
import { PerfHeadless } from "./PerfHeadless";
import { HtmlMinimal } from "./HtmlMinimal";
import { ChartUI } from "./Graph";
import { ChartStats } from "./GraphStats";
import { colorsGraph } from "./Utils";

// --- TYPES ---
type LogData = {
  gpu: number;
  /** ms của compute pass. WebGPU only — WebGL luôn 0. */
  gpuCompute: number;
  cpu: number;
  mem: number;
  fps: number;
  [key: string]: number;
};

type GLData = {
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
  programs: number;
  matrices: number;
  /** Số compute dispatch trong frame. WebGL luôn 0. */
  computeCalls: number;
  [key: string]: number;
};

type EventPayload = [LogData, GLData];

// --- METRIC COMPONENTS ---

const LogValue = ({
  metric,
  decimal = 0,
  suffix = "",
}: {
  metric: keyof LogData;
  decimal?: number;
  suffix?: string;
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEvent("log", (payload: any) => {
    const [log] = payload as EventPayload;
    if (log && ref.current) {
      const val = log[metric];
      ref.current.innerText =
        (typeof val === "number" ? val.toFixed(decimal) : "0") + suffix;
    }
  });
  return <span ref={ref}>0{suffix}</span>;
};

const GLValue = ({
  metric,
  suffix = "",
}: {
  metric: keyof GLData;
  suffix?: string;
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEvent("log", (payload: any) => {
    const [, gl] = payload as EventPayload;
    if (gl && ref.current) {
      let val: string | number = gl[metric];
      if (metric === "calls" && val === 0) val = "--";
      ref.current.innerText = val + suffix;
    }
  });
  return <span ref={ref}>0{suffix}</span>;
};

const MemoryValue = ({ type }: { type: "ram" | "vram" }) => {
  const value = usePerf((s) => s.estimatedMemory[type]);
  return <span>{value.toFixed(0)} MB</span>;
};

// --- METRIC ITEM ---
const MetricItem = ({
  label,
  color,
  children,
}: {
  label: string;
  color?: string;
  children: React.ReactNode;
}) => (
  <div className={s.perfI}>
    <span className={s.perfB} style={color ? { color } : undefined}>
      {label}
    </span>
    <small className={s.perfSmallI}>{children}</small>
  </div>
);

// --- MAIN EXPORT ---

export const PerfClassic: FC<PerfPropsGui> = (props) => {
  const {
    showGraph,
    openByDefault,
    className,
    graphType,
    style,
    position,
    chart,
    logsPerSecond,
    deepAnalyze,
    antialias,
    matrixUpdate,
    minimal,
  } = props;

  const perfContainerRef = useRef<HTMLDivElement>(null);
  const [showMore, setShowMore] = useState(openByDefault ?? false);
  const tab = usePerf((s) => s.tab);
  const gl = usePerf((s) => s.gl);

  // Chỉ hiện khi scene thực sự có compute dispatch — xem useHasCompute.
  const hasCompute = useHasCompute();

  // FPS overclock
  const fpsRef = useRef<HTMLSpanElement>(null);

  useEvent("log", (payload: any) => {
    const [log] = payload as EventPayload;
    if (log && fpsRef.current) {
      fpsRef.current.innerText = Math.round(log.fps).toString();
    }
  });

  const positionClass =
    position === "top-left"
      ? s.topLeft
      : position === "bottom-left"
        ? s.bottomLeft
        : position === "bottom-right"
          ? s.bottomRight
          : s.topRight;

  const heightStyle = showGraph && graphType === "line" && !deepAnalyze;

  return (
    <>
      <PerfHeadless
        logsPerSecond={logsPerSecond}
        chart={chart}
        deepAnalyze={deepAnalyze}
        matrixUpdate={matrixUpdate}
      />
      <HtmlMinimal name="r3f-perf">
        <div
          className={`${s.perfS} ${positionClass} ${minimal ? s.minimal : ""} ${className || ""} ${heightStyle ? s.containerHeight : ""}`}
          style={style}
          ref={perfContainerRef}
        >
          {/* ====== BLOCK 1: Main Metrics ====== */}
          {gl && (
            <div className={s.perfIContainer}>
              <MetricItem label={`FPS`} color={colorsGraph.fps}>
                <span ref={fpsRef}>0</span>
              </MetricItem>

              <MetricItem label="CPU" color={colorsGraph.cpu}>
                <LogValue metric="cpu" decimal={2} suffix=" ms" />
              </MetricItem>

              <MetricItem label="GPU" color={colorsGraph.gpu}>
                <LogValue metric="gpu" decimal={2} suffix=" ms" />
              </MetricItem>

              {hasCompute && (
                <MetricItem label="COMPUTE" color={colorsGraph.compute}>
                  <LogValue metric="gpuCompute" decimal={2} suffix=" ms" />
                </MetricItem>
              )}

              <MetricItem label="MEMORY" color={colorsGraph.memory}>
                <MemoryValue type="ram" />
              </MetricItem>

              <MetricItem label="VRAM" color={colorsGraph.vram}>
                <MemoryValue type="vram" />
              </MetricItem>

              {!minimal && (
                <MetricItem label="Calls">
                  <GLValue metric="calls" />
                </MetricItem>
              )}
            </div>
          )}

          {/* ====== BLOCK 2: Info Metrics (expandable) ====== */}
          {!minimal && (
            <>
              <div
                style={{
                  display: showMore ? "block" : "none",
                }}
              >
                <div className={s.perfIContainer}>
                  <MetricItem label="Geometries">
                    <GLValue metric="geometries" />
                  </MetricItem>
                  <MetricItem label="Textures">
                    <GLValue metric="textures" />
                  </MetricItem>
                  <MetricItem label="Shaders">
                    <GLValue metric="programs" />
                  </MetricItem>
                  {hasCompute && (
                    <MetricItem label="Dispatch">
                      <GLValue metric="computeCalls" />
                    </MetricItem>
                  )}
                  <MetricItem label="Triangles">
                    <GLValue metric="triangles" />
                  </MetricItem>
                  <MetricItem label="Lines">
                    <GLValue metric="lines" />
                  </MetricItem>
                  <MetricItem label="Points">
                    <GLValue metric="points" />
                  </MetricItem>
                  {matrixUpdate && (
                    <MetricItem label="Matrices">
                      <GLValue metric="matrices" />
                    </MetricItem>
                  )}
                </div>

                {/* ====== BLOCK 3: Graph ====== */}
                {showGraph &&
                  (graphType === "bar" ? (
                    <ChartStats />
                  ) : (
                    <ChartUI
                      perfContainerRef={perfContainerRef}
                      chart={chart}
                      showGraph={showGraph}
                      antialias={antialias}
                      minimal={minimal}
                      matrixUpdate={matrixUpdate}
                    />
                  ))}

                {/* ====== BLOCK 4: Programs ====== */}
                {showMore && tab === "programs" && (
                  <div
                    className={s.containerScroll}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <ProgramsUI />
                  </div>
                )}
              </div>

              {/* ====== BLOCK 5: Toggle Buttons ====== */}
              {openByDefault && !deepAnalyze ? null : (
                <div
                  className={s.toggleContainer}
                  style={{
                    marginTop: 6,
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {deepAnalyze && (
                    <div
                      className={`${s.toggle} ${tab === "programs" ? s.activeTab : ""}`}
                      onClick={() => {
                        setShowMore(true);
                        setPerf({ tab: "programs" });
                      }}
                    >
                      Programs
                    </div>
                  )}
                  {deepAnalyze && (
                    <div
                      className={`${s.toggle} ${tab === "infos" ? s.activeTab : ""}`}
                      onClick={() => {
                        setShowMore(true);
                        setPerf({ tab: "infos" });
                      }}
                    >
                      Infos
                    </div>
                  )}
                  <div
                    className={s.toggle}
                    onClick={() => setShowMore(!showMore)}
                  >
                    {showMore ? "Minimize" : "More"}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </HtmlMinimal>
    </>
  );
};
