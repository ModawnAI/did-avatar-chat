'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Microphone,
  PaperPlaneTilt,
  Phone,
  PhoneDisconnect,
  Spinner,
  ChatCircle,
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
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
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
    isVideoPlaying,
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

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <ChatCircle size={28} weight="fill" className="text-cyan-400" />
          <h1 className="text-xl font-semibold text-white">D-ID 아바타 채팅</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${stateColors[state]} ${
                state === 'listening' || state === 'speaking' ? 'animate-pulse' : ''
              }`}
            />
            <span className="text-sm text-gray-400">{stateLabels[state]}</span>
          </div>

          {/* Connect/Disconnect button */}
          {isConnected ? (
            <button
              onClick={disconnect}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <PhoneDisconnect size={20} weight="bold" />
              <span>연결 해제</span>
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={state === 'connecting'}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
            >
              {state === 'connecting' ? (
                <Spinner size={20} className="animate-spin" />
              ) : (
                <Phone size={20} weight="bold" />
              )}
              <span>{state === 'connecting' ? '연결 중...' : '연결'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Avatar section - takes most of the screen */}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="relative w-full h-full max-h-[80vh] bg-black rounded-2xl overflow-hidden shadow-2xl aspect-video">
            {/*
              Two-layer video system:
              - Idle video: Always visible as background (z-10)
              - WebRTC video: On top when speaking (z-20), hidden otherwise
            */}

            {/* Idle video - stays slightly visible during speaking for smooth transition back */}
            {agentInfo?.idleVideo && (
              <video
                ref={idleVideoRef}
                src={agentInfo.idleVideo}
                autoPlay
                loop
                muted
                playsInline
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  zIndex: 10,
                  opacity: 1, // Always visible
                }}
              />
            )}

            {/* WebRTC stream - fades in/out on top of idle */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={false}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                zIndex: 20,
                opacity: isSpeaking ? 1 : 0,
                transition: 'opacity 200ms ease-out',
              }}
            />

            {/* Overlay when idle (not connected) */}
            {state === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 text-gray-400">
                <Phone size={48} weight="light" className="mb-3" />
                <p className="text-sm">연결 버튼을 클릭하세요</p>
              </div>
            )}

            {/* Connecting overlay */}
            {state === 'connecting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/60 text-gray-300">
                <Spinner size={48} className="animate-spin mb-3" />
                <p className="text-sm">연결 중...</p>
              </div>
            )}

            {/* Listening indicator */}
            {isListening && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-blue-500/90 text-white text-sm rounded-full">
                <div className="flex gap-1">
                  <span className="w-1.5 h-4 bg-white rounded-full animate-pulse" />
                  <span className="w-1.5 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
                <span>듣는 중</span>
              </div>
            )}

            {/* Speaking indicator */}
            {state === 'speaking' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-cyan-500/90 text-white text-sm rounded-full">
                <div className="flex gap-1">
                  <span className="w-1 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>말하는 중</span>
              </div>
            )}

            {/* Processing indicator */}
            {state === 'processing' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-purple-500/90 text-white text-sm rounded-full">
                <Spinner size={16} className="animate-spin" />
                <span>생각 중</span>
              </div>
            )}

            {/* Debug info - remove in production */}
            <div className="absolute top-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded z-50">
              state: {state} | speaking: {isSpeaking ? 'Y' : 'N'} | videoPlaying: {isVideoPlaying ? 'Y' : 'N'}
            </div>
          </div>

          {/* Voice controls */}
          <div className="mt-6 flex items-center gap-4">
            {/* Input mode toggle */}
            <div className="flex items-center gap-2 p-1 bg-gray-800 rounded-lg">
              <button
                onClick={() => setInputMode('voice')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  inputMode === 'voice'
                    ? 'bg-cyan-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                음성
              </button>
              <button
                onClick={() => setInputMode('text')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  inputMode === 'text'
                    ? 'bg-cyan-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                텍스트
              </button>
            </div>

            {/* Record button (only in voice mode) - press and hold */}
            {inputMode === 'voice' && isConnected && (
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={state === 'processing' || state === 'speaking'}
                className={`p-4 rounded-full transition-all ${
                  isRecording
                    ? 'bg-red-600 scale-110 animate-pulse'
                    : 'bg-cyan-600 hover:bg-cyan-700'
                } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                title="길게 눌러서 녹음"
              >
                <Microphone size={28} weight="bold" />
              </button>
            )}
          </div>

          {/* Voice mode info */}
          {inputMode === 'voice' && isConnected && (
            <p className="mt-3 text-sm text-gray-500">
              {isRecording ? '녹음 중... 버튼에서 손을 떼면 전송됩니다' : '버튼을 길게 눌러서 말하세요'}
            </p>
          )}
        </div>

        {/* Chat section - narrow sidebar */}
        <div className="w-80 flex flex-col border-l border-gray-700">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && isConnected && (
              <div className="text-center text-gray-500 mt-8">
                <p>{inputMode === 'voice' ? '말씀해 보세요' : '메시지를 입력하세요'}</p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-cyan-600 text-white rounded-br-sm'
                      : 'bg-gray-700 text-gray-100 rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {/* Processing indicator in chat */}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-gray-700 text-gray-300 px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex items-center gap-2">
                    <Spinner size={16} className="animate-spin" />
                    <span className="text-sm">
                      {state === 'processing' ? '생각 중...' : '말하는 중...'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error message */}
          {error && (
            <div className="mx-6 mb-4 flex items-center gap-2 px-4 py-2 bg-red-900/50 border border-red-700 text-red-300 rounded-lg">
              <Warning size={18} />
              <span className="text-sm">{error}</span>
              <button onClick={clearError} className="ml-auto text-red-400 hover:text-red-200">
                &times;
              </button>
            </div>
          )}

          {/* Text input area (only in text mode) */}
          {inputMode === 'text' && (
            <div className="p-6 border-t border-gray-700">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isConnected ? '메시지를 입력하세요...' : '연결 후 채팅할 수 있습니다'}
                  disabled={!isConnected || isProcessing}
                  className="flex-1 px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || !isConnected || isProcessing}
                  className="p-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-xl transition-colors"
                >
                  <PaperPlaneTilt size={22} weight="bold" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
