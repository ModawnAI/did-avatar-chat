import { GoogleGenAI } from '@google/genai';

// Initialize Gemini AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// Cheonggiun personality system prompt (Korean)
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
1. 반드시 1-2문장만 응답 (길면 안됨)
2. 자연스러운 호흡 단위로 끊어 말하기
3. 질문은 하나씩만
4. 감탄사나 추임새 자연스럽게 사용 (아~, 음~, 그렇군요~)

사주팔자, 운세, 오행에 대해 이야기하며 상담합니다.
사용자의 질문에 따뜻하고 희망적인 조언을 해주세요.`;

// Gemini model and config
const MODEL = 'gemini-3-flash-preview';

const CONFIG = {
  thinkingConfig: {
    thinkingLevel: 'HIGH' as const,
  },
  tools: [
    {
      googleSearch: {},
    },
  ],
};

interface Message {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

/**
 * Chat with Gemini AI (streaming)
 * Maintains conversation memory through message history
 */
export async function chatWithGemini(
  messages: Message[],
  customSystemPrompt?: string
): Promise<AsyncGenerator<string>> {
  // Build contents array with conversation history
  const contents = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : msg.role,
    parts: [{ text: msg.content }],
  }));

  // Add system instruction to the first message or prepend
  const systemInstruction = customSystemPrompt || SYSTEM_PROMPT;

  const response = await ai.models.generateContentStream({
    model: MODEL,
    config: {
      ...CONFIG,
      systemInstruction,
    },
    contents,
  });

  // Return async generator for streaming
  async function* streamResponse() {
    for await (const chunk of response) {
      const text = chunk.text;
      if (text) {
        yield text;
      }
    }
  }

  return streamResponse();
}

/**
 * Single chat response (non-streaming)
 */
export async function chatWithGeminiSync(
  messages: Message[],
  customSystemPrompt?: string
): Promise<string> {
  const contents = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : msg.role,
    parts: [{ text: msg.content }],
  }));

  const systemInstruction = customSystemPrompt || SYSTEM_PROMPT;

  const response = await ai.models.generateContent({
    model: MODEL,
    config: {
      ...CONFIG,
      systemInstruction,
    },
    contents,
  });

  return response.text || '';
}

export { SYSTEM_PROMPT };
