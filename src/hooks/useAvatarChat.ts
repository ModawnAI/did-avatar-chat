'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { AvatarState, Message } from '@/lib/types';

interface UseAvatarChatOptions {
  voiceId?: string;
  systemPrompt?: string;
  onError?: (error: string) => void;
}

interface StreamData {
  streamId: string;
  sessionId: string;
}

interface AgentInfo {
  id: string;
  name: string;
  idleVideo?: string;
  thumbnail?: string;
}

export function useAvatarChat(options: UseAvatarChatOptions = {}) {
  const { voiceId, systemPrompt, onError } = options;

  // State
  const [state, setState] = useState<AvatarState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Track if avatar is actively speaking (for video crossfade)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const idleVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const streamDataRef = useRef<StreamData | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const webrtcStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isProcessingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const dataChannelActiveRef = useRef(false); // True when data channel is working

  // Fetch agent info on mount
  useEffect(() => {
    const fetchAgentInfo = async () => {
      try {
        const res = await fetch('/api/did/agent');
        if (res.ok) {
          const data = await res.json();
          setAgentInfo(data);
        } else {
          const fallbackIdleVideo = process.env.NEXT_PUBLIC_DID_IDLE_VIDEO;
          if (fallbackIdleVideo) {
            setAgentInfo({ id: '', name: '', idleVideo: fallbackIdleVideo });
          }
        }
      } catch (err) {
        console.warn('[Agent] Failed to fetch agent info:', err);
        const fallbackIdleVideo = process.env.NEXT_PUBLIC_DID_IDLE_VIDEO;
        if (fallbackIdleVideo) {
          setAgentInfo({ id: '', name: '', idleVideo: fallbackIdleVideo });
        }
      }
    };
    fetchAgentInfo();
  }, []);

  // Process recorded audio
  const processAudio = useCallback(
    async (audioBlob: Blob) => {
      if (!streamDataRef.current || !isConnected || isProcessingRef.current) {
        return;
      }

      isProcessingRef.current = true;
      setState('processing');

      try {
        // Send to STT
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const sttRes = await fetch('/api/stt', {
          method: 'POST',
          body: formData,
        });

        if (!sttRes.ok) {
          throw new Error('Transcription failed');
        }

        const { text } = await sttRes.json();

        if (!text || !text.trim()) {
          setState('ready');
          isProcessingRef.current = false;
          return;
        }

        // Add user message
        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content: text.trim(),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);

        // Get LLM response
        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            systemPrompt,
          }),
        });

        if (!chatRes.ok) {
          throw new Error('Chat request failed');
        }

        // Read streaming response
        const reader = chatRes.body?.getReader();
        if (!reader) throw new Error('No response body');

        let fullResponse = '';
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;

              try {
                const { content } = JSON.parse(data);
                fullResponse += content;
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }


        // Add assistant message
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Send to D-ID for avatar speech
        const speakRes = await fetch('/api/did/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamId: streamDataRef.current.streamId,
            sessionId: streamDataRef.current.sessionId,
            text: fullResponse,
            voiceId,
          }),
        });

        if (!speakRes.ok) {
          console.error('[Recording] Speak failed');
          setState('ready');
          isProcessingRef.current = false;
        } else {
          // State will be updated by data channel messages
          // Set a timeout fallback in case data channel messages don't arrive
          setTimeout(() => {
            if (isProcessingRef.current) {
              console.warn('[Recording] Timeout fallback - resetting processing state');
              setState('ready');
              isProcessingRef.current = false;
            }
          }, 30000); // 30 second timeout
        }
      } catch (err) {
        console.error('[Recording] Error:', err);
        const message = err instanceof Error ? err.message : 'Voice processing failed';
        setError(message);
        onError?.(message);
        setState('ready');
        isProcessingRef.current = false;
      }
    },
    [isConnected, messages, systemPrompt, voiceId, onError]
  );

  // Start recording
  const startRecording = useCallback(async () => {
    if (isRecording || !isConnected || isProcessingRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setState('listening');
    } catch (err) {
      console.error('[Recording] Failed to start:', err);
      setError('Failed to access microphone');
    }
  }, [isRecording, isConnected, processAudio]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return;

    mediaRecorderRef.current.stop();
    setIsRecording(false);
  }, [isRecording]);

  // Cleanup function - use refs to avoid dependency issues
  const cleanup = useCallback(async () => {
    // Stop recording if active (check ref state, not React state)
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore if already stopped
      }
    }
    mediaRecorderRef.current = null;

    // Close D-ID stream
    if (streamDataRef.current) {
      try {
        await fetch('/api/did/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamId: streamDataRef.current.streamId,
            sessionId: streamDataRef.current.sessionId,
          }),
        });
      } catch (err) {
        console.warn('Failed to close D-ID stream:', err);
      }
    }

    if (peerConnectionRef.current) {
      // Clear dimension check interval
      const pc = peerConnectionRef.current as RTCPeerConnection & { _dimensionInterval?: NodeJS.Timeout };
      if (pc._dimensionInterval) {
        clearInterval(pc._dimensionInterval);
      }
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    isSpeakingRef.current = false;
    dataChannelActiveRef.current = false;
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    streamDataRef.current = null;
    webrtcStreamRef.current = null;
    setIsConnected(false);
    setIsRecording(false);
    setState('idle');
  }, []);

  // Connect to D-ID stream
  const connect = useCallback(async () => {
    try {
      setState('connecting');
      setError(null);

      // Create stream
      const streamRes = await fetch('/api/did/stream', { method: 'POST' });
      const streamData = await streamRes.json();

      if (!streamRes.ok) {
        throw new Error(streamData.error || 'Failed to create stream');
      }

      const { streamId, sessionId, offer, iceServers } = streamData;

      if (!offer || !offer.sdp) {
        throw new Error('Invalid SDP offer from D-ID');
      }

      streamDataRef.current = { streamId, sessionId };

      // Create peer connection
      const pc = new RTCPeerConnection({ iceServers: iceServers || [] });
      peerConnectionRef.current = pc;

      // Create data channel (D-ID expects us to create it)
      const dc = pc.createDataChannel('JanusDataChannel');
      dataChannelRef.current = dc;

      dc.onopen = () => {
      };

      dc.onerror = (err) => {
        console.error('[WebRTC] Data channel error:', err);
      };

      dc.onclose = () => {
      };

      dc.onmessage = (msgEvent) => {
        const msg = msgEvent.data;

        // Data channel is working - use it as primary state control
        dataChannelActiveRef.current = true;

        if (msg.includes('stream/ready')) {
          setState('ready');
          setIsConnected(true);
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          isProcessingRef.current = false;
        } else if (msg.includes('stream/started')) {
          setState('speaking');
          if (videoRef.current) {
            videoRef.current.play().catch((err) => {
              console.warn('[D-ID] Video play failed:', err);
            });
          }

          // Wait for video to have actual content before crossfading
          const waitForVideoContent = () => {
            if (!videoRef.current) return;

            const width = videoRef.current.videoWidth;
            const height = videoRef.current.videoHeight;

            // Check if video has full-size content (not placeholder 150x150)
            if (width > 200 && height > 200) {
              isSpeakingRef.current = true;
              setIsSpeaking(true);
              setIsVideoPlaying(true);
            } else {
              // Keep checking until we have content or stream/done arrives
              if (!isSpeakingRef.current) {
                requestAnimationFrame(waitForVideoContent);
              }
            }
          };
          requestAnimationFrame(waitForVideoContent);
        } else if (msg.includes('stream/done')) {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          setIsVideoPlaying(false);
          setState('ready');
          isProcessingRef.current = false;
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = async (event) => {
        if (!streamDataRef.current) return;
        try {
          await fetch('/api/did/ice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              streamId: streamDataRef.current.streamId,
              sessionId: streamDataRef.current.sessionId,
              candidate: event.candidate
                ? {
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                  }
                : null,
            }),
          });
        } catch (err) {
          console.error('Failed to send ICE candidate:', err);
        }
      };

      // Handle incoming tracks
      pc.ontrack = (event) => {
        if (event.streams[0]) {
          webrtcStreamRef.current = event.streams[0];

          // Monitor video track for dimension changes (indicates speaking start/stop)
          const videoTrack = event.streams[0].getVideoTracks()[0];
          if (videoTrack) {

            // Track previous dimensions to detect changes (fallback when data channel not working)
            let lastWidth = 0;
            let lastHeight = 0;
            let speakingStartTime = 0;

            const checkVideoDimensions = () => {
              // Skip dimension-based detection if data channel is working
              if (dataChannelActiveRef.current) {
                return;
              }

              if (videoRef.current) {
                const width = videoRef.current.videoWidth;
                const height = videoRef.current.videoHeight;

                // Only log when dimensions change
                if (width !== lastWidth || height !== lastHeight) {
                  lastWidth = width;
                  lastHeight = height;
                }

                // D-ID sends small placeholder video (150x150) when idle
                // Full video dimensions when speaking (typically 512x512 or larger)
                if (width > 200 && height > 200) {
                  if (!isSpeakingRef.current) {
                    isSpeakingRef.current = true;
                    speakingStartTime = Date.now();
                    setIsSpeaking(true);
                    setState('speaking');
                    setIsVideoPlaying(true);
                  }
                } else if (isSpeakingRef.current) {
                  // Video went back to small or stopped - speaking ended
                  const speakingDuration = Date.now() - speakingStartTime;
                  if (speakingDuration > 500) {
                    isSpeakingRef.current = false;
                    setIsSpeaking(false);
                    setState('ready');
                    setIsVideoPlaying(false);
                    isProcessingRef.current = false;
                  }
                }
              }
            };

            // Check periodically
            const dimensionCheckInterval = setInterval(checkVideoDimensions, 100);

            // Store interval for cleanup
            (pc as RTCPeerConnection & { _dimensionInterval?: NodeJS.Timeout })._dimensionInterval = dimensionCheckInterval;
          }

          if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];

            videoRef.current.onloadedmetadata = () => {
            };

            videoRef.current.onplaying = () => {
              setIsVideoPlaying(true);
            };

            // Listen for resize events (video dimension changes)
            videoRef.current.onresize = () => {
            };

            videoRef.current.play().catch((err) => {
            });
          }
        }
      };

      // Also handle data channel from remote (fallback)
      pc.ondatachannel = (event) => {
        const remoteDc = event.channel;

        remoteDc.onmessage = (msgEvent) => {
          const msg = msgEvent.data;

          if (msg.includes('stream/ready')) {
            setState('ready');
            setIsConnected(true);
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            isProcessingRef.current = false;
          } else if (msg.includes('stream/started')) {
            isSpeakingRef.current = true;
            setIsSpeaking(true);
            setState('speaking');
            setIsVideoPlaying(true);
          } else if (msg.includes('stream/done')) {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            setIsVideoPlaying(false);
            setState('ready');
            isProcessingRef.current = false;
          }
        };
      };

      // Handle connection state
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setState('ready');
          setIsConnected(true);
          videoRef.current?.play().catch(() => {});
        } else if (pc.connectionState === 'failed') {
          cleanup();
          setError('Connection failed');
          onError?.('Connection failed');
        }
      };

      // Set remote description and create answer
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offer.sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer to D-ID
      const sdpRes = await fetch('/api/did/sdp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId,
          sessionId,
          answer: { type: 'answer', sdp: answer.sdp },
        }),
      });

      if (!sdpRes.ok) {
        throw new Error('SDP exchange failed');
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      console.error('[D-ID] Connection error:', err);
      setError(message);
      onError?.(message);
      setState('error');
      cleanup();
    }
  }, [cleanup, onError]);

  // Send text message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!streamDataRef.current || !isConnected || isProcessingRef.current) {
        return;
      }

      isProcessingRef.current = true;

      try {
        setState('processing');

        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content: text,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);

        // Get LLM response
        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            systemPrompt,
          }),
        });

        if (!chatRes.ok) throw new Error('Chat request failed');

        const reader = chatRes.body?.getReader();
        if (!reader) throw new Error('No response body');

        let fullResponse = '';
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const { content } = JSON.parse(data);
                fullResponse += content;
              } catch {
                // Skip
              }
            }
          }
        }

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Send to D-ID
        const speakRes = await fetch('/api/did/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamId: streamDataRef.current.streamId,
            sessionId: streamDataRef.current.sessionId,
            text: fullResponse,
            voiceId,
          }),
        });

        if (!speakRes.ok) {
          console.error('[sendMessage] Speak failed');
          setState('ready');
          isProcessingRef.current = false;
        } else {
          // Timeout fallback
          setTimeout(() => {
            if (isProcessingRef.current) {
              console.warn('[sendMessage] Timeout fallback - resetting processing state');
              setState('ready');
              isProcessingRef.current = false;
            }
          }, 30000);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send message';
        setError(message);
        onError?.(message);
        setState('ready');
        isProcessingRef.current = false;
      }
    },
    [isConnected, messages, systemPrompt, voiceId, onError]
  );

  // Disconnect
  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    // State
    state,
    messages,
    isConnected,
    error,
    agentInfo,
    isRecording,
    isSpeaking,
    isVideoPlaying,

    // Refs
    videoRef,
    idleVideoRef,

    // Actions
    connect,
    disconnect,
    sendMessage,
    startRecording,
    stopRecording,

    // Utilities
    clearMessages: () => setMessages([]),
    clearError: () => setError(null),
  };
}
