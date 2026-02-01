'use client';

import { useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

interface PlayerControlsProps {
  target?: [number, number, number];
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  enablePan?: boolean;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
}

export function PlayerControls({
  target = [0, 1.5, 0],
  minDistance = 3,
  maxDistance = 15,
  minPolarAngle = Math.PI * 0.2,
  maxPolarAngle = Math.PI * 0.6,
  enablePan = false,
  autoRotate = false,
  autoRotateSpeed = 0.5
}: PlayerControlsProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <OrbitControls
      ref={controlsRef}
      target={target}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={minPolarAngle}
      maxPolarAngle={maxPolarAngle}
      enablePan={enablePan}
      enableDamping
      dampingFactor={0.05}
      autoRotate={autoRotate}
      autoRotateSpeed={autoRotateSpeed}
      makeDefault
    />
  );
}
