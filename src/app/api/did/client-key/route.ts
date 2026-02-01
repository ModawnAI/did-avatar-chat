import { NextRequest, NextResponse } from 'next/server';

const DID_API_URL = 'https://api.d-id.com';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DID_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'DID_API_KEY not configured' },
        { status: 500 }
      );
    }

    const { allowedDomains } = await request.json().catch(() => ({}));

    const response = await fetch(`${DID_API_URL}/agents/client-key`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        allowed_domains: allowedDomains || [
          'http://localhost:3000',
          'http://localhost:3001',
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to create client key:', data);
      return NextResponse.json(
        { error: data.description || 'Failed to create client key' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Client key error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create client key' },
      { status: 500 }
    );
  }
}

// GET existing client key
export async function GET() {
  try {
    const apiKey = process.env.DID_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'DID_API_KEY not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${DID_API_URL}/agents/client-key`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey).toString('base64')}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.description || 'Failed to get client key' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Client key error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get client key' },
      { status: 500 }
    );
  }
}
