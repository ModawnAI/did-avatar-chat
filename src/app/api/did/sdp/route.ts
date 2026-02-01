import { NextRequest, NextResponse } from 'next/server';
import { sendSDP } from '@/lib/did';

export async function POST(request: NextRequest) {
  try {
    const { streamId, sessionId, answer } = await request.json();

    const agentId = process.env.DID_AGENT_ID;
    if (!agentId) {
      return NextResponse.json(
        { error: 'DID_AGENT_ID not configured' },
        { status: 500 }
      );
    }

    const result = await sendSDP(agentId, streamId, sessionId, answer);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to exchange SDP:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to exchange SDP' },
      { status: 500 }
    );
  }
}
