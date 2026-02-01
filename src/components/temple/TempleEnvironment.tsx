'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

export function TempleEnvironment() {
  const { scene } = useThree();

  useEffect(() => {
    console.log('[TempleEnvironment] Setting up environment');
  }, []);

  return (
    <>
      {/* Night sky background - dark blue */}
      <color attach="background" args={['#0d0d1a']} />

      {/* Fog for atmosphere - pushed back for massive temple */}
      <fog attach="fog" args={['#0d0d1a', 80, 400]} />

      {/* Stars - massive radius for huge scene */}
      <Stars
        radius={500}
        depth={200}
        count={5000}
        factor={6}
        saturation={0}
        fade
        speed={0.3}
      />

      {/* Fireflies / ambient particles - spread across massive scene */}
      <Sparkles
        count={150}
        scale={[80, 30, 100]}
        position={[0, 10, -20]}
        size={5}
        speed={0.2}
        opacity={0.5}
        color="#ffaa44"
      />

      {/* More ambient light for visibility */}
      <ambientLight intensity={0.4} color="#9090a0" />

      {/* Moon light - brighter for visibility, larger shadow coverage */}
      <directionalLight
        position={[30, 50, 30]}
        intensity={0.8}
        color="#c0c8d0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />

      {/* Fill light from front */}
      <directionalLight
        position={[0, 20, 40]}
        intensity={0.4}
        color="#ffd0a0"
      />

      {/* Hemisphere light for natural sky/ground color */}
      <hemisphereLight
        args={['#303050', '#201510', 0.4]}
      />

      {/* Ground plane - dark earth, massive for huge temple */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial
          color="#1a1815"
          roughness={1}
          metalness={0}
        />
      </mesh>
    </>
  );
}

// Lantern light component for warm glow
interface LanternLightProps {
  position: [number, number, number];
  intensity?: number;
  color?: string;
}

export function LanternLight({
  position,
  intensity = 2,
  color = '#ff6b35'
}: LanternLightProps) {
  const lightRef = useRef<THREE.PointLight>(null);

  // Subtle flickering effect
  useFrame((state) => {
    if (lightRef.current) {
      const flicker = Math.sin(state.clock.elapsedTime * 8) * 0.15 +
                      Math.sin(state.clock.elapsedTime * 12) * 0.1;
      lightRef.current.intensity = intensity + flicker;
    }
  });

  return (
    <pointLight
      ref={lightRef}
      position={position}
      intensity={intensity}
      color={color}
      distance={12}
      decay={2}
    />
  );
}
