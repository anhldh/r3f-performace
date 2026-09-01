import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Points,
  PointsMaterial,
} from "three";

type CpuParticlesProps = {
  count: number;
  /** World-space size of one particle, matched to ComputeParticles. */
  size?: number;
};

type Simulation = {
  positions: Float32Array;
  velocities: Float32Array;
  attribute: BufferAttribute;
};

/**
 * The WebGL stand-in for ComputeParticles: same simulation, same look, but the
 * maths runs in a JavaScript loop on the main thread and the whole position
 * buffer is re-uploaded every frame.
 *
 * Drawn with THREE.Points rather than the InstancedMesh the WebGPU side uses —
 * on WebGL that is both the idiomatic and the cheapest option (3 floats per
 * particle per frame), so the comparison stays fair rather than strawmanning it
 * with per-instance matrices.
 *
 * That is the honest comparison. WebGL has no compute shaders, so this is what
 * you actually write — and the cost shows up as CPU milliseconds, the metric
 * that stalls your frame, instead of a fraction of a millisecond of GPU time.
 */
export function CpuParticles({ count, size = 0.05 }: CpuParticlesProps) {
  const points = useMemo(() => {
    const geometry = new BufferGeometry();
    const material = new PointsMaterial({
      color: "#55e6bb",
      size,
      transparent: true,
      opacity: 0.55,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    const points = new Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }, [size]);

  // State mô phỏng sống trong ref, không trả ra từ useMemo: dữ liệu ghi đè mỗi
  // frame thì ref mới là chỗ đúng, và React Compiler coi giá trị hook trả về là
  // bất biến nên mutate chúng sẽ bị chặn.
  const simulation = useRef<Simulation | null>(null);

  useEffect(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const o = i * 3;
      positions[o] = Math.sin(i * 0.013) * 6;
      positions[o + 1] = Math.cos(i * 0.021) * 6;
      positions[o + 2] = Math.sin(i * 0.017) * 6;
    }

    const attribute = new BufferAttribute(positions, 3);
    attribute.setUsage(DynamicDrawUsage);
    points.geometry.setAttribute("position", attribute);

    simulation.current = { positions, velocities, attribute };

    return () => {
      simulation.current = null;
      points.geometry.deleteAttribute("position");
    };
  }, [points, count]);

  useEffect(
    () => () => {
      points.geometry.dispose();
      (points.material as PointsMaterial).dispose();
    },
    [points],
  );

  useFrame(() => {
    const state = simulation.current;
    if (!state) return;

    const { positions, velocities, attribute } = state;

    // Cùng phép toán với compute shader ở ComputeParticles — chỉ khác nó chạy ở đây,
    // trên main thread, mỗi frame.
    for (let i = 0; i < count; i++) {
      const o = i * 3;
      const x = positions[o];
      const y = positions[o + 1];
      const z = positions[o + 2];

      const length = Math.hypot(x, y, z) || 1;

      velocities[o] = (velocities[o] - (x / length) * 0.0009) * 0.999;
      velocities[o + 1] = (velocities[o + 1] - (y / length) * 0.0009) * 0.999;
      velocities[o + 2] = (velocities[o + 2] - (z / length) * 0.0009) * 0.999;

      positions[o] += velocities[o];
      positions[o + 1] += velocities[o + 1];
      positions[o + 2] += velocities[o + 2];
    }

    // Cả buffer phải đẩy lại lên GPU mỗi frame.
    attribute.needsUpdate = true;
  });

  return <primitive object={points} />;
}
