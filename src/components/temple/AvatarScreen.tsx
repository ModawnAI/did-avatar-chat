'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AvatarScreenProps {
  videoElement: HTMLVideoElement | null;
  idleVideoElement: HTMLVideoElement | null;
  isSpeaking: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

export function AvatarScreen({
  videoElement,
  idleVideoElement,
  isSpeaking,
  position = [0, 2, -3],
  rotation = [0, 0, 0],
  scale = 2
}: AvatarScreenProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [speakingTexture, setSpeakingTexture] = useState<THREE.VideoTexture | null>(null);
  const [idleTexture, setIdleTexture] = useState<THREE.VideoTexture | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [hasIdleVideo, setHasIdleVideo] = useState(false);
  const idleTextureCreatedRef = useRef(false);
  const speakingTextureCreatedRef = useRef(false);

  // Fixed aspect ratio for the frame (896x1200 original)
  const aspectRatio = 896 / 1200;

  // Create idle texture
  const createIdleTexture = useCallback(() => {
    if (!idleVideoElement || idleTextureCreatedRef.current) return;

    console.log('[AvatarScreen] Checking idle video:', {
      readyState: idleVideoElement.readyState,
      videoWidth: idleVideoElement.videoWidth,
      videoHeight: idleVideoElement.videoHeight,
      paused: idleVideoElement.paused,
      src: idleVideoElement.src,
    });

    if (idleVideoElement.readyState >= 2 && idleVideoElement.videoWidth > 0) {
      console.log('[AvatarScreen] Creating idle texture:', idleVideoElement.videoWidth, 'x', idleVideoElement.videoHeight);
      try {
        const newTexture = new THREE.VideoTexture(idleVideoElement);
        newTexture.minFilter = THREE.LinearFilter;
        newTexture.magFilter = THREE.LinearFilter;
        newTexture.colorSpace = THREE.SRGBColorSpace;
        newTexture.generateMipmaps = false;
        newTexture.needsUpdate = true;
        setIdleTexture(newTexture);
        setHasIdleVideo(true);
        idleTextureCreatedRef.current = true;
        console.log('[AvatarScreen] Idle texture created successfully');
      } catch (err) {
        console.error('[AvatarScreen] Failed to create idle texture:', err);
      }
    }
  }, [idleVideoElement]);

  // Create speaking texture
  const createSpeakingTexture = useCallback(() => {
    if (!videoElement || speakingTextureCreatedRef.current) return;

    // Only create texture when video has srcObject (WebRTC stream) and dimensions
    if (videoElement.srcObject && videoElement.readyState >= 2 && videoElement.videoWidth > 100) {
      console.log('[AvatarScreen] Creating speaking texture:', videoElement.videoWidth, 'x', videoElement.videoHeight);
      try {
        const newTexture = new THREE.VideoTexture(videoElement);
        newTexture.minFilter = THREE.LinearFilter;
        newTexture.magFilter = THREE.LinearFilter;
        newTexture.colorSpace = THREE.SRGBColorSpace;
        newTexture.generateMipmaps = false;
        newTexture.needsUpdate = true;
        setSpeakingTexture(newTexture);
        setHasVideo(true);
        speakingTextureCreatedRef.current = true;
        console.log('[AvatarScreen] Speaking texture created successfully');
      } catch (err) {
        console.error('[AvatarScreen] Failed to create speaking texture:', err);
      }
    }
  }, [videoElement]);

  // Setup idle video texture
  useEffect(() => {
    if (!idleVideoElement) {
      console.log('[AvatarScreen] No idle video element');
      setIdleTexture(null);
      setHasIdleVideo(false);
      idleTextureCreatedRef.current = false;
      return;
    }

    console.log('[AvatarScreen] Setting up idle video listeners');

    // Reset ref when element changes
    idleTextureCreatedRef.current = false;

    const handleEvent = () => {
      console.log('[AvatarScreen] Idle video event triggered');
      createIdleTexture();
    };

    idleVideoElement.addEventListener('loadeddata', handleEvent);
    idleVideoElement.addEventListener('canplay', handleEvent);
    idleVideoElement.addEventListener('playing', handleEvent);
    idleVideoElement.addEventListener('loadedmetadata', handleEvent);

    // Try immediately
    createIdleTexture();

    // Poll for video readiness
    const interval = setInterval(() => {
      if (!idleTextureCreatedRef.current) {
        createIdleTexture();
      }
    }, 300);

    return () => {
      idleVideoElement.removeEventListener('loadeddata', handleEvent);
      idleVideoElement.removeEventListener('canplay', handleEvent);
      idleVideoElement.removeEventListener('playing', handleEvent);
      idleVideoElement.removeEventListener('loadedmetadata', handleEvent);
      clearInterval(interval);
    };
  }, [idleVideoElement, createIdleTexture]);

  // Setup speaking video texture
  useEffect(() => {
    if (!videoElement) {
      setSpeakingTexture(null);
      setHasVideo(false);
      speakingTextureCreatedRef.current = false;
      return;
    }

    // Reset ref when element changes
    speakingTextureCreatedRef.current = false;

    const handleEvent = () => createSpeakingTexture();

    videoElement.addEventListener('loadeddata', handleEvent);
    videoElement.addEventListener('playing', handleEvent);

    const interval = setInterval(() => {
      if (!speakingTextureCreatedRef.current) {
        createSpeakingTexture();
      }
    }, 300);

    return () => {
      videoElement.removeEventListener('loadeddata', handleEvent);
      videoElement.removeEventListener('playing', handleEvent);
      clearInterval(interval);
    };
  }, [videoElement, createSpeakingTexture]);

  // Update textures every frame
  useFrame(() => {
    // Update speaking texture when speaking
    if (speakingTexture && isSpeaking && videoElement && !videoElement.paused) {
      speakingTexture.needsUpdate = true;
    }
    // Update idle texture when not speaking
    if (idleTexture && !isSpeaking && idleVideoElement && !idleVideoElement.paused) {
      idleTexture.needsUpdate = true;
    }
  });

  // Determine which texture to show
  const activeTexture = isSpeaking && hasVideo ? speakingTexture : (hasIdleVideo ? idleTexture : null);

  // Debug log
  useEffect(() => {
    console.log('[AvatarScreen] State:', {
      isSpeaking,
      hasVideo,
      hasIdleVideo,
      activeTexture: activeTexture ? 'present' : 'null',
      idleVideoElement: idleVideoElement ? 'present' : 'null',
      videoElement: videoElement ? 'present' : 'null',
    });
  }, [isSpeaking, hasVideo, hasIdleVideo, activeTexture, idleVideoElement, videoElement]);

  return (
    <group position={position} rotation={rotation}>
      {/* Decorative frame - 병풍 style outer frame */}
      <mesh position={[0, 0, -0.15]} frustumCulled={false}>
        <boxGeometry args={[scale * aspectRatio * 1.25, scale * 1.25, 0.12]} />
        <meshStandardMaterial color="#1a0f0a" roughness={0.95} metalness={0.05} polygonOffset polygonOffsetFactor={1} />
      </mesh>

      {/* Inner frame - carved wood look */}
      <mesh position={[0, 0, -0.08]} frustumCulled={false}>
        <boxGeometry args={[scale * aspectRatio * 1.12, scale * 1.12, 0.06]} />
        <meshStandardMaterial color="#3d261a" roughness={0.8} metalness={0.1} polygonOffset polygonOffsetFactor={1} />
      </mesh>

      {/* Gold accent border */}
      <mesh position={[0, 0, -0.02]} frustumCulled={false}>
        <boxGeometry args={[scale * aspectRatio * 1.04, scale * 1.04, 0.02]} />
        <meshStandardMaterial color="#8B7355" roughness={0.4} metalness={0.5} polygonOffset polygonOffsetFactor={1} />
      </mesh>

      {/* Video screen - show video (idle or speaking) */}
      <mesh ref={meshRef} position={[0, 0, 0.05]} frustumCulled={false}>
        <planeGeometry args={[scale * aspectRatio, scale]} />
        {activeTexture ? (
          <meshBasicMaterial
            map={activeTexture}
            toneMapped={false}
            depthWrite={true}
            depthTest={true}
            transparent={false}
          />
        ) : (
          <meshStandardMaterial
            color="#0a0a12"
            roughness={0.9}
            metalness={0.1}
            emissive="#1a1a2e"
            emissiveIntensity={0.1}
          />
        )}
      </mesh>

      {/* Mystical glow/pattern when no video available */}
      {!activeTexture && (
        <group>
          {/* Center glow */}
          <mesh position={[0, 0, 0.02]}>
            <circleGeometry args={[scale * 0.3, 32]} />
            <meshBasicMaterial color="#ff6b35" transparent opacity={0.15} />
          </mesh>
          {/* Outer ring */}
          <mesh position={[0, 0, 0.01]}>
            <ringGeometry args={[scale * 0.35, scale * 0.4, 32]} />
            <meshBasicMaterial color="#ff9944" transparent opacity={0.2} />
          </mesh>
        </group>
      )}

      {/* Main glow light */}
      <pointLight
        position={[0, 0, 1.5]}
        intensity={isSpeaking ? 4 : 1.5}
        color={isSpeaking ? '#ffffff' : '#ff9944'}
        distance={10}
        decay={2}
      />

      {/* Side accent lights */}
      <pointLight position={[-scale * aspectRatio * 0.7, 0, 0.5]} intensity={0.8} color="#ff6b35" distance={4} />
      <pointLight position={[scale * aspectRatio * 0.7, 0, 0.5]} intensity={0.8} color="#ff6b35" distance={4} />

      {/* Bottom warm light */}
      <pointLight position={[0, -scale * 0.6, 0.5]} intensity={0.5} color="#ffaa00" distance={3} />
    </group>
  );
}
