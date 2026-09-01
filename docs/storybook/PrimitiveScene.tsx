import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";

type PrimitiveSceneProps = {
  /** How many primitives to spawn around the hero shape. Drives the scene weight. */
  count?: number;
};

const PALETTE = ["#55e6bb", "#269cff", "#a87cff", "#ffb454"];
const SPIN = 0.6;

/**
 * A deliberately plain scene: only core three primitives and standard materials,
 * no drei. Deliberately backend-neutral — the exact same JSX is mounted under
 * WebGPURenderer and under the classic WebGLRenderer so the two stories compare
 * like for like. WebGPURenderer maps MeshStandardMaterial onto its node material
 * pipeline automatically, which is why no branching is needed here.
 *
 * The layout itself is static — the camera is driven by OrbitControls and each
 * object spins in place. Every primitive gets its own geometry and material, so
 * `count` maps almost one-to-one onto draw calls.
 */
export function PrimitiveScene({ count = 24 }: PrimitiveSceneProps) {
  const field = useRef<Group>(null);
  const hero = useRef<Mesh>(null);

  const shapes = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        // Golden-angle spread so extra shapes fill new ground instead of stacking up.
        const angle = index * 2.399963;
        const radius = 2.6 + Math.sqrt(index) * 0.42;
        return {
          kind: index % 4,
          position: [
            Math.cos(angle) * radius,
            ((index % 7) - 3) * 0.52,
            Math.sin(angle) * radius,
          ] as [number, number, number],
          color: PALETTE[index % PALETTE.length],
        };
      }),
    [count],
  );

  useFrame((_, delta) => {
    if (hero.current) {
      hero.current.rotation.x += delta * SPIN * 0.7;
      hero.current.rotation.y += delta * SPIN;
    }

    // Spinning the children directly avoids holding a ref per object.
    const objects = field.current?.children;
    if (!objects) return;
    for (let index = 0; index < objects.length; index++) {
      const object = objects[index];
      object.rotation.x += delta * SPIN * (0.5 + (index % 3) * 0.3);
      object.rotation.y += delta * SPIN * (0.7 + (index % 4) * 0.2);
    }
  });

  return (
    <>
      <color attach="background" args={["#070b12"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 7, 4]} intensity={2.4} color="#c7e8ff" />
      <pointLight position={[-4, 1, -3]} intensity={40} color="#55e6bb" distance={12} />

      <mesh ref={hero}>
        <boxGeometry args={[1.4, 1.4, 1.4]} />
        <meshStandardMaterial color="#269cff" roughness={0.25} metalness={0.7} />
      </mesh>

      <group ref={field}>
        {shapes.map((shape, index) => (
          <mesh key={index} position={shape.position} scale={0.42}>
            {shape.kind === 0 && <sphereGeometry args={[1, 32, 16]} />}
            {shape.kind === 1 && <coneGeometry args={[0.9, 1.8, 24]} />}
            {shape.kind === 2 && <torusGeometry args={[0.8, 0.3, 16, 48]} />}
            {shape.kind === 3 && <cylinderGeometry args={[0.7, 0.7, 1.6, 24]} />}
            <meshStandardMaterial color={shape.color} roughness={0.35} metalness={0.5} />
          </mesh>
        ))}
      </group>

      <mesh position={[0, -2.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#0b1420" roughness={0.9} metalness={0.1} />
      </mesh>
    </>
  );
}
