import { NextRequest, NextResponse } from 'next/server';
import { sendICE } from '@/lib/did';

export async function POST(request: NextRequest) {
  try {
    const { streamId, sessionId, candidate } = await request.json();

    const agentId = process.env.DID_AGENT_ID;
    if (!agentId) {
      return NextResponse.json(
        { error: 'DID_AGENT_ID not configured' },
        { status: 500 }
      );
    }

    const result = await sendICE(agentId, streamId, sessionId, candidate);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to exchange ICE:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to exchange ICE' },
      { status: 500 }
    );
  }
}
