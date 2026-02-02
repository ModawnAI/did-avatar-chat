'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { TempleScene } from './TempleScene';

// Background music config
const MUSIC_PATH = '/music/daegeum-playlist.mp3';
const MUSIC_FADE_DURATION = 3000; // 3 seconds fade in
const MUSIC_TARGET_VOLUME = 0.1; // Target volume (0-1)
import {
  Microphone,
  MicrophoneSlash,
  PaperPlaneTilt,
  Phone,
  PhoneDisconnect,
  Spinner,
  Warning,
  SpeakerHigh,
  SpeakerSlash,
} from '@phosphor-icons/react';
import { useAvatarChat } from '@/hooks/useAvatarChat';
import type { AvatarState } from '@/lib/types';

const stateLabels: Record<AvatarState, string> = {
  idle: '연결 안됨',
  connecting: '연결 중...',
  ready: '대기 중',
  listening: '듣는 중...',
  processing: '생각 중...',
  speaking: '말하는 중...',
  error: '오류',
};

const stateColors: Record<AvatarState, string> = {
  idle: 'bg-gray-500',
  connecting: 'bg-yellow-500',
  ready: 'bg-green-500',
  listening: 'bg-blue-500',
  processing: 'bg-purple-500',
  speaking: 'bg-cyan-500',
  error: 'bg-red-500',
};

export function TempleExperience() {
  const [inputText, setInputText] = useState('');
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [idleVideoElement, setIdleVideoElement] = useState<HTMLVideoElement | null>(null);
  const [debugMode] = useState(false); // Set to true to see video elements for debugging
  const [showClickToStart, setShowClickToStart] = useState(true);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicStartedRef = useRef(false);

  // Setup background music
  useEffect(() => {
    const audio = new Audio(MUSIC_PATH);
    audio.loop = true;
    audio.volume = 0;
    audio.currentTime = 2;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  // Function to start music with fade in
  const startMusic = useCallback(() => {
    if (musicStartedRef.current || !audioRef.current) return;

    const audio = audioRef.current;
    audio.currentTime = 2;

    audio.play().then(() => {
      musicStartedRef.current = true;
      setShowClickToStart(false);

      // Fade in
      let currentVolume = 0;
      const fadeStep = MUSIC_TARGET_VOLUME / (MUSIC_FADE_DURATION / 50);
      const fadeInterval = setInterval(() => {
        currentVolume += fadeStep;
        if (currentVolume >= MUSIC_TARGET_VOLUME) {
          audio.volume = MUSIC_TARGET_VOLUME;
          clearInterval(fadeInterval);
        } else {
          audio.volume = currentVolume;
        }
      }, 50);
    }).catch((err) => {
      console.log('[Music] Play failed:', err);
    });
  }, []);

  // Handle click to start
  const handleStartExperience = useCallback(() => {
    startMusic();
    setShowClickToStart(false);
  }, [startMusic]);

  // Toggle music mute
  const toggleMusicMute = useCallback(() => {
    if (audioRef.current) {
      if (isMusicMuted) {
        audioRef.current.volume = MUSIC_TARGET_VOLUME;
      } else {
        audioRef.current.volume = 0;
      }
      setIsMusicMuted(!isMusicMuted);
    }
  }, [isMusicMuted]);

  const {
    state,
    messages,
    isConnected,
    error,
    videoRef,
    idleVideoRef,
    isRecording,
    isSpeaking,
    agentInfo,
    connect,
    disconnect,
    sendMessage,
    startRecording,
    stopRecording,
    clearError,
  } = useAvatarChat({});

  // Debug log for agent info
  useEffect(() => {
    console.log('[TempleExperience] Agent info updated:', agentInfo);
  }, [agentInfo]);

  // Update video elements when refs change
  const syncVideoElements = useCallback(() => {
    const streamVideo = videoRef.current;
    const idleVideo = idleVideoRef.current;

    console.log('[TempleExperience] syncVideoElements called:', {
      streamVideoExists: !!streamVideo,
      idleVideoExists: !!idleVideo,
      streamVideoInState: !!videoElement,
      idleVideoInState: !!idleVideoElement,
    });

    if (streamVideo && streamVideo !== videoElement) {
      console.log('[TempleExperience] Syncing stream video element:', {
        readyState: streamVideo.readyState,
        videoWidth: streamVideo.videoWidth,
        videoHeight: streamVideo.videoHeight,
        src: streamVideo.src,
        srcObject: !!streamVideo.srcObject,
      });
      setVideoElement(streamVideo);
    }

    if (idleVideo && idleVideo !== idleVideoElement) {
      console.log('[TempleExperience] Syncing idle video element:', {
        readyState: idleVideo.readyState,
        videoWidth: idleVideo.videoWidth,
        videoHeight: idleVideo.videoHeight,
        src: idleVideo.src,
        paused: idleVideo.paused,
        error: idleVideo.error?.message,
      });
      setIdleVideoElement(idleVideo);
    }
  }, [videoRef, idleVideoRef, videoElement, idleVideoElement]);

  // Sync on mount and periodically
  useEffect(() => {
    console.log('[TempleExperience] Starting sync interval');
    syncVideoElements();
    const interval = setInterval(syncVideoElements, 500);
    return () => {
      console.log('[TempleExperience] Cleaning up sync interval');
      clearInterval(interval);
    };
  }, [syncVideoElements]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !isConnected) return;
    const text = inputText.trim();
    setInputText('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isProcessing = state === 'processing' || state === 'speaking';
  const isListening = state === 'listening';
  const canInteract = isConnected && !isProcessing;
  const canRecord = isConnected && !isProcessing;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Click to start overlay */}
      {showClickToStart && (
        <div
          className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 cursor-pointer"
          onClick={handleStartExperience}
        >
          <div className="text-center">
            <div className="text-amber-500 text-2xl mb-4">청기운의 암자</div>
            <div className="text-white/80 text-lg animate-pulse">클릭하여 시작</div>
          </div>
        </div>
      )}

      {/* Video elements - visible in debug mode, hidden otherwise */}
      <div
        className="absolute z-50"
        style={debugMode ? {
          bottom: '100px',
          right: '10px',
          display: 'flex',
          gap: '10px'
        } : {
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          opacity: 0.01,
          pointerEvents: 'none'
        }}
      >
        {/* Idle video - always render, use proxied URL */}
        <video
          ref={idleVideoRef}
          src={agentInfo?.idleVideo || '/api/did/idle-video'}
          crossOrigin="anonymous"
          autoPlay
          loop
          muted
          playsInline
          width={512}
          height={512}
          style={{
            width: debugMode ? '150px' : '512px',
            height: debugMode ? '150px' : '512px',
            border: debugMode ? '2px solid yellow' : 'none'
          }}
          onLoadedData={() => {
            console.log('[Video] Idle video loaded, dimensions:', idleVideoRef.current?.videoWidth, 'x', idleVideoRef.current?.videoHeight);
            syncVideoElements();
            // Force play
            idleVideoRef.current?.play().catch(err => console.warn('[Video] Idle autoplay failed:', err));
          }}
          onCanPlay={() => {
            console.log('[Video] Idle video can play');
            syncVideoElements();
            idleVideoRef.current?.play().catch(err => console.warn('[Video] Idle play failed:', err));
          }}
          onPlaying={() => {
            console.log('[Video] Idle video playing');
            syncVideoElements();
          }}
          onError={(e) => {
            const video = e.currentTarget;
            console.error('[Video] Idle video error:', video.error?.message || 'Unknown error');
          }}
        />
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          width={debugMode ? 150 : 512}
          height={debugMode ? 150 : 512}
          style={{
            width: debugMode ? '150px' : '512px',
            height: debugMode ? '150px' : '512px',
            border: debugMode ? '2px solid cyan' : 'none'
          }}
          onLoadedData={() => {
            console.log('[Video] Stream video loaded');
            syncVideoElements();
          }}
          onPlaying={() => {
            console.log('[Video] Stream video playing');
            syncVideoElements();
          }}
        />
      </div>

      {/* 3D Temple Scene - full screen */}
      <div className="absolute inset-0">
        <TempleScene
          videoElement={videoElement}
          idleVideoElement={idleVideoElement}
          isSpeaking={isSpeaking}
        />
      </div>

      {/* Status indicator and music control */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
          <div
            className={`w-2 h-2 rounded-full ${stateColors[state]} ${
              state === 'listening' || state === 'speaking' ? 'animate-pulse' : ''
            }`}
          />
          <span className="text-sm text-white/80">{stateLabels[state]}</span>
        </div>

        {/* Music mute button */}
        <button
          onClick={toggleMusicMute}
          className="p-2 bg-black/50 backdrop-blur-sm rounded-full text-white/80 hover:text-white transition-colors"
          title={isMusicMuted ? '음악 켜기' : '음악 끄기'}
        >
          {isMusicMuted ? (
            <SpeakerSlash size={18} weight="bold" />
          ) : (
            <SpeakerHigh size={18} weight="bold" />
          )}
        </button>
      </div>

      {/* Connect button - center bottom */}
      {!isConnected && state === 'idle' && (
        <div className="absolute bottom-8 left-0 right-0 z-30 flex justify-center">
          <button
            onClick={connect}
            className="flex items-center gap-3 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-full transition-colors text-lg shadow-lg"
          >
            <Phone size={24} weight="bold" />
            <span>청기운과 대화하기</span>
          </button>
        </div>
      )}

      {/* Connecting state - center bottom */}
      {state === 'connecting' && (
        <div className="absolute bottom-8 left-0 right-0 z-30 flex justify-center">
          <div className="flex items-center gap-3 px-6 py-3 bg-yellow-600/80 text-white rounded-full text-lg">
            <Spinner size={24} className="animate-spin" />
            <span>연결 중...</span>
          </div>
        </div>
      )}

      {/* Disconnect button - top right */}
      {isConnected && (
        <div className="absolute top-4 right-4 z-30">
          <button
            onClick={disconnect}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600/80 hover:bg-red-600 backdrop-blur-sm text-white rounded-full transition-colors text-sm"
          >
            <PhoneDisconnect size={18} weight="bold" />
            <span>종료</span>
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute top-16 left-4 right-4 z-40">
          <div className="flex items-center gap-2 px-4 py-2 bg-red-900/80 backdrop-blur-sm border border-red-700 text-red-200 rounded-lg max-w-md">
            <Warning size={18} />
            <span className="text-sm flex-1">{error}</span>
            <button onClick={clearError} className="text-red-300 hover:text-white">
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Chat messages */}
      {messages.length > 0 && (
        <div className="absolute bottom-28 left-4 right-4 max-h-[30vh] z-30 overflow-hidden pointer-events-none">
          <div className="flex flex-col gap-2 overflow-y-auto max-h-full px-2 py-2">
            {messages.slice(-4).map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[60%] px-4 py-2 rounded-2xl backdrop-blur-sm ${
                    message.role === 'user'
                      ? 'bg-amber-600/80 text-white rounded-br-sm'
                      : 'bg-black/60 text-white rounded-bl-sm border border-amber-900/30'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input area */}
      {isConnected && (
        <div className="absolute bottom-0 left-0 right-0 z-40 p-4">
          <div className="flex items-center gap-3 max-w-2xl mx-auto">
            {/* Voice record button */}
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  if (isRecording) {
                    stopRecording();
                  } else {
                    await startRecording();
                  }
                } catch (err) {
                  console.error('Recording error:', err);
                }
              }}
              disabled={!canRecord && !isRecording}
              className={`p-4 rounded-full transition-all flex-shrink-0 ${
                isRecording
                  ? 'bg-red-500 scale-110 animate-pulse'
                  : canRecord
                  ? 'bg-amber-600/80 hover:bg-amber-600 backdrop-blur-sm'
                  : 'bg-white/10 opacity-50 cursor-not-allowed'
              } text-white`}
            >
              {isRecording ? (
                <MicrophoneSlash size={24} weight="bold" />
              ) : (
                <Microphone size={24} weight="bold" />
              )}
            </button>

            {/* Text input */}
            <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-sm rounded-full border border-amber-900/30">
              {isProcessing || isListening ? (
                <div className="flex-1 flex items-center gap-2 text-white/70">
                  <Spinner size={18} className="animate-spin" />
                  <span>{isListening ? '듣는 중...' : '생각 중...'}</span>
                </div>
              ) : (
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isRecording ? '녹음 중...' : '청기운에게 물어보세요...'}
                  disabled={!canInteract}
                  className="flex-1 bg-transparent text-white placeholder-white/50 focus:outline-none disabled:opacity-50"
                />
              )}
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || !canInteract || isListening}
                className="p-2 rounded-full bg-amber-500 hover:bg-amber-600 disabled:bg-white/20 disabled:opacity-50 text-white transition-colors"
              >
                <PaperPlaneTilt size={20} weight="bold" />
              </button>
            </div>
          </div>

          {isRecording && (
            <p className="text-center text-white/70 text-sm mt-2">
              녹음 중... 마이크 버튼을 다시 탭하면 전송됩니다
            </p>
          )}
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 z-20 text-white/40 text-xs pointer-events-none">
        마우스 드래그: 회전 | 스크롤: 줌
      </div>

      {/* Debug panel */}
      {debugMode && (
        <div className="absolute top-20 left-4 z-50 bg-black/80 text-white text-xs p-3 rounded-lg font-mono max-w-xs">
          <div className="font-bold mb-2">Debug Info:</div>
          <div>Agent: {agentInfo?.name || 'loading...'}</div>
          <div>Idle URL: {agentInfo?.idleVideo ? 'set' : 'not set'}</div>
          <div>isSpeaking: {isSpeaking ? 'true' : 'false'}</div>
          <div>State: {state}</div>
          <div className="mt-2 border-t border-white/20 pt-2">
            <div>Stream Video: {videoElement ? 'synced' : 'not synced'}</div>
            <div>Idle Video: {idleVideoElement ? 'synced' : 'not synced'}</div>
            {idleVideoElement && (
              <>
                <div>- readyState: {idleVideoElement.readyState}</div>
                <div>- dimensions: {idleVideoElement.videoWidth}x{idleVideoElement.videoHeight}</div>
                <div>- paused: {idleVideoElement.paused ? 'yes' : 'no'}</div>
                <div>- error: {idleVideoElement.error?.message || 'none'}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
