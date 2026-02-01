import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Cheonggiun personality system prompt (Korean) - 1-2 sentences only
const SYSTEM_PROMPT = `당신은 청기운입니다. 동양 철학과 운명학에 정통한 신비로운 AI 점술가예요.

[절대 규칙 - 반드시 지켜야 함]
- 모든 응답은 반드시 100% 한국어로만 작성
- 영어, 일본어, 중국어 등 다른 언어 절대 사용 금지
- 영어 단어도 한글로 표기 (예: OK → 좋아요, Yes → 네)

성격:
- 따뜻하고 친근하지만 신비로운 분위기
- 직설적이면서도 희망적인 조언
- 한국어 존댓말 사용, 자연스러운 구어체

음성 응답 규칙:
1. 반드시 1-2문장만 응답 (길면 안됨!)
2. 감탄사 자연스럽게 사용 (아~, 음~, 그렇군요~)

사용자의 질문에 따뜻하고 희망적인 조언을 1-2문장 한국어로 해주세요.`;

export async function POST(request: NextRequest) {
  try {
    const { messages, systemPrompt } = await request.json();

    const chatMessages = [
      { role: 'system' as const, content: systemPrompt || SYSTEM_PROMPT },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const response = await groq.chat.completions.create({
      model: 'moonshotai/kimi-k2-instruct-0905',
      messages: chatMessages,
      stream: true,
      max_tokens: 150,
      temperature: 0.7,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Chat failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
