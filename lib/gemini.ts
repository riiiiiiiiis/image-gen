import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20';

export const CORE_PROMPT_INSTRUCTIONS = `Generate ONE emoji object for: {english_word}

Rules:
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

Word: {english_word}
Single object:`;

export const PROMPT_TEMPLATE = `${CORE_PROMPT_INSTRUCTIONS}

English: {english} {transcription}
Russian: {russian}`;

export const BATCH_PROMPT_TEMPLATE = `For each word below, generate ONE emoji object following these rules:

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

Return your response as a JSON array where each object has an "id" field matching the input id and a "prompt" field with the single object description.

Word pairs:
{wordPairs}

Return valid JSON only, no markdown formatting.`;

export function getGeminiModel() {
  return genAI.getGenerativeModel({ model: GEMINI_MODEL });
}

export function formatSinglePrompt(english: string, russian: string, transcription: string): string {
  return PROMPT_TEMPLATE
    .replace('{english_word}', english)
    .replace('{english}', english)
    .replace('{transcription}', transcription)
    .replace('{russian}', russian);
}

export function formatBatchPrompt(entries: Array<{ id: number; english: string; russian: string; transcription: string }>): string {
  const wordPairs = entries.map(entry => 
    `ID: ${entry.id}\nEnglish: ${entry.english} ${entry.transcription}\nRussian: ${entry.russian}`
  ).join('\n\n');
  
  return BATCH_PROMPT_TEMPLATE.replace('{wordPairs}', wordPairs);
}

export function handleGeminiError(error: any) {
  console.error('Gemini API Error:', error);
  
  if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('Invalid API key')) {
    return {
      message: 'Invalid API key. Please check your GEMINI_API_KEY in .env.local',
      status: 401
    };
  }
  
  if (error.message?.includes('not found') || error.message?.includes('404')) {
    return {
      message: 'Gemini model not available. Please check the model name.',
      status: 404
    };
  }
  
  if (error.message?.includes('RATE_LIMIT_EXCEEDED') || error.message?.includes('quota')) {
    return {
      message: 'Rate limit exceeded. Please try again later.',
      status: 429
    };
  }
  
  return {
    message: error.message || 'Failed to generate content',
    status: 500
  };
}