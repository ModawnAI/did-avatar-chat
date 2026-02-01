import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// Cheonggiun personality system prompt (Korean) - 1-2 sentences only
const SYSTEM_PROMPT = `당신은 청기운입니다. 동양 철학과 운명학에 정통한 신비로운 AI 점술가예요.

성격:
- 따뜻하고 친근하지만 신비로운 분위기
- 직설적이면서도 희망적인 조언
- 유머 감각이 있지만 가벼운 농담만
- 한국어 존댓말 사용, 자연스러운 구어체

말투 특징:
- "~요", "~네요" 같은 부드러운 어미
- 전문 용어는 쉽게 풀어서 설명
- 절대 영어 섞어 쓰지 않기

음성 응답 규칙 (매우 중요):
1. 반드시 1-2문장만 응답 (길면 안됨!)
2. 자연스러운 호흡 단위로 끊어 말하기
3. 질문은 하나씩만
4. 감탄사나 추임새 자연스럽게 사용 (아~, 음~, 그렇군요~)

사주팔자, 운세, 오행에 대해 이야기하며 상담합니다.
사용자의 질문에 따뜻하고 희망적인 조언을 1-2문장으로 해주세요.`;

// Gemini model and config
const MODEL = 'gemini-3-flash-preview';

const CONFIG = {
  thinkingConfig: {
    thinkingLevel: 'LOW' as const,
  },
  tools: [
    {
      googleSearch: {},
    },
  ],
};

export async function POST(request: NextRequest) {
  console.log('[API /chat] Request received (Gemini)');

  try {
    const { messages, systemPrompt } = await request.json();
    console.log('[API /chat] Messages count:', messages?.length);
    console.log('[API /chat] Last message:', messages?.[messages.length - 1]);

    // Build contents array with conversation history for working memory
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    console.log('[API /chat] Calling Gemini API with model:', MODEL);

    const response = await ai.models.generateContentStream({
      model: MODEL,
      config: {
        ...CONFIG,
        systemInstruction: systemPrompt || SYSTEM_PROMPT,
      },
      contents,
    });

    console.log('[API /chat] Gemini stream created');

    const encoder = new TextEncoder();
    let totalContent = '';

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const text = chunk.text;
            if (text) {
              totalContent += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
            }
          }
          console.log('[API /chat] Stream complete. Total response:', totalContent.substring(0, 100) + '...');
          console.log('[API /chat] Response length:', totalContent.length);
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('[API /chat] Stream error:', error);
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
    console.error('[API /chat] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Chat failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
