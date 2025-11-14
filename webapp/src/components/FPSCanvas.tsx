'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, PointerLockControls, Sky, StatsGl } from '@react-three/drei';
import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type MovementKeys = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
};

const INITIAL_KEYS: MovementKeys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
};

function useMovementControls() {
  const [keys, setKeys] = useState<MovementKeys>(INITIAL_KEYS);

  const toggleKey = useCallback((key: string, pressed: boolean) => {
    setKeys((prev) => {
      const next = { ...prev };
      switch (key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          next.forward = pressed;
          break;
        case 's':
        case 'arrowdown':
          next.backward = pressed;
          break;
        case 'a':
        case 'arrowleft':
          next.left = pressed;
          break;
        case 'd':
        case 'arrowright':
          next.right = pressed;
          break;
        case ' ':
          next.jump = pressed;
          break;
        case 'shift':
          next.sprint = pressed;
          break;
        default:
          break;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => toggleKey(event.key, true);
    const handleKeyUp = (event: KeyboardEvent) => toggleKey(event.key, false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [toggleKey]);

  return keys;
}

type Collider = {
  position: THREE.Vector3;
  size: THREE.Vector3;
};

function createCollider(position: [number, number, number], size: [number, number, number]): Collider {
  return {
    position: new THREE.Vector3(...position),
    size: new THREE.Vector3(...size),
  };
}

function intersectsBox(point: THREE.Vector3, collider: Collider) {
  const min = collider.position.clone().sub(collider.size.clone().multiplyScalar(0.5));
  const max = collider.position.clone().add(collider.size.clone().multiplyScalar(0.5));
  return (
    point.x > min.x &&
    point.x < max.x &&
    point.y > min.y &&
    point.y < max.y &&
    point.z > min.z &&
    point.z < max.z
  );
}

function Player({
  controlsRef,
  colliders,
}: {
  controlsRef: MutableRefObject<any>;
  colliders: Collider[];
}) {
  const { camera } = useThree();
  const keys = useMovementControls();
  const velocity = useRef(new THREE.Vector3());
  const position = useRef(new THREE.Vector3(0, 1.6, 6));
  const onGround = useRef(false);
  const tempFront = useMemo(() => new THREE.Vector3(), []);
  const tempSide = useMemo(() => new THREE.Vector3(), []);
  const moveDirection = useMemo(() => new THREE.Vector3(), []);

  const capsuleRadius = 0.35;
  const capsuleHeight = 1.7;

  const resolveCollisions = useCallback(
    (target: THREE.Vector3) => {
      for (const collider of colliders) {
        if (intersectsBox(target, collider)) {
          const min = collider.position.clone().sub(collider.size.clone().multiplyScalar(0.5));
          const max = collider.position.clone().add(collider.size.clone().multiplyScalar(0.5));

          if (target.y - capsuleRadius < max.y && target.y + capsuleHeight > min.y) {
            const depthX = Math.min(max.x - (target.x - capsuleRadius), target.x + capsuleRadius - min.x);
            const depthZ = Math.min(max.z - (target.z - capsuleRadius), target.z + capsuleRadius - min.z);
            if (depthX < depthZ) {
              target.x += target.x > collider.position.x ? depthX : -depthX;
              velocity.current.x = 0;
            } else {
              target.z += target.z > collider.position.z ? depthZ : -depthZ;
              velocity.current.z = 0;
            }
          }
        }
      }

      if (target.y < 1.6) {
        target.y = 1.6;
        velocity.current.y = 0;
        onGround.current = true;
      } else {
        onGround.current = false;
      }
    },
    [colliders, capsuleHeight, capsuleRadius],
  );

  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!controls?.isLocked) {
      return;
    }

    const acceleration = 36;
    const damping = Math.exp(-4 * delta);
    const gravity = 50;
    const jumpStrength = 10;
    const moveZ = Number(keys.backward) - Number(keys.forward);
    const moveX = Number(keys.right) - Number(keys.left);

    velocity.current.x *= damping;
    velocity.current.z *= damping;

    const targetSpeed = keys.sprint ? 12 : 6;
    if (moveX !== 0 || moveZ !== 0) {
      tempFront.set(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
      tempSide.set(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize();
      moveDirection
        .copy(tempFront)
        .multiplyScalar(moveZ)
        .addScaledVector(tempSide, moveX);

      if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize();
        velocity.current.addScaledVector(moveDirection, acceleration * delta);
      }

      const currentSpeed = Math.sqrt(velocity.current.x ** 2 + velocity.current.z ** 2);
      if (currentSpeed > targetSpeed) {
        const factor = targetSpeed / currentSpeed;
        velocity.current.x *= factor;
        velocity.current.z *= factor;
      }
    }

    velocity.current.y -= gravity * delta;

    if (keys.jump && onGround.current) {
      velocity.current.y = jumpStrength;
      onGround.current = false;
    }

    const nextPosition = position.current.clone().addScaledVector(velocity.current, delta);
    resolveCollisions(nextPosition);
    position.current.copy(nextPosition);

    camera.position.copy(position.current);
  });

  return null;
}

function SceneEnvironment({ colliders }: { colliders: Collider[] }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#808080', roughness: 0.5, metalness: 0.1 }), []);

  return (
    <>
      <fog attach="fog" args={['#0d1b2a', 30, 150]} />
      <ambientLight intensity={0.2} />
      <directionalLight
        position={[20, 35, 20]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <hemisphereLight args={['#c9d6ff', '#262626', 0.75]} />
      <Sky distance={450000} sunPosition={[5, 1, -2]} inclination={0.49} azimuth={0.25} />
      <Environment preset="sunset" />
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#1f2937" metalness={0.1} roughness={0.7} />
      </mesh>
      <NeonDistrict />
      <FloatingDrone origin={new THREE.Vector3(-6, 6, -12)} radius={6} speed={0.6} />
      <FloatingDrone origin={new THREE.Vector3(10, 5, -20)} radius={4} speed={0.8} phase={Math.PI / 3} />
      {colliders.map((collider, index) => (
        <mesh key={index} position={collider.position} castShadow receiveShadow material={material}>
          <boxGeometry args={[collider.size.x, collider.size.y, collider.size.z]} />
        </mesh>
      ))}
    </>
  );
}

function NeonDistrict() {
  type Structure = {
    position: [number, number, number];
    scale: [number, number, number];
    color: string;
    emissive: string;
  };

  const structures: Structure[] = useMemo(
    () => [
      { position: [-8, 6, -18], scale: [4, 12, 4], color: '#111827', emissive: '#38bdf8' },
      { position: [12, 8, -26], scale: [6, 16, 6], color: '#0f172a', emissive: '#f472b6' },
      { position: [-2, 4, -8], scale: [3, 8, 3], color: '#1f2937', emissive: '#22d3ee' },
      { position: [6, 5, -14], scale: [3, 10, 5], color: '#111827', emissive: '#a855f7' },
    ],
    [],
  );

  return (
    <group>
      {structures.map((tower, index) => (
        <mesh key={index} position={tower.position} scale={tower.scale} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={tower.color}
            metalness={0.6}
            roughness={0.2}
            emissive={tower.emissive}
            emissiveIntensity={0.35}
          />
        </mesh>
      ))}

      <mesh position={[0, 0.05, -15]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0f172a" metalness={0.1} roughness={0.8} />
      </mesh>

      <mesh position={[0, 1.5, -12]} rotation={[0, Math.PI / 3, 0]} castShadow>
        <boxGeometry args={[0.2, 3, 12]} />
        <meshStandardMaterial color="#1e40af" emissive="#60a5fa" emissiveIntensity={0.6} metalness={0.8} roughness={0.1} />
      </mesh>

      <mesh position={[0, 3.6, -12]} rotation={[0, Math.PI / 3, 0]} castShadow>
        <boxGeometry args={[0.3, 0.2, 12]} />
        <meshStandardMaterial color="#f59e0b" emissive="#fbbf24" emissiveIntensity={0.9} metalness={0.2} roughness={0.3} />
      </mesh>

      <pointLight position={[0, 6, -12]} intensity={1.6} color="#38bdf8" distance={25} decay={2} />
      <pointLight position={[8, 6, -18]} intensity={1.3} color="#f472b6" distance={18} decay={2.4} />

      <mesh position={[-6, 2.5, -6]} castShadow receiveShadow>
        <torusGeometry args={[2, 0.4, 16, 64]} />
        <meshStandardMaterial color="#1b1f3b" metalness={0.7} roughness={0.25} emissive="#22d3ee" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function FloatingDrone({
  origin,
  radius,
  speed,
  phase = 0,
}: {
  origin: THREE.Vector3;
  radius: number;
  speed: number;
  phase?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const start = useMemo(() => origin.clone(), [origin]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime * speed + phase;
    const yWave = Math.sin(t * 1.8) * 1.2;
    group.current.position.set(
      start.x + Math.cos(t) * radius,
      start.y + yWave,
      start.z + Math.sin(t) * radius,
    );
    group.current.rotation.y = t + Math.PI / 2;
  });

  return (
    <group ref={group}>
      <mesh castShadow>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.9} roughness={0.15} />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <ringGeometry args={[0.7, 0.72, 48]} />
        <meshStandardMaterial color="#0ea5e9" emissive="#38bdf8" emissiveIntensity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <spotLight
        position={[0, -0.5, 0]}
        angle={0.6}
        penumbra={0.8}
        castShadow
        intensity={1.4}
        distance={10}
        color="#38bdf8"
      />
    </group>
  );
}

export function FPSCanvas() {
  const controlsRef = useRef<any>(null);

  const colliders = useMemo(
    () => [
      createCollider([0, 1.5, -10], [8, 3, 2]),
      createCollider([-12, 2.5, -24], [6, 5, 8]),
      createCollider([14, 3.5, -18], [10, 7, 10]),
      createCollider([-6, 1.5, -3], [2, 3, 8]),
      createCollider([9, 1.5, 4], [12, 3, 2]),
      createCollider([2, 5, -38], [18, 10, 6]),
    ],
    [],
  );

  return (
    <Canvas
      shadows
      camera={{ position: [0, 1.6, 6], fov: 70 }}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
    >
      <color attach="background" args={['#0b1120']} />
      <SceneEnvironment colliders={colliders} />
      <PointerLockControls ref={controlsRef} selector="#fps-overlay" />
      <Player controlsRef={controlsRef} colliders={colliders} />
      <StatsGl />
    </Canvas>
  );
}
