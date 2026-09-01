import { useCallback } from "react";
import { Canvas, type CanvasProps } from "@react-three/fiber";
import { WebGPURenderer } from "three/webgpu";

/** The default renderer options R3F hands to a `gl` factory. Not exported by fiber. */
type DefaultGLProps = Parameters<
  Extract<NonNullable<CanvasProps["gl"]>, (...args: any[]) => any>
>[0];

/**
 * A Canvas that swaps the default WebGLRenderer for three's WebGPURenderer.
 *
 * React Three Fiber accepts an async `gl` factory, which is what WebGPU needs:
 * `renderer.init()` resolves after the adapter and device are ready. If WebGPU is
 * unavailable the renderer falls back to its own WebGL 2 backend on its own, so the
 * scene keeps rendering everywhere — read `usePerfData().infos.api` to see which
 * backend actually won.
 */
export function WebGpuCanvas({ children, ...props }: Omit<CanvasProps, "gl">) {
  const createRenderer = useCallback(
    async ({ canvas, antialias, alpha }: DefaultGLProps) => {
      const renderer = new WebGPURenderer({
        canvas: canvas as HTMLCanvasElement,
        antialias: antialias ?? true,
        alpha: alpha ?? false,
      });

      await renderer.init();
      return renderer;
    },
    [],
  );

  return (
    <Canvas gl={createRenderer} {...props}>
      {children}
    </Canvas>
  );
}
