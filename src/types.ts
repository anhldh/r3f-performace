import type { HTMLAttributes } from "react";

export type chart = {
  length: number;
  hz: number;
};

export interface PerfProps {
  logsPerSecond?: number;
  overClock?: boolean;
  matrixUpdate?: boolean;
  chart?: chart;
  deepAnalyze?: boolean;
}

export interface PerfPropsGui extends PerfProps {
  showGraph?: boolean;
  displayType?: "tab" | "plane";
  graphType?: "line" | "bar";
  antialias?: boolean;
  openByDefault?: boolean;
  position?: string;
  minimal?: boolean;
  className?: string;
  style?: object;
  perfContainerRef?: any;
}

export interface PerfUIProps extends HTMLAttributes<HTMLDivElement> {
  perfContainerRef?: any;
  showGraph?: boolean;
  antialias?: boolean;
  chart?: chart;
  minimal?: boolean;
  matrixUpdate?: boolean;
}
