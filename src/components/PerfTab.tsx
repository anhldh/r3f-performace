import { type FC, useRef, useState } from "react";

import { useEvent } from "../events/react";
import { useHasCompute } from "../hooks/useHasCompute";
import { usePerf } from "../store";
import type { PerfPropsGui } from "../types";
import s from "../style/tab.module.css";

import { ProgramsUI } from "./Program";
import { PerfHeadless } from "./PerfHeadless";
import { HtmlMinimal } from "./HtmlMinimal";
import { ChartUI } from "./Graph";
import { ChartStats } from "./GraphStats";
import { colorsGraph, IconCode, IconGear, SettingCheckbox } from "./Utils";

// --- HELPER COMPONENT ---
const MetricValue = ({
  type,
  field,
  decimal = 0,
  suffix = "",
}: {
  type: "log" | "gl" | "store";
  field: string;
  decimal?: number;
  suffix?: string;
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const storeVal = usePerf((s) =>
    type === "store" ? (s.estimatedMemory as any)[field] : null,
  );

  useEvent("log", (payload: any) => {
    if (type === "store") return;
    const [log, gl] = payload;
    if (ref.current) {
      let val = 0;
      if (type === "log" && log) val = log[field];
      if (type === "gl" && gl) val = gl[field];
      ref.current.innerText = val.toFixed(decimal) + suffix;
    }
  });

  if (type === "store") {
    return (
      <span>
        {storeVal?.toFixed(decimal)}
        {suffix}
      </span>
    );
  }
  return <span ref={ref}>-</span>;
};
type Position = "top-right" | "top-left" | "bottom-right" | "bottom-left";

// --- MAIN COMPONENT ---
export const PerfTab: FC<PerfPropsGui> = (props) => {
  const {
    showGraph,
    className,
    style,
    minimal,
    chart,
    deepAnalyze,
    matrixUpdate,
    graphType,
    position,
  } = props;

  // Chỉ hiện khi scene thực sự có compute dispatch — xem useHasCompute.
  const hasCompute = useHasCompute();

  const [tab, setTab] = useState<"perf" | "res">("perf");
  const [showSettings, setShowSettings] = useState(false);
  const [showPrograms, setShowPrograms] = useState(false);
  // Local state
  const [localDeepAnalyze, setLocalDeepAnalyze] = useState(
    deepAnalyze ?? false,
  );
  const [localMatrixUpdate, setLocalMatrixUpdate] = useState(
    matrixUpdate ?? false,
  );
  const [localShowGraph, setLocalShowGraph] = useState(showGraph ?? true);
  const [localGraphType, setLocalGraphType] = useState<"bar" | "line">(
    graphType as "bar" | "line",
  );

  const perfContainerRef = useRef<HTMLDivElement>(null);

  const posMap = {
    "top-right": "topRight",
    "top-left": "topLeft",
    "bottom-right": "bottomRight",
    "bottom-left": "bottomLeft",
  } as const;

  const posClass = s[posMap[position as Position]] ?? s.topRight;
  const isTop = position === "top-right" || position === "top-left";

  return (
    <>
      <PerfHeadless
        {...props}
        deepAnalyze={localDeepAnalyze}
        matrixUpdate={localMatrixUpdate}
      />
      <HtmlMinimal name="r3f-perf">
        <div className={`${s.perfWrapper} ${posClass}`}>
          {!isTop && localDeepAnalyze && showPrograms && (
            <div className={s.programsPanel}>
              <div className={s.programsPanelHeader}>
                <span>Programs</span>
                <div
                  className={s.programsClose}
                  onClick={() => setShowPrograms(false)}
                >
                  ✕
                </div>
              </div>
              <ProgramsUI />
            </div>
          )}
          <div
            className={`${s.perfS} ${className || ""}`}
            style={style}
            ref={perfContainerRef}
          >
            {/* HEADER */}
            {!minimal && (
              <div
                className={s.header}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div
                  className={`${s.tab} ${tab === "perf" && !showSettings ? s.tabActive : ""}`}
                  onClick={() => {
                    setTab("perf");
                    setShowSettings(false);
                  }}
                >
                  PERF
                </div>
                <div
                  className={`${s.tab} ${tab === "res" && !showSettings ? s.tabActive : ""}`}
                  onClick={() => {
                    setTab("res");
                    setShowSettings(false);
                  }}
                >
                  RES
                </div>
                {localDeepAnalyze && (
                  <div
                    className={`${s.iconSetting} ${showPrograms ? s.iconSettingActive : ""}`}
                    onClick={() => setShowPrograms(!showPrograms)}
                    title="Programs"
                  >
                    <IconCode />
                  </div>
                )}
                <div
                  className={`${s.iconSetting} ${showSettings ? s.iconSettingActive : ""}`}
                  onClick={() => setShowSettings(!showSettings)}
                >
                  <IconGear />
                </div>
              </div>
            )}

            <div className={s.content}>
              {/* === SETTINGS PANEL === */}
              {!minimal && (
                <div
                  className={`${s.tabPanel} ${showSettings ? s.isActive : s.isHidden}`}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className={s.settingsPanel}>
                    <div className={s.settingsTitle}>Settings</div>
                    <SettingCheckbox
                      label="Deep Analyze"
                      checked={localDeepAnalyze}
                      onChange={setLocalDeepAnalyze}
                    />
                    <SettingCheckbox
                      label="Matrix Update"
                      checked={localMatrixUpdate}
                      onChange={setLocalMatrixUpdate}
                    />
                    <SettingCheckbox
                      label="Show Graph"
                      checked={localShowGraph}
                      onChange={setLocalShowGraph}
                    />

                    <div className={s.settingRow}>
                      <span className={s.settingLabel}>Graph Type</span>
                      <div className={s.graphTypeToggle}>
                        <button
                          className={`${s.toggleBtn} ${localGraphType === "bar" ? s.toggleBtnActive : ""}`}
                          onClick={() => setLocalGraphType("bar")}
                        >
                          Bar
                        </button>
                        <button
                          className={`${s.toggleBtn} ${localGraphType === "line" ? s.toggleBtnActive : ""}`}
                          onClick={() => setLocalGraphType("line")}
                        >
                          Line
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === TAB PERF === */}
              {!showSettings && (
                <div
                  className={`${s.tabPanel} ${tab === "perf" && !showSettings ? s.isActive : s.isHidden}`}
                >
                  <div className={`${s.gridRow} ${s.cols3}`}>
                    <div className={s.cell}>
                      <span
                        className={s.label}
                        style={{ color: colorsGraph.fps }}
                      >
                        FPS
                      </span>
                      <span className={s.val}>
                        <MetricValue type="log" field="fps" />
                      </span>
                    </div>
                    <div className={s.cell}>
                      <span
                        className={s.label}
                        style={{ color: colorsGraph.cpu }}
                      >
                        CPU
                      </span>
                      <span className={s.val}>
                        <MetricValue type="log" field="cpu" decimal={2} />
                      </span>
                      <span className={s.unit}>ms</span>
                    </div>
                    <div className={s.cell}>
                      <span
                        className={s.label}
                        style={{ color: colorsGraph.gpu }}
                      >
                        GPU
                      </span>
                      <span className={s.val}>
                        <MetricValue type="log" field="gpu" decimal={2} />
                      </span>
                      <span className={s.unit}>ms</span>
                    </div>
                  </div>

                  {hasCompute && (
                    <div className={`${s.gridRow} ${s.cols2}`}>
                      <div className={s.cell}>
                        <span
                          className={s.label}
                          style={{ color: colorsGraph.compute }}
                        >
                          COMPUTE
                        </span>
                        <span className={s.val}>
                          <MetricValue
                            type="log"
                            field="gpuCompute"
                            decimal={2}
                          />
                        </span>
                        <span className={s.unit}>ms</span>
                      </div>
                      <div className={s.cell}>
                        <span className={s.label}>DISPATCH</span>
                        <span className={s.val}>
                          <MetricValue type="gl" field="computeCalls" />
                        </span>
                      </div>
                    </div>
                  )}

                  <div className={`${s.gridRow} ${s.cols2}`}>
                    <div className={s.cell}>
                      <span
                        className={s.label}
                        style={{ color: colorsGraph.memory }}
                      >
                        MEMORY
                      </span>
                      <span className={s.val}>
                        <MetricValue
                          type="store"
                          field="ram"
                          decimal={1}
                          suffix=" MB"
                        />
                      </span>
                    </div>
                    <div className={s.cell}>
                      <span
                        className={s.label}
                        style={{ color: colorsGraph.vram }}
                      >
                        VRAM
                      </span>
                      <span className={s.val}>
                        <MetricValue
                          type="store"
                          field="vram"
                          decimal={1}
                          suffix=" MB"
                        />
                      </span>
                    </div>
                  </div>

                  <div className={`${s.gridRow} ${s.cols2}`}>
                    <div className={s.cell}>
                      <span className={s.label}>DRAWS</span>
                      <span className={s.val}>
                        <MetricValue type="gl" field="calls" />
                      </span>
                    </div>
                    <div className={s.cell}>
                      <span className={s.label}>TRIANGLES</span>
                      <span className={s.val}>
                        <MetricValue type="gl" field="triangles" />
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* === TAB RES === */}
              {!showSettings && !minimal && (
                <div
                  className={`${s.tabPanel} ${tab === "res" && !showSettings ? s.isActive : s.isHidden}`}
                >
                  <div className={`${s.gridRow} ${s.cols2}`}>
                    <div className={s.cell}>
                      <span className={s.label}>GEOMETRIES</span>
                      <span className={s.val}>
                        <MetricValue type="gl" field="geometries" />
                      </span>
                    </div>
                    <div className={s.cell}>
                      <span className={s.label}>TEXTURES</span>
                      <span className={s.val}>
                        <MetricValue type="gl" field="textures" />
                      </span>
                    </div>
                  </div>
                  <div className={`${s.gridRow} ${s.cols2}`}>
                    <div className={s.cell}>
                      <span className={s.label}>SHADERS</span>
                      <span className={s.val}>
                        <MetricValue type="gl" field="programs" />
                      </span>
                    </div>
                    <div className={s.cell}>
                      <span className={s.label}>LINES</span>
                      <span className={s.val}>
                        <MetricValue type="gl" field="lines" />
                      </span>
                    </div>
                  </div>
                  <div className={`${s.gridRow} ${s.cols2}`}>
                    <div className={s.cell}>
                      <span className={s.label}>POINTS</span>
                      <span className={s.val}>
                        <MetricValue type="gl" field="points" />
                      </span>
                    </div>
                    {localMatrixUpdate && (
                      <div className={s.cell}>
                        <span className={s.label}>MATRIX</span>
                        <span className={s.val}>
                          <MetricValue type="gl" field="matrices" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* GRAPH AREA */}
            {localShowGraph && !minimal && !showSettings && (
              <div
                className={s.graphSection}
                style={{
                  borderTop: "1px solid #222",
                  marginTop: 0,
                  cursor: localGraphType === "bar" ? "pointer" : "default",
                }}
              >
                {localGraphType === "bar" ? (
                  <ChartStats
                    panels={[
                      { key: "fps", label: "FPS", maxVal: 120 },
                      { key: "cpu", label: "CPU", maxVal: 40 },
                      { key: "gpu", label: "GPU", maxVal: 40 },
                    ]}
                    hasChange={true}
                    showHeaderText={true}
                    gap={0}
                  />
                ) : (
                  <ChartUI
                    perfContainerRef={perfContainerRef}
                    chart={chart}
                    showGraph={localShowGraph}
                    antialias={true}
                    minimal={minimal}
                    matrixUpdate={localMatrixUpdate}
                  />
                )}
              </div>
            )}
          </div>
          {/* Program deepAnalyze*/}
          {isTop && localDeepAnalyze && showPrograms && (
            <div
              className={s.programsPanel}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className={s.programsPanelHeader}>
                <span>Programs</span>
                <div
                  className={s.programsClose}
                  onClick={() => setShowPrograms(false)}
                >
                  ✕
                </div>
              </div>
              <ProgramsUI />
            </div>
          )}
        </div>
      </HtmlMinimal>
    </>
  );
};
