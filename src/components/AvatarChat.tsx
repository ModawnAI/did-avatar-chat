'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Microphone,
  MicrophoneSlash,
  PaperPlaneTilt,
  Phone,
  PhoneDisconnect,
  Spinner,
  Warning,
} from '@phosphor-icons/react';
import { useAvatarChat } from '@/hooks/useAvatarChat';
import type { AvatarState } from '@/lib/types';

interface AvatarChatProps {
  voiceId?: string;
  systemPrompt?: string;
}

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

export function AvatarChat({ voiceId, systemPrompt }: AvatarChatProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  } = useAvatarChat({ voiceId, systemPrompt });

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
  const canRecord = isConnected && !isProcessing; // Can start recording (separate from canInteract)

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Full screen video background */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Idle video - always visible underneath */}
        {agentInfo?.idleVideo && (
          <video
            ref={idleVideoRef}
            src={agentInfo.idleVideo}
            autoPlay
            loop
            muted
            playsInline
            className="absolute w-full h-full object-contain"
            style={{ zIndex: 10 }}
          />
        )}

        {/* WebRTC stream - fades in/out on top */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className="absolute w-full h-full object-contain transition-opacity duration-200 ease-out"
          style={{
            zIndex: 20,
            opacity: isSpeaking ? 1 : 0,
          }}
        />

        {/* Gradient overlay for better text readability */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20"
          style={{ zIndex: 25 }}
        />
      </div>

      {/* Overlay when not connected */}
      {state === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-30">
          <Phone size={64} weight="light" className="text-gray-400 mb-4" />
          <p className="text-gray-400 text-lg mb-6">연결 버튼을 클릭하세요</p>
          <button
            onClick={connect}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full transition-colors text-lg"
          >
            <Phone size={24} weight="bold" />
            <span>연결하기</span>
          </button>
        </div>
      )}

      {/* Connecting overlay */}
      {state === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-30">
          <Spinner size={64} className="animate-spin text-cyan-400 mb-4" />
          <p className="text-gray-300 text-lg">연결 중...</p>
        </div>
      )}

      {/* Header - minimal, floating */}
      <header className="absolute top-0 left-0 right-0 z-40 p-4">
        <div className="flex items-center justify-between">
          {/* Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
            <div
              className={`w-2 h-2 rounded-full ${stateColors[state]} ${
                state === 'listening' || state === 'speaking' ? 'animate-pulse' : ''
              }`}
            />
            <span className="text-sm text-white/80">{stateLabels[state]}</span>
          </div>

          {/* Disconnect button */}
          {isConnected && (
            <button
              onClick={disconnect}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600/80 hover:bg-red-600 backdrop-blur-sm text-white rounded-full transition-colors text-sm"
            >
              <PhoneDisconnect size={18} weight="bold" />
              <span>종료</span>
            </button>
          )}
        </div>
      </header>


      {/* Chat messages - floating panel */}
      {messages.length > 0 && (
        <div className="absolute bottom-24 left-4 right-4 max-h-[40vh] z-30 overflow-hidden">
          <div className="flex flex-col gap-2 overflow-y-auto max-h-full px-2 py-2">
            {messages.slice(-5).map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] px-4 py-2 rounded-2xl backdrop-blur-sm ${
                    message.role === 'user'
                      ? 'bg-cyan-600/80 text-white rounded-br-sm'
                      : 'bg-black/50 text-white rounded-bl-sm'
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

      {/* Error message */}
      {error && (
        <div className="absolute top-20 left-4 right-4 z-40">
          <div className="flex items-center gap-2 px-4 py-2 bg-red-900/80 backdrop-blur-sm border border-red-700 text-red-200 rounded-lg">
            <Warning size={18} />
            <span className="text-sm flex-1">{error}</span>
            <button onClick={clearError} className="text-red-300 hover:text-white">
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Input area - fixed at bottom */}
      {isConnected && (
        <div className="absolute bottom-0 left-0 right-0 z-40 p-4">
          <div className="flex items-center gap-3 max-w-2xl mx-auto">
            {/* Voice record button - tap to toggle */}
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
                  ? 'bg-white/20 hover:bg-white/30 backdrop-blur-sm'
                  : 'bg-white/10 opacity-50 cursor-not-allowed'
              } text-white`}
              title={isRecording ? '탭하여 녹음 중지' : '탭하여 녹음 시작'}
            >
              {isRecording ? (
                <MicrophoneSlash size={24} weight="bold" />
              ) : (
                <Microphone size={24} weight="bold" />
              )}
            </button>

            {/* Text input */}
            <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
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
                  placeholder={isRecording ? '녹음 중...' : '메시지를 입력하세요...'}
                  disabled={!canInteract}
                  className="flex-1 bg-transparent text-white placeholder-white/50 focus:outline-none disabled:opacity-50"
                />
              )}
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || !canInteract || isListening}
                className="p-2 rounded-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-white/20 disabled:opacity-50 text-white transition-colors"
              >
                <PaperPlaneTilt size={20} weight="bold" />
              </button>
            </div>
          </div>

          {/* Recording hint */}
          {isRecording && (
            <p className="text-center text-white/70 text-sm mt-2">
              녹음 중... 마이크 버튼을 다시 탭하면 전송됩니다
            </p>
          )}
        </div>
      )}
    </div>
  );
}
