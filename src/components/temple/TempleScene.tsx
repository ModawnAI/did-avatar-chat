'use client';

import { Suspense, useState, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Preload, Loader, OrbitControls, Html } from '@react-three/drei';
import { TempleModel } from './TempleModel';
import { TempleEnvironment, LanternLight } from './TempleEnvironment';
import { AvatarScreen } from './AvatarScreen';
import * as THREE from 'three';

interface TempleSceneProps {
  videoElement: HTMLVideoElement | null;
  idleVideoElement: HTMLVideoElement | null;
  isSpeaking: boolean;
}

// Camera positions
const START_POSITION = new THREE.Vector3(1.46, 6.35, -81.81);
const END_POSITION = new THREE.Vector3(-0.28, 4.93, -36.46);
const TARGET_POSITION = new THREE.Vector3(0, 5, -32.5); // Look at the avatar screen
const INTRO_DURATION = 4; // seconds for the zoom animation

// Intro camera animation component
function CameraIntro({
  onComplete,
  controlsRef
}: {
  onComplete: () => void;
  controlsRef: React.RefObject<any>;
}) {
  const { camera } = useThree();
  const progressRef = useRef(0);
  const completedRef = useRef(false);

  // Make camera look at target during animation
  useFrame((_, delta) => {
    if (completedRef.current) return;

    progressRef.current += delta / INTRO_DURATION;

    if (progressRef.current >= 1) {
      progressRef.current = 1;
      completedRef.current = true;

      // Set final camera position
      camera.position.copy(END_POSITION);
      camera.lookAt(TARGET_POSITION);
      camera.updateProjectionMatrix();

      // Sync OrbitControls with final camera state BEFORE enabling
      if (controlsRef.current) {
        // Set the target
        controlsRef.current.target.copy(TARGET_POSITION);
        // Force the controls to use current camera position
        controlsRef.current.object.position.copy(END_POSITION);
        // Save the current state
        controlsRef.current.saveState();
        // Update to sync internal state
        controlsRef.current.update();
      }

      // Small delay to ensure controls are synced
      setTimeout(() => {
        onComplete();
      }, 50);
    } else {
      // Smooth easing function (ease-out cubic)
      const t = 1 - Math.pow(1 - progressRef.current, 3);

      camera.position.lerpVectors(START_POSITION, END_POSITION, t);
      camera.lookAt(TARGET_POSITION);
    }
  });

  return null;
}

// Debug component to show camera position in real-time
function CameraLogger({ showDebug }: { showDebug: boolean }) {
  const { camera } = useThree();
  const [pos, setPos] = useState({ x: 0, y: 0, z: 0 });
  const [rot, setRot] = useState({ x: 0, y: 0, z: 0 });

  useFrame(() => {
    if (showDebug) {
      setPos({
        x: Math.round(camera.position.x * 100) / 100,
        y: Math.round(camera.position.y * 100) / 100,
        z: Math.round(camera.position.z * 100) / 100,
      });
      setRot({
        x: Math.round(camera.rotation.x * 100) / 100,
        y: Math.round(camera.rotation.y * 100) / 100,
        z: Math.round(camera.rotation.z * 100) / 100,
      });
    }
  });

  if (!showDebug) return null;

  return (
    <Html position={[0, 12, 0]} center>
      <div style={{
        background: 'rgba(0,0,0,0.85)',
        color: '#0f0',
        padding: '12px 18px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '14px',
        whiteSpace: 'nowrap',
        border: '1px solid #0f0',
      }}>
        <div><strong>Camera Position:</strong></div>
        <div>position: [{pos.x}, {pos.y}, {pos.z}]</div>
        <div style={{ marginTop: '8px' }}><strong>Rotation:</strong></div>
        <div>rotation: [{rot.x}, {rot.y}, {rot.z}]</div>
      </div>
    </Html>
  );
}

// Inner scene content
function SceneContent({
  videoElement,
  idleVideoElement,
  isSpeaking
}: TempleSceneProps) {
  const showDebug = false; // Set to true to show camera position debug
  const [introComplete, setIntroComplete] = useState(false);
  const controlsRef = useRef<any>(null);

  return (
    <>
      {/* Intro camera animation */}
      {!introComplete && (
        <CameraIntro
          onComplete={() => setIntroComplete(true)}
          controlsRef={controlsRef}
        />
      )}

      {/* Debug camera position */}
      <CameraLogger showDebug={showDebug} />

      {/* Environment (sky, lights, fog) */}
      <TempleEnvironment />

      {/* Temple model - massive scale to fill the scene */}
      <TempleModel
        position={[0, 0, -30]}
        scale={20}
        rotation={[0, 0, 0]}
      />

      {/* Avatar screen (병풍) - positioned closer to camera */}
      <AvatarScreen
        videoElement={videoElement}
        idleVideoElement={idleVideoElement}
        isSpeaking={isSpeaking}
        position={[0, 5, -32.5]}
        rotation={[0, 9.5, 0]}
        scale={3}
      />

      {/* Lantern lights around the temple and frame - adjusted for massive scale */}
      <LanternLight position={[-8, 3, 0]} intensity={3} />
      <LanternLight position={[8, 3, 0]} intensity={3} />
      <LanternLight position={[-4, 6, -20]} intensity={4} color="#ff8c42" />
      <LanternLight position={[4, 6, -20]} intensity={4} color="#ff8c42" />
      <LanternLight position={[-15, 5, -28]} intensity={5} />
      <LanternLight position={[15, 5, -28]} intensity={5} />
      <LanternLight position={[0, 8, -28]} intensity={3} color="#ff8c42" />

      {/* Orbit controls - only enabled after intro completes */}
      <OrbitControls
        ref={controlsRef}
        enabled={introComplete}
        target={TARGET_POSITION.toArray() as [number, number, number]}
        minDistance={3}
        maxDistance={100}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.55}
        enablePan={false}
        enableDamping
        dampingFactor={0.05}
      />

      {/* Preload assets */}
      <Preload all />
    </>
  );
}

export function TempleScene({ videoElement, idleVideoElement, isSpeaking }: TempleSceneProps) {
  return (
    <div className="relative w-full h-full">
      <Canvas
        shadows
        camera={{
          fov: 60,
          near: 0.1,
          far: 2000,
          position: [1.46, 6.35, -81.81] // Start position for intro animation
        }}
      >
        <Suspense fallback={null}>
          <SceneContent
            videoElement={videoElement}
            idleVideoElement={idleVideoElement}
            isSpeaking={isSpeaking}
          />
        </Suspense>
      </Canvas>

      {/* Loading indicator */}
      <Loader
        containerStyles={{
          background: 'rgba(0, 0, 0, 0.9)',
        }}
        innerStyles={{
          background: '#f59e0b',
          width: '200px',
          height: '3px',
        }}
        barStyles={{
          background: '#fcd34d',
          height: '3px',
        }}
        dataStyles={{
          color: '#fff',
          fontSize: '14px',
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}
