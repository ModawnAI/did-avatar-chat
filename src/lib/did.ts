const DID_API_URL = 'https://api.d-id.com';

function getAuthHeader() {
  const apiKey = process.env.DID_API_KEY;
  if (!apiKey) throw new Error('DID_API_KEY not configured');
  return `Basic ${Buffer.from(apiKey).toString('base64')}`;
}

function getHeaders(includeElevenLabs = false) {
  const headers: Record<string, string> = {
    'Authorization': getAuthHeader(),
    'Content-Type': 'application/json',
  };

  if (includeElevenLabs) {
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (elevenLabsKey) {
      headers['x-api-key-external'] = JSON.stringify({
        elevenlabs: elevenLabsKey
      });
      console.log('[D-ID] Including ElevenLabs API key in headers');
    } else {
      console.warn('[D-ID] ELEVENLABS_API_KEY not found in environment!');
    }
  }

  return headers;
}

export async function createStream(agentId: string) {
  console.log('[D-ID createStream] Creating stream for agent:', agentId);

  const requestBody = {
    compatibility_mode: 'auto', // Auto-select best codec (H264 preferred, VP8 fallback)
    fluent: true,
    stream_warmup: true,
  };
  console.log('[D-ID createStream] Request body:', requestBody);

  const response = await fetch(`${DID_API_URL}/agents/${agentId}/streams`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(requestBody),
  });

  console.log('[D-ID createStream] Response status:', response.status);

  const data = await response.json();

  if (!response.ok) {
    console.error('[D-ID createStream] Failed:', data);
    throw new Error(`D-ID stream creation failed: ${response.status} - ${JSON.stringify(data)}`);
  }

  console.log('[D-ID createStream] Success. Stream ID:', data.id);
  console.log('[D-ID createStream] Session ID:', data.session_id);
  console.log('[D-ID createStream] Has offer:', !!data.offer);
  console.log('[D-ID createStream] ICE servers count:', data.ice_servers?.length || 0);

  return data;
}

export async function sendSDP(
  agentId: string,
  streamId: string,
  sessionId: string,
  answer: RTCSessionDescriptionInit
) {
  const response = await fetch(`${DID_API_URL}/agents/${agentId}/streams/${streamId}/sdp`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      session_id: sessionId,
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`D-ID SDP exchange failed: ${response.status} - ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function sendICE(
  agentId: string,
  streamId: string,
  sessionId: string,
  candidate: RTCIceCandidate | null
) {
  const body: Record<string, unknown> = { session_id: sessionId };

  if (candidate) {
    body.candidate = candidate.candidate;
    body.sdpMid = candidate.sdpMid;
    body.sdpMLineIndex = candidate.sdpMLineIndex;
  }

  const response = await fetch(`${DID_API_URL}/agents/${agentId}/streams/${streamId}/ice`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  // ICE endpoint may return empty or simple status
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('D-ID ICE exchange failed:', error);
    throw new Error(`D-ID ICE exchange failed: ${response.status} - ${JSON.stringify(error)}`);
  }

  return response.json().catch(() => ({ status: 'ok' }));
}

export async function speak(
  agentId: string,
  streamId: string,
  sessionId: string,
  text: string,
  voiceId?: string
) {
  console.log('[D-ID speak] Starting speak request:', {
    agentId,
    streamId,
    sessionId,
    textLength: text.length,
    textPreview: text.substring(0, 100),
    voiceId,
  });

  const script: Record<string, unknown> = {
    type: 'text',
    input: text,
  };

  // Use D-ID agent's default voice
  console.log('[D-ID speak] Using agent default voice');

  const requestBody = {
    session_id: sessionId,
    script,
  };
  console.log('[D-ID speak] Request body:', JSON.stringify(requestBody, null, 2));

  const url = `${DID_API_URL}/agents/${agentId}/streams/${streamId}`;
  console.log('[D-ID speak] POST URL:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(requestBody),
  });

  console.log('[D-ID speak] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('[D-ID speak] Error response:', error);
    throw new Error(`D-ID speak failed: ${response.status} - ${JSON.stringify(error)}`);
  }

  const result = await response.json();
  console.log('[D-ID speak] Success response:', JSON.stringify(result, null, 2));
  return result;
}

export async function deleteStream(agentId: string, streamId: string, sessionId: string) {
  const response = await fetch(`${DID_API_URL}/agents/${agentId}/streams/${streamId}`, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify({ session_id: sessionId }),
  });

  return response.ok;
}

export async function getAgent(agentId: string) {
  console.log('[D-ID getAgent] Fetching agent:', agentId);

  const response = await fetch(`${DID_API_URL}/agents/${agentId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('[D-ID getAgent] Failed:', error);
    throw new Error(`Failed to get agent: ${response.status} - ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  console.log('[D-ID getAgent] Agent data:', JSON.stringify(data, null, 2));

  return data;
}
