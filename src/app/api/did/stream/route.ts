import { NextResponse } from 'next/server';
import { createStream } from '@/lib/did';

export async function POST() {
  try {
    const agentId = process.env.DID_AGENT_ID;
    if (!agentId) {
      return NextResponse.json(
        { error: 'DID_AGENT_ID not configured' },
        { status: 500 }
      );
    }

    const streamData = await createStream(agentId);

    console.log('D-ID stream response:', JSON.stringify(streamData, null, 2));

    // D-ID returns 'offer' not 'jsep'
    const offer = streamData.offer || streamData.jsep;

    // Validate response has required fields
    if (!streamData.id || !streamData.session_id || !offer) {
      console.error('Invalid D-ID response - missing fields:', {
        hasId: !!streamData.id,
        hasSessionId: !!streamData.session_id,
        hasOffer: !!offer,
      });
      return NextResponse.json(
        { error: 'Invalid response from D-ID API' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      streamId: streamData.id,
      sessionId: streamData.session_id,
      offer: {
        type: offer.type || 'offer',
        sdp: offer.sdp,
      },
      iceServers: streamData.ice_servers || [],
    });
  } catch (error) {
    console.error('Failed to create D-ID stream:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create stream' },
      { status: 500 }
    );
  }
}
