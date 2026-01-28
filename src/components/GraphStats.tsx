import React, { useEffect, useMemo, useRef, useState } from "react";
import { getPerf, usePerf } from "../store";

type Theme = { fg: string; bg: string };
const THEMES: Record<string, Theme> = {
  fps: { fg: "#00ffff", bg: "#000022" }, // Chỉnh màu nền đậm hơn chút
  cpu: { fg: "#00ff00", bg: "#002200" },
  gpu: { fg: "#ff0080", bg: "#220011" },
};

type PanelCfg = {
  key: "fps" | "cpu" | "gpu";
  label: string;
  maxVal: number;
};

const PANELS: PanelCfg[] = [
  { key: "fps", label: "FPS", maxVal: 120 },
  { key: "cpu", label: "CPU", maxVal: 40 },
  { key: "gpu", label: "GPU", maxVal: 40 },
];

const PANEL_H = 48;
const TEXT_H = 15;
const GRAPH_X = 2; // Giảm padding chút
const GRAPH_Y = TEXT_H;
const GRAPH_H = PANEL_H - GRAPH_Y - 2;
// GAP giữa các ô
const GAP = 6;

const UPDATE_FPS = 15;
const INTERVAL = 1000 / UPDATE_FPS;

export function ChartStats({
  show = true,
  opacity = 1, // Tăng opacity lên 1 để bớt trong suốt
  className,
  style,
}: {
  show?: boolean;
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const paused = usePerf((s) => s.paused);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(300);

  const dpr = useMemo(
    () => Math.max(1, Math.round(window.devicePixelRatio || 1)),
    [],
  );

  useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  // --- TÍNH TOÁN KÍCH THƯỚC CÓ GAP ---
  // Tổng width = (3 * panelW) + (2 * GAP)
  // => panelW = (Total - 2*GAP) / 3
  const totalGap = (PANELS.length - 1) * GAP;
  const panelW = Math.max(0, (containerWidth - totalGap) / PANELS.length);
  const dynamicGraphW = Math.max(0, panelW - GRAPH_X);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    c.width = containerWidth * dpr;
    c.height = PANEL_H * dpr;
    c.style.width = "100%";
    c.style.height = `${PANEL_H}px`;

    const ctx = c.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.font = "bold 9px Roboto Mono, monospace";
    ctx.textBaseline = "top";

    // Xóa toàn bộ canvas (làm trong suốt các khoảng gap)
    ctx.clearRect(0, 0, containerWidth, PANEL_H);

    // Vẽ nền tĩnh cho từng ô
    for (let p = 0; p < PANELS.length; p++) {
      const { key } = PANELS[p];
      // Offset X bao gồm cả Gap
      const ox = p * (panelW + GAP);
      const { bg } = THEMES[key];

      ctx.fillStyle = bg;
      ctx.globalAlpha = opacity;
      // Chỉ vẽ nền trong khu vực panelW, chừa lại Gap
      ctx.fillRect(ox, 0, panelW, PANEL_H);
      ctx.globalAlpha = 1;
    }
  }, [dpr, containerWidth, panelW, opacity]);

  useEffect(() => {
    if (!show) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastTime = 0;

    const minMax = {
      fps: { min: Infinity, max: 0 },
      cpu: { min: Infinity, max: 0 },
      gpu: { min: Infinity, max: 0 },
    };

    function drawFrame(timestamp: number) {
      if (!c || !ctx) return;
      raf = requestAnimationFrame(drawFrame);
      if (paused) return;

      const delta = timestamp - lastTime;
      if (delta < INTERVAL) return;
      lastTime = timestamp - (delta % INTERVAL);

      const perf = getPerf();
      const circ = perf.chart.circularId;

      for (let p = 0; p < PANELS.length; p++) {
        const { key, label, maxVal } = PANELS[p];
        const ox = p * (panelW + GAP); // Tính lại ox có GAP
        const { fg, bg } = THEMES[key];

        const series = perf.chart.data[key];
        const len = series?.length || 0;
        let v = 0;
        if (len > 0) {
          const idx = (circ - 1 + len) % len;
          v = series[idx] ?? 0;
        }

        const mm = minMax[key];
        mm.min = Math.min(mm.min, v);
        mm.max = Math.max(mm.max, v);

        // A. TEXT HEADER
        ctx.fillStyle = bg;
        ctx.globalAlpha = 1;
        ctx.fillRect(ox, 0, panelW, TEXT_H); // Xóa header cũ

        ctx.fillStyle = fg;
        const txt = `${label} (${Math.round(mm.min)}-${Math.round(mm.max)})`;
        ctx.fillText(txt, ox + 3, 2);

        // B. GRAPH SHIFT
        if (dynamicGraphW > 1) {
          // Chỉ copy trong phạm vi panel, không lấn sang gap
          ctx.drawImage(
            c,
            (ox + GRAPH_X + 1) * dpr,
            GRAPH_Y * dpr,
            (dynamicGraphW - 1) * dpr,
            GRAPH_H * dpr,
            ox + GRAPH_X,
            GRAPH_Y,
            dynamicGraphW - 1,
            GRAPH_H,
          );
        }

        // C. DRAW NEW COLUMN
        const rightEdgeX = ox + GRAPH_X + dynamicGraphW - 1;

        // Xóa cột cũ
        ctx.fillStyle = bg;
        ctx.globalAlpha = 1; // Để nền đặc, không bị chồng màu
        ctx.fillRect(rightEdgeX, GRAPH_Y, 1, GRAPH_H);

        // Vẽ cột mới
        ctx.fillStyle = fg;
        ctx.globalAlpha = 1;
        const ratio = Math.min(v, maxVal) / maxVal;
        const barH = Math.round(ratio * GRAPH_H);
        if (barH > 0) {
          ctx.fillRect(rightEdgeX, GRAPH_Y + GRAPH_H - barH, 1, barH);
        }
      }
    }
    raf = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(raf);
  }, [paused, show, dpr, panelW, dynamicGraphW]);

  if (!show) return null;

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{ width: "100%", ...style, marginTop: GAP }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          pointerEvents: "none",
          width: "100%",
          height: `${PANEL_H}px`,
        }}
      />
    </div>
  );
}
