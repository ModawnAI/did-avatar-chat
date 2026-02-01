import { NextRequest, NextResponse } from 'next/server';
import { speak } from '@/lib/did';

export async function POST(request: NextRequest) {
  console.log('[API /did/speak] Request received');

  try {
    const body = await request.json();
    const { streamId, sessionId, text, voiceId } = body;

    console.log('[API /did/speak] Request body:', {
      streamId,
      sessionId,
      textLength: text?.length,
      textPreview: text?.substring(0, 50),
      voiceId,
    });

    const agentId = process.env.DID_AGENT_ID;
    if (!agentId) {
      console.error('[API /did/speak] DID_AGENT_ID not configured');
      return NextResponse.json(
        { error: 'DID_AGENT_ID not configured' },
        { status: 500 }
      );
    }

    console.log('[API /did/speak] Using agent ID:', agentId);

    const result = await speak(agentId, streamId, sessionId, text, voiceId);

    console.log('[API /did/speak] Success:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API /did/speak] Failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to speak' },
      { status: 500 }
    );
  }
}
