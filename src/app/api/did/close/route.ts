import { NextRequest, NextResponse } from 'next/server';
import { deleteStream } from '@/lib/did';

export async function POST(request: NextRequest) {
  try {
    const { streamId, sessionId } = await request.json();

    const agentId = process.env.DID_AGENT_ID;
    if (!agentId) {
      return NextResponse.json(
        { error: 'DID_AGENT_ID not configured' },
        { status: 500 }
      );
    }

    const result = await deleteStream(agentId, streamId, sessionId);

    return NextResponse.json({ success: result });
  } catch (error) {
    console.error('Failed to close stream:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to close stream' },
      { status: 500 }
    );
  }
}
