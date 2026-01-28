import { type FC, useMemo, useRef } from "react";
import { matriceCount, matriceWorldCount } from "./PerfHeadless";
import { Canvas, useFrame, type Viewport } from "@react-three/fiber";
import { getPerf, usePerf } from "../store";
import { colorsGraph } from "./PerfMonitor";
import * as THREE from "three";
import type { PerfUIProps } from "../types";
import styles from "../styles.module.css";

export interface graphData {
  curve: THREE.SplineCurve;
  maxVal: number;
  element: string;
}

const ChartCurve: FC<PerfUIProps> = ({
  minimal,
  chart = { length: 120, hz: 60 },
}) => {
  const curves: any = useMemo(() => {
    return {
      fps: new Float32Array(chart.length * 3),
      cpu: new Float32Array(chart.length * 3),
      gpu: new Float32Array(chart.length * 3),
    };
  }, [chart]);

  const fpsRef = useRef<any>(null);
  const fpsMatRef = useRef<any>(null);
  const gpuRef = useRef<any>(null);
  const cpuRef = useRef<any>(null);

  const dummyVec3 = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  // Hàm này tự động tính lại vị trí dựa trên viewport (w, h)
  // Khi Canvas giãn ra 100%, viewport.width tăng lên -> Graph tự giãn ra
  const updatePoints = (
    element: string,
    factor: number = 1,
    ref: any,
    viewport: Viewport,
  ) => {
    let maxVal = 0;
    const { width: w, height: h } = viewport;

    const chart = getPerf().chart.data[element];
    if (!chart || chart.length === 0) {
      return;
    }
    const padding = minimal ? 2 : 6;
    const paddingTop = minimal ? 12 : 50;
    const len = chart.length;
    for (let i = 0; i < len; i++) {
      const id = (getPerf().chart.circularId + i + 1) % len;
      if (chart[id] !== undefined) {
        if (chart[id] > maxVal) {
          maxVal = chart[id] * factor;
        }
        // Logic tính toán X trải dài theo w (width)
        dummyVec3.set(
          padding + (i / (len - 1)) * (w - padding * 2) - w / 2,
          ((Math.min(100, chart[id]) * factor) / 100) *
            (h - padding * 2 - paddingTop) -
            h / 2,
          0,
        );

        dummyVec3.toArray(ref.attributes.position.array, i * 3);
      }
    }

    ref.attributes.position.needsUpdate = true;
  };

  useFrame(function updateChartCurve({ viewport }) {
    updatePoints("fps", 1, fpsRef.current, viewport);
    if (fpsMatRef.current) {
      fpsMatRef.current.color.set(
        getPerf().overclockingFps ? colorsGraph.overClock : colorsGraph.fps,
      );
    }
    updatePoints("gpu", 5, gpuRef.current, viewport);
    updatePoints("cpu", 5, cpuRef.current, viewport);
  });

  return (
    <>
      <line
        // @ts-ignore
        onUpdate={(self: any) => {
          self.updateMatrix();
          matriceCount.value -= 1;
          self.matrixWorld.copy(self.matrix);
        }}
      >
        <bufferGeometry ref={fpsRef}>
          <bufferAttribute
            attach={"attributes-position"}
            count={chart.length}
            args={[curves.fps, 3]}
            array={curves.fps}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
            needsUpdate
          />
        </bufferGeometry>
        <lineBasicMaterial
          ref={fpsMatRef}
          color={colorsGraph.fps}
          transparent
          opacity={0.5}
        />
      </line>
      <line
        // @ts-ignore
        onUpdate={(self: any) => {
          self.updateMatrix();
          matriceCount.value -= 1;
          self.matrixWorld.copy(self.matrix);
        }}
      >
        <bufferGeometry ref={gpuRef}>
          <bufferAttribute
            attach={"attributes-position"}
            count={chart.length}
            array={curves.gpu}
            args={[curves.gpu, 3]}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
            needsUpdate
          />
        </bufferGeometry>
        <lineBasicMaterial color={colorsGraph.gpu} transparent opacity={0.5} />
      </line>
      <line
        // @ts-ignore
        onUpdate={(self: any) => {
          self.updateMatrix();
          matriceCount.value -= 1;
          self.matrixWorld.copy(self.matrix);
        }}
      >
        <bufferGeometry ref={cpuRef}>
          <bufferAttribute
            attach={"attributes-position"}
            count={chart.length}
            array={curves.cpu}
            args={[curves.cpu, 3]}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
            needsUpdate
          />
        </bufferGeometry>
        <lineBasicMaterial color={colorsGraph.cpu} transparent opacity={0.5} />
      </line>
    </>
  );
};

export const ChartUI: FC<PerfUIProps> = ({
  chart,
  showGraph = true,
  antialias = true,
  minimal,
}) => {
  const canvas = useRef<any>(undefined);
  const paused = usePerf((state) => state.paused);

  return (
    <div
      className={styles.graph}
      style={{
        display: "flex",
        marginTop: 6,
        position: "absolute",
        width: "100%",
        height: `${minimal ? 37 : showGraph ? 100 : 60}px`,
      }}
    >
      <Canvas
        ref={canvas}
        orthographic
        camera={{ rotation: [0, 0, 0] }}
        dpr={antialias ? [1, 2] : 1}
        gl={{
          antialias: true,
          alpha: true,
          stencil: false,
          depth: false,
        }}
        onCreated={({ scene }) => {
          scene.traverse((obj: THREE.Object3D) => {
            obj.matrixWorldAutoUpdate = false;
            obj.matrixAutoUpdate = false;
          });
        }}
        flat={true}
        style={{
          marginBottom: `-42px`,
          position: "relative",
          pointerEvents: "none",
          background: "transparent !important",
          width: "100%",
          height: `${minimal ? 37 : showGraph ? 100 : 60}px`,
        }}
      >
        {!paused ? (
          <>
            <Renderer />
            {showGraph && <ChartCurve minimal={minimal} chart={chart} />}
          </>
        ) : null}
      </Canvas>
    </div>
  );
};

const Renderer = () => {
  useFrame(function updateR3FPerf({ gl, scene, camera }) {
    camera.updateMatrix();
    matriceCount.value -= 1;
    camera.matrixWorld.copy(camera.matrix);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    gl.render(scene, camera);
    matriceWorldCount.value = 0;
    matriceCount.value = 0;
  }, Infinity);

  return null;
};
