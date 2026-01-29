import { type FC, useRef, useState } from "react";
import { HtmlMinimal } from "./HtmlMinimal";
import { PerfHeadless } from "./PerfHeadless";
import { useEvent } from "../events/react";
import { ProgramsUI } from "./Program";
import { setPerf, usePerf } from "../store";
import type { PerfPropsGui } from "../types";
import s from "../styles.module.css"; // Import CSS Module
import { ChartUI } from "./Graph";
import { ChartStats } from "./GraphStats";

// --- TYPES & HELPERS ---
type LogData = {
  gpu: number;
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
  [key: string]: number;
};

type EventPayload = [LogData, GLData];

export const colorsGraph = {
  overClock: "#ff6eff",
  fps: "#00FFFF", // 0,255,255
  cpu: "#00FF00", // 0,255,0
  gpu: "#FD007F", // 253,0,127
  memory: "#FFD000", // 255,208,0
  vram: "#FF8C00", // 255,140,0
};

// --- SUB-COMPONENTS ---

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
    const [, glRender] = payload as EventPayload;
    if (glRender && ref.current) {
      let val: string | number = glRender[metric];
      if (metric === "calls" && val === 1) val = "--";
      ref.current.innerText = val + suffix;
    }
  });
  return <span ref={ref}>0{suffix}</span>;
};

// --- NEW: MEMORY COMPONENT (RAM & VRAM) ---
const MemoryValue = ({ type }: { type: "ram" | "vram" }) => {
  // Lắng nghe trực tiếp từ store thay vì event log
  // vì memory update chậm hơn (1s/lần) nên re-render component này không vấn đề gì
  const value = usePerf((s) => s.estimatedMemory[type]);
  return <span>{value.toFixed(0)} MB</span>;
};

// --- FPS COMPONENT ---
const DynamicUIPerf: FC<PerfPropsGui> = () => {
  const overclockingFps = usePerf((s) => s.overclockingFps);
  const fpsLimit = usePerf((s) => s.fpsLimit);
  const fpsRef = useRef<HTMLSpanElement>(null);

  useEvent("log", (payload: any) => {
    const [log] = payload as EventPayload;
    if (log && fpsRef.current) {
      fpsRef.current.innerText = Math.round(log.fps).toString();
    }
  });

  const color = overclockingFps ? colorsGraph.overClock : colorsGraph.fps;

  return (
    <div className={s.perfI}>
      <span className={s.perfB} style={{ color }}>
        FPS {overclockingFps ? ` ${fpsLimit}🚀` : ""}
      </span>
      <small className={s.perfSmallI} ref={fpsRef}>
        0
      </small>
    </div>
  );
};

// --- MAIN UI COMPONENTS ---

const DynamicUI: FC<PerfPropsGui> = ({ showGraph, minimal }) => {
  const gl = usePerf((state) => state.gl);
  if (!gl) return null;

  return (
    <div className={s.perfIContainer}>
      {/* FPS */}
      <DynamicUIPerf showGraph={showGraph} />
      {/* CPU */}
      <div className={s.perfI}>
        <span className={s.perfB} style={{ color: colorsGraph.cpu }}>
          CPU
        </span>
        <small className={s.perfSmallI}>
          <LogValue metric="cpu" decimal={2} suffix=" ms" />
        </small>
      </div>
      {/* GPU */}
      <div className={s.perfI}>
        <span className={s.perfB} style={{ color: colorsGraph.gpu }}>
          GPU
        </span>
        <small className={s.perfSmallI}>
          <LogValue metric="gpu" decimal={2} suffix=" ms" />
        </small>
      </div>

      {/* --- ADDED: RAM (JS Heap) --- */}
      <div className={s.perfI}>
        <span className={s.perfB} style={{ color: colorsGraph.memory }}>
          MEMORY
        </span>
        <small className={s.perfSmallI}>
          <MemoryValue type="ram" />
        </small>
      </div>

      {/* --- ADDED: VRAM (Estimated) --- */}
      <div className={s.perfI}>
        <span className={s.perfB} style={{ color: colorsGraph.vram }}>
          VRAM
        </span>
        <small className={s.perfSmallI}>
          <MemoryValue type="vram" />
        </small>
      </div>

      {/* CALLS */}
      {!minimal && (
        <div className={s.perfI}>
          <span className={s.perfB}>Calls</span>
          <small className={s.perfSmallI}>
            <GLValue metric="calls" />
          </small>
        </div>
      )}
    </div>
  );
};

const InfoUI: FC<PerfPropsGui> = ({ matrixUpdate }) => {
  return (
    <div className={s.perfIContainer}>
      {/** Geometries */}
      <div className={s.perfI}>
        <span className={s.perfB}>Geometries</span>
        <small className={s.perfSmallI}>
          <GLValue metric="geometries" />
        </small>
      </div>
      {/** Textures */}
      <div className={s.perfI}>
        <span className={s.perfB}>Textures</span>
        <small className={s.perfSmallI}>
          <GLValue metric="textures" />
        </small>
      </div>
      {/** Shaders */}
      <div className={s.perfI}>
        <span className={s.perfB}>Shaders</span>
        <small className={s.perfSmallI}>
          <GLValue metric="programs" />
        </small>
      </div>
      {/** Triangles */}
      <div className={s.perfI}>
        <span className={s.perfB}>Triangles</span>
        <small className={s.perfSmallI}>
          <GLValue metric="triangles" />
        </small>
      </div>
      {/** Lines */}
      <div className={s.perfI}>
        <span className={s.perfB}>Lines</span>
        <small className={s.perfSmallI}>
          <GLValue metric="lines" />
        </small>
      </div>
      {/** Points */}
      <div className={s.perfI}>
        <span className={s.perfB}>Points</span>
        <small className={s.perfSmallI}>
          <GLValue metric="points" />
        </small>
      </div>
      {/** Matrices */}
      {matrixUpdate && (
        <div className={s.perfI}>
          <span className={s.perfB}>Matrices</span>
          <small className={s.perfSmallI}>{matrixUpdate}</small>
          {/* Logic Matrices */}
        </div>
      )}
    </div>
  );
};

// --- TOGGLES ---

const ToggleEl: FC<{
  tab: "infos" | "programs" | "data";
  title: string;
  set: (val: boolean) => void;
}> = ({ tab, title, set }) => {
  const tabStore = usePerf((s) => s.tab);
  return (
    <div
      className={`${s.toggle} ${tabStore === tab ? s.activeTab : ""}`}
      onClick={() => {
        set(true);
        setPerf({ tab });
      }}
    >
      {title}
    </div>
  );
};

const PerfThree: FC<PerfPropsGui> = ({
  openByDefault,
  showGraph,
  deepAnalyze,
  matrixUpdate,
  graphType,
  perfContainerRef,
  antialias,
  chart,
  minimal,
}) => {
  const [show, set] = useState(openByDefault || false);
  const tab = usePerf((s) => s.tab);

  return (
    <>
      <div style={{ display: show ? "block" : "none", marginTop: "4px" }}>
        <InfoUI matrixUpdate={matrixUpdate} />
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
        {show && (
          <div className={s.containerScroll}>
            {tab === "programs" && <ProgramsUI />}
          </div>
        )}
      </div>

      {openByDefault && !deepAnalyze ? null : (
        <div
          className={s.toggleContainer}
          style={
            show && showGraph && graphType === "line"
              ? { marginTop: 50 }
              : { marginTop: 6 }
          }
        >
          {deepAnalyze && (
            <ToggleEl tab="programs" title="Programs" set={set} />
          )}
          {deepAnalyze && <ToggleEl tab="infos" title="Infos" set={set} />}
          <div className={s.toggle} onClick={() => set(!show)}>
            {show ? "Minimize" : "More"}
          </div>
        </div>
      )}
    </>
  );
};

// --- MAIN EXPORT ---

export const PerfMonitor: FC<PerfPropsGui> = ({
  showGraph = true,
  openByDefault = true,
  className,
  overClock = false,
  graphType = "bar",
  style,
  position = "top-right",
  chart,
  logsPerSecond,
  deepAnalyze = false,
  antialias = true,
  matrixUpdate,
  minimal,
}) => {
  const perfContainerRef = useRef<HTMLDivElement>(null);
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
        overClock={overClock}
        deepAnalyze={deepAnalyze}
        matrixUpdate={matrixUpdate}
      />
      <HtmlMinimal name="r3f-perf">
        <div
          className={`${s.perfS} ${positionClass} ${minimal ? s.minimal : ""} ${className || ""} ${heightStyle ? s.containerHeight : ""}`}
          style={style}
          ref={perfContainerRef}
        >
          <DynamicUI showGraph={showGraph} minimal={minimal} />

          {!minimal && (
            <PerfThree
              showGraph={showGraph}
              deepAnalyze={deepAnalyze}
              matrixUpdate={matrixUpdate}
              openByDefault={openByDefault}
              graphType={graphType}
              perfContainerRef={perfContainerRef}
              antialias={antialias}
              chart={chart}
              minimal={minimal}
            />
          )}
        </div>
      </HtmlMinimal>
    </>
  );
};
