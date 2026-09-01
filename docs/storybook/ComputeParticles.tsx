import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  InstancedMesh,
  PlaneGeometry,
  SpriteNodeMaterial,
} from "three/webgpu";
import { Fn, float, instancedArray, instanceIndex, vec3 } from "three/tsl";

type ComputeParticlesProps = {
  count: number;
  /** World-space size of one particle quad. */
  size?: number;
};

/**
 * Particle field simulated entirely on the GPU with a TSL compute shader.
 *
 * This is the part WebGL cannot do at all — not "does slower". Positions and
 * velocities live in storage buffers the GPU owns; the main thread never touches
 * them, so the cost lands on `info.compute.timestamp` and CPU time stays flat no
 * matter how many particles there are. See CpuParticles for the WebGL fallback.
 *
 * Rendered as an InstancedMesh of camera-facing quads rather than THREE.Points:
 * WebGPU only supports 1-pixel point primitives, so a Points-based field is
 * effectively invisible there while looking fine on WebGL. `positionNode` reads
 * the storage buffer directly, so no per-instance matrix ever crosses the bus.
 *
 * Built imperatively and mounted through <primitive>: calling `extend()` with the
 * WebGPU namespace would swap the JSX catalogue globally and break every WebGL
 * story sharing this Storybook iframe.
 */
export function ComputeParticles({
  count,
  size = 0.05,
}: ComputeParticlesProps) {
  // R3F types `gl` as WebGLRenderer; here it is always a WebGPURenderer.
  const renderer = useThree((state) => state.gl) as unknown as {
    compute: (node: unknown) => void;
  };

  const { mesh, initCompute, updateCompute } = useMemo(() => {
    const positions = instancedArray(count, "vec3");
    const velocities = instancedArray(count, "vec3");

    const initCompute = Fn(() => {
      const position = positions.element(instanceIndex);
      const velocity = velocities.element(instanceIndex);
      const i = instanceIndex.toFloat();

      position.assign(
        vec3(
          i.mul(0.013).sin().mul(6),
          i.mul(0.021).cos().mul(6),
          i.mul(0.017).sin().mul(6),
        ),
      );
      velocity.assign(vec3(float(0)));
    })().compute(count);

    // Mọi hạt rơi về tâm rồi văng ra — cùng phép toán với bản CPU để so cho công bằng.
    const updateCompute = Fn(() => {
      const position = positions.element(instanceIndex);
      const velocity = velocities.element(instanceIndex);

      const direction = position.negate().normalize();
      velocity.addAssign(direction.mul(0.0009));
      velocity.mulAssign(0.999);
      position.addAssign(velocity);
    })().compute(count);

    const material = new SpriteNodeMaterial({
      color: "#55e6bb",
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    material.positionNode = positions.toAttribute();

    const mesh = new InstancedMesh(
      new PlaneGeometry(size, size),
      material,
      count,
    );
    // Vị trí do GPU quyết định nên bounding sphere trên CPU vô nghĩa.
    mesh.frustumCulled = false;

    return { mesh, initCompute, updateCompute };
  }, [count, size]);

  useEffect(() => {
    renderer.compute(initCompute);

    return () => {
      mesh.geometry.dispose();
      (mesh.material as SpriteNodeMaterial).dispose();
      mesh.dispose();
    };
  }, [renderer, initCompute, mesh]);

  useFrame(() => {
    renderer.compute(updateCompute);
  });

  return <primitive object={mesh} />;
}
