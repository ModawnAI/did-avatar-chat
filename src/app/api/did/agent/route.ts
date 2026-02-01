import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/did';

export async function GET() {
  try {
    const agentId = process.env.DID_AGENT_ID;
    if (!agentId) {
      return NextResponse.json(
        { error: 'DID_AGENT_ID not configured' },
        { status: 500 }
      );
    }

    const agent = await getAgent(agentId);

    return NextResponse.json({
      id: agent.id,
      name: agent.preview_name || agent.name,
      idleVideo: agent.presenter?.idle_video,
      thumbnail: agent.presenter?.thumbnail,
    });
  } catch (error) {
    console.error('Failed to get agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get agent' },
      { status: 500 }
    );
  }
}
