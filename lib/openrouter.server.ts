// Server-only OpenRouter integration
// This file should never be imported client-side

import { handleAiServiceError, AI_SERVICE_CONFIGS } from './aiUtils';

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-preview-05-20';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options: Partial<OpenRouterRequest> = {}
): Promise<string> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/sdxl-emoji-pipeline',
      'X-Title': 'SDXL Emoji Pipeline'
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      ...options
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || 
      `OpenRouter API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Batch prompt generation constants and interfaces
export const BATCH_PROMPT_GENERATION_INSTRUCTIONS = `
For each word below, generate ONE emoji object following these rules:

1. Object MUST visually represent the word's meaning
2. Maximum 4 words
3. Single object only
4. Choose most memorable/iconic association
5. If describing people, use light-skinned or yellow emoji-style characters
6. FORBIDDEN: "vibrant", "representing", "showing", generic descriptions

Think: What visual helps remember this word?

Examples:
"autumn" → "orange fall leaf" (NOT green leaf)
"winter" → "snowflake" (NOT generic season)
"happy" → "smiling face"
"article" → "newspaper"
"above" → "upward arrow"
"actor" → "light-skinned man in suit"
`;

// This interface matches the structure of items in GeneratePromptsBatchPayload entries from lib/apiClient.ts
export interface BatchPromptEntry {
  id: number;
  english: string;
  russian: string;
  transcription: string;
}

// Function to format batch prompt messages for OpenRouter
export function formatOpenRouterBatchPromptMessages(entries: BatchPromptEntry[]): OpenRouterMessage[] {
  const wordPairs = entries
    .map(
      (entry) =>
        `ID: ${entry.id}\nEnglish: ${entry.english} ${entry.transcription}\nRussian: ${entry.russian}`
    )
    .join('\n\n');

  const systemMessage = `You are an AI assistant. For each word pair, generate a concise visual prompt for an emoji-style image.
Return your response as a JSON array where each object has an "id" field matching the input id and a "prompt" field with the single object description.
Output only valid JSON, no markdown formatting. The "prompt" should adhere to the rules provided in the user message.
Example format: [{"id": 1, "prompt": "orange fall leaf"}, {"id": 2, "prompt": "snowflake"}]`;

  const userMessageContent = `${BATCH_PROMPT_GENERATION_INSTRUCTIONS}

Word pairs:
${wordPairs}

Return valid JSON only, no markdown formatting.`;

  return [
    { role: 'system', content: systemMessage },
    { role: 'user', content: userMessageContent },
  ];
}

export function handleOpenRouterError(error: unknown) {
  return handleAiServiceError(error, AI_SERVICE_CONFIGS.openrouter);
}