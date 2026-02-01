import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/did';

// Cache the video in memory to avoid repeated fetches
let cachedVideo: { data: Buffer; contentType: string; url: string } | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function GET() {
  console.log('[idle-video API] Request received');

  try {
    // Check cache
    if (cachedVideo && Date.now() - cacheTimestamp < CACHE_DURATION) {
      console.log('[idle-video API] Serving from cache, size:', cachedVideo.data.length, 'bytes');
      return new NextResponse(cachedVideo.data, {
        headers: {
          'Content-Type': cachedVideo.contentType,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const agentId = process.env.DID_AGENT_ID;
    console.log('[idle-video API] Agent ID:', agentId);

    if (!agentId) {
      console.error('[idle-video API] DID_AGENT_ID not configured');
      return NextResponse.json(
        { error: 'DID_AGENT_ID not configured' },
        { status: 500 }
      );
    }

    console.log('[idle-video API] Fetching agent info...');
    const agent = await getAgent(agentId);
    console.log('[idle-video API] Agent presenter:', JSON.stringify(agent.presenter, null, 2));

    const idleVideoUrl = agent.presenter?.idle_video;
    console.log('[idle-video API] Idle video URL:', idleVideoUrl);

    if (!idleVideoUrl) {
      console.error('[idle-video API] No idle video found for agent');
      return NextResponse.json(
        { error: 'No idle video found for agent' },
        { status: 404 }
      );
    }

    // Fetch the video from D-ID
    console.log('[idle-video API] Fetching video from D-ID...');
    const response = await fetch(idleVideoUrl);
    console.log('[idle-video API] D-ID response status:', response.status);

    if (!response.ok) {
      console.error('[idle-video API] Failed to fetch from D-ID:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch idle video' },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'video/mp4';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('[idle-video API] Video fetched successfully');
    console.log('[idle-video API] Content-Type:', contentType);
    console.log('[idle-video API] Size:', buffer.length, 'bytes');

    // Cache the video
    cachedVideo = { data: buffer, contentType, url: idleVideoUrl };
    cacheTimestamp = Date.now();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[idle-video API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to proxy video' },
      { status: 500 }
    );
  }
}
