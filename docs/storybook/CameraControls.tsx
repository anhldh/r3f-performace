import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

type CameraControlsProps = {
  /** Point the camera orbits around. */
  target?: [number, number, number];
  minDistance?: number;
  maxDistance?: number;
};

/**
 * Plain three OrbitControls wired into the R3F loop — the drei-free equivalent of
 * drei's <OrbitControls />. Drag to orbit, scroll to dolly, right-drag to pan.
 */
export function CameraControls({
  target = [0, 0, 0],
  minDistance = 3,
  maxDistance = 24,
}: CameraControlsProps) {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const controls = useRef<OrbitControls>(null);

  const [x, y, z] = target;

  useEffect(() => {
    const instance = new OrbitControls(camera, domElement);
    instance.enableDamping = true;
    instance.dampingFactor = 0.08;
    instance.minDistance = minDistance;
    instance.maxDistance = maxDistance;
    instance.target.set(x, y, z);
    instance.update();
    controls.current = instance;

    return () => {
      instance.dispose();
      controls.current = null;
    };
  }, [camera, domElement, minDistance, maxDistance, x, y, z]);

  // Damping needs an update() every frame to keep easing after the pointer is released.
  useFrame((_, delta) => {
    controls.current?.update(delta);
  });

  return null;
}
