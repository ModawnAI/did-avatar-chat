// D-ID Types
export interface DIDStreamResponse {
  id: string;
  session_id: string;
  jsep: {
    type: 'offer';
    sdp: string;
  };
  ice_servers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
}

export interface DIDSpeakRequest {
  streamId: string;
  sessionId: string;
  text: string;
  voiceId?: string;
}

// Chat Types
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatRequest {
  messages: Message[];
  systemPrompt?: string;
}

// Avatar State
export type AvatarState =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

// Voice Input State
export type VoiceInputState =
  | 'inactive'
  | 'recording'
  | 'processing';
