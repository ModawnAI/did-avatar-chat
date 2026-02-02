'use client';

import { useGLTF } from '@react-three/drei';
import { useEffect } from 'react';
import * as THREE from 'three';

interface TempleModelProps {
  position?: [number, number, number];
  scale?: number;
  rotation?: [number, number, number];
}

export function TempleModel({
  position = [0, 0, 0],
  scale = 1,
  rotation = [0, 0, 0]
}: TempleModelProps) {
  const { scene } = useGLTF('/models/temple/korea-templ2.glb');

  useEffect(() => {
    console.log('[TempleModel] Model loaded, traversing scene...');

    // Calculate bounding box to understand model size
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    console.log('[TempleModel] Model size:', size);
    console.log('[TempleModel] Model center:', center);

    // Enable shadows for all meshes in the model
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  return (
    <primitive
      object={scene}
      position={position}
      scale={scale}
      rotation={rotation}
    />
  );
}

// Preload the model
useGLTF.preload('/models/temple/korea-templ2.glb');
