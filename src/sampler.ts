declare global {
  interface Performance {
    memory: any;
  }
}

type LogsAccums = {
  mem: number[];
  gpu: number[];
  gpuCompute: number[];
  cpu: number[];
  fps: number[];
  rawFps: number[];
};

export type SampleLog = {
  cpu: number;
  gpu: number;
  gpuCompute: number;
  mem: number;
  fps: number;
  /** FPS chưa qua EMA — cho adaptive quality phản ứng nhanh. */
  rawFps: number;
  duration: number;
  maxMemory: number;
  frameCount: number;
};

export type SampleChart = {
  data: { [index: string]: number[] };
  i: number;
  circularId: number;
};

export type SamplerOptions = {
  chartLen?: number;
  chartHz?: number;
  logsPerSecond?: number;
  paramLogger?: (log: SampleLog) => void;
  chartLogger?: (chart: SampleChart) => void;
};

const average = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

/**
 * Phần đo KHÔNG dính renderer: FPS (cửa sổ trượt 1 giây + EMA), CPU wall-clock,
 * throttle theo `logsPerSecond`, và chart vòng.
 *
 * Số GPU không do lớp này lấy — backend đọc rồi truyền vào `nextFrame()`. Nhờ vậy
 * WebGL và WebGPU dùng chung y hệt bộ toán này, chỉ khác nguồn số.
 *
 * (Tách ra từ `GLPerf` trong internal.ts của v2.)
 */
export class PerfSampler {
  paused = false;

  chartLen = 120;
  chartHz = 60;
  logsPerSecond = 10;
  maxMemory = 1500;

  paramLogger: (log: SampleLog) => void = () => {};
  chartLogger: (chart: SampleChart) => void = () => {};

  currentMem = 0;

  private fpsChart: number[];
  private gpuChart: number[];
  private cpuChart: number[];
  private memChart: number[];

  private frameId = 0;
  private paramFrame = 0;
  private paramTime = 0;
  private chartFrame = 0;
  private chartTime = 0;
  private circularId = 0;

  private logsAccums: LogsAccums = {
    mem: [],
    gpu: [],
    gpuCompute: [],
    cpu: [],
    fps: [],
    rawFps: [],
  };

  // FPS: cửa sổ trượt 1 giây thật
  private frameTimes: number[] = [];
  private frameTimesHead = 0;
  private smoothFps = 0;

  // CPU: performance.now() cộng dồn
  private cpuStartTime = 0;
  private totalCpuDuration = 0;

  constructor(options: SamplerOptions = {}) {
    Object.assign(this, options);

    this.fpsChart = new Array(this.chartLen).fill(0);
    this.gpuChart = new Array(this.chartLen).fill(0);
    this.cpuChart = new Array(this.chartLen).fill(0);
    this.memChart = new Array(this.chartLen).fill(0);
  }

  private now() {
    return window.performance?.now ? window.performance.now() : Date.now();
  }

  /**
   * FPS số thực trên cửa sổ 1 giây (frameCount * 1000 / elapsed).
   * Trả số lẻ (vd 120.3) thay vì đếm nguyên -> không nhảy +/-1.
   */
  private calculateFps(): number {
    const currentTime = this.now();
    const cutoff = currentTime - 1000;

    this.frameTimes.push(currentTime);

    while (
      this.frameTimesHead < this.frameTimes.length &&
      this.frameTimes[this.frameTimesHead] <= cutoff
    ) {
      this.frameTimesHead++;
    }

    // Compact để giới hạn bộ nhớ
    if (this.frameTimesHead > 128) {
      this.frameTimes = this.frameTimes.slice(this.frameTimesHead);
      this.frameTimesHead = 0;
    }

    const count = this.frameTimes.length - this.frameTimesHead;
    if (count < 2) return count;

    const oldest = this.frameTimes[this.frameTimesHead];
    const elapsed = currentTime - oldest;
    if (elapsed <= 0) return count;

    // (count - 1) khoảng cách trong elapsed ms
    return ((count - 1) * 1000) / elapsed;
  }

  /** Bắt đầu đo wall-clock của phần render. */
  begin() {
    this.cpuStartTime = this.now();
  }

  /** Cộng dồn wall-clock vào tổng CPU của frame. */
  end() {
    this.totalCpuDuration += this.now() - this.cpuStartTime;
  }

  /**
   * Chốt một frame. `gpu`/`gpuCompute` tính bằng ms, do backend cung cấp.
   */
  nextFrame(now: number, gpu: number, gpuCompute: number) {
    this.frameId++;
    const t = now || this.now();
    const duration = t - this.paramTime;

    const rawFps = this.calculateFps();
    // EMA: làm mượt FPS hiển thị.
    this.smoothFps =
      this.smoothFps === 0
        ? rawFps
        : this.smoothFps + 0.1 * (rawFps - this.smoothFps);
    const fps = this.smoothFps;
    const cpu = this.totalCpuDuration;

    if (this.frameId <= 1) {
      this.paramFrame = this.frameId;
      this.paramTime = t;
    } else if (t >= this.paramTime) {
      this.maxMemory = window.performance.memory
        ? window.performance.memory.jsHeapSizeLimit / 1048576
        : 0;
      const frameCount = this.frameId - this.paramFrame;

      this.currentMem = Math.round(
        window.performance?.memory
          ? window.performance.memory.usedJSHeapSize / 1048576
          : 0,
      );

      this.logsAccums.mem.push(this.currentMem);
      this.logsAccums.fps.push(fps);
      this.logsAccums.rawFps.push(rawFps);
      this.logsAccums.gpu.push(gpu);
      this.logsAccums.gpuCompute.push(gpuCompute);
      this.logsAccums.cpu.push(cpu);

      if (t >= this.paramTime + 1000 / this.logsPerSecond) {
        this.paramLogger({
          cpu: average(this.logsAccums.cpu),
          gpu: average(this.logsAccums.gpu),
          gpuCompute: average(this.logsAccums.gpuCompute),
          mem: average(this.logsAccums.mem),
          fps: average(this.logsAccums.fps),
          rawFps: average(this.logsAccums.rawFps),
          duration: Math.round(duration),
          maxMemory: this.maxMemory,
          frameCount,
        });

        this.logsAccums.mem = [];
        this.logsAccums.fps = [];
        this.logsAccums.rawFps = [];
        this.logsAccums.gpu = [];
        this.logsAccums.gpuCompute = [];
        this.logsAccums.cpu = [];

        this.paramFrame = this.frameId;
        this.paramTime = t;
      }
    }

    // reset CPU tích lũy cho frame kế tiếp
    this.totalCpuDuration = 0;

    this.pushChart(t, fps, cpu, gpu);
  }

  private pushChart(t: number, fps: number, cpu: number, gpu: number) {
    if (!this.chartFrame) {
      this.chartFrame = this.frameId;
      this.chartTime = t;
      this.circularId = 0;
      return;
    }

    const timespan = t - this.chartTime;
    let hz = (this.chartHz * timespan) / 1e3;

    while (--hz > 0) {
      const slot = this.circularId % this.chartLen;
      this.fpsChart[slot] = fps;

      const memS = 1000 / this.currentMem;
      if (gpu > 0) this.gpuChart[slot] = gpu;
      if (cpu > 0) this.cpuChart[slot] = cpu;
      if (memS > 0) this.memChart[slot] = memS;

      this.chartLogger({
        i: 0,
        data: {
          fps: this.fpsChart,
          gpu: this.gpuChart,
          cpu: this.cpuChart,
          mem: this.memChart,
        },
        circularId: this.circularId,
      });

      this.circularId++;
      this.chartFrame = this.frameId;
      this.chartTime = t;
    }
  }

  dispose() {
    this.frameTimes.length = 0;
    this.frameTimesHead = 0;
    this.smoothFps = 0;
    this.totalCpuDuration = 0;
  }
}
