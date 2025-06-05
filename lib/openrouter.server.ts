// Server-only OpenRouter integration
// This file should never be imported client-side

import { handleAiServiceError, AI_SERVICE_CONFIGS } from './aiUtils';

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
  // Read the API key directly from process.env here
  const apiKeyFromEnv = process.env.OPENROUTER_API_KEY;

  // Comprehensive check and logging for the API key
  if (!apiKeyFromEnv || typeof apiKeyFromEnv !== 'string' || apiKeyFromEnv.trim() === '') {
    const errorMsg = "OpenRouter API Key (OPENROUTER_API_KEY) is missing, empty, or not a string in environment variables. Please ensure it's correctly set in your .env.local file (and that the server was restarted) or in your deployment environment settings.";
    console.error(`CRITICAL_ERROR: callOpenRouter - ${errorMsg}`);
    // Log the actual value (or lack thereof) for debugging, being mindful of security in production logs if they are public.
    // For local development, this is very helpful.
    if (process.env.NODE_ENV === 'development') {
      console.error(`DEBUG: callOpenRouter - Value of process.env.OPENROUTER_API_KEY was: '${apiKeyFromEnv}' (type: ${typeof apiKeyFromEnv})`);
    }
    throw new Error(errorMsg);
  }
  
  // Log a masked version of the key being used in development for verification
  if (process.env.NODE_ENV === 'development') {
    const keyPreview = `${apiKeyFromEnv.substring(0, 5)}...${apiKeyFromEnv.substring(apiKeyFromEnv.length - 5)}`;
    console.log(
      `DEBUG: callOpenRouter - Using API Key (length: ${apiKeyFromEnv.length}): ${keyPreview} for OpenRouter request.`
    );
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKeyFromEnv}`, // Use the key directly from environment
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/sdxl-emoji-pipeline', // Consider making this configurable or your actual app URL
      'X-Title': 'SDXL Emoji Pipeline' // Consider making this configurable
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
    let errorResponseMessage = `OpenRouter API request failed: ${response.status} ${response.statusText}`;
    let responseBodyText = await response.text(); // Get raw text first
    
    console.error(`ERROR: callOpenRouter - OpenRouter API error (${response.status}). Response text: ${responseBodyText}`);

    try {
      const errorData = JSON.parse(responseBodyText); // Try to parse as JSON
      if (errorData && errorData.error && errorData.error.message) {
        errorResponseMessage = `OpenRouter API Error (${response.status}): ${errorData.error.message}`;
      } else if (errorData && errorData.message) {
        errorResponseMessage = `OpenRouter API Message (${response.status}): ${errorData.message}`;
      }
    } catch (e) {
      // Parsing failed, use the raw text if it's short, or a generic message
      if (responseBodyText.length < 200) {
        errorResponseMessage += `. Raw response: ${responseBodyText}`;
      }
      console.error("ERROR: callOpenRouter - Failed to parse JSON error response from OpenRouter. Raw text was logged above.");
    }
    
    if (response.status === 401) {
       errorResponseMessage = `OpenRouter Authentication Failed (401). This usually means the API Key is incorrect, invalid, or lacks permissions. Please verify OPENROUTER_API_KEY in your environment settings. Ensure no extra characters (spaces, semicolons) are present IN THE ENVIRONMENT VARIABLE VALUE ITSELF. Details: ${errorResponseMessage}`;
    }

    throw new Error(errorResponseMessage);
  }

  // If response.ok, try to parse JSON, but handle potential non-JSON success responses if any
  const responseText = await response.text();
  try {
    const data = JSON.parse(responseText);
    if (data.choices && data.choices[0] && data.choices[0].message && typeof data.choices[0].message.content === 'string') {
      return data.choices[0].message.content;
    } else {
      console.error("ERROR: callOpenRouter - OpenRouter success response has unexpected structure:", responseText);
      throw new Error("OpenRouter returned a success status but the response structure was unexpected.");
    }
  } catch (parseError) {
      console.error("ERROR: callOpenRouter - Failed to parse JSON success response from OpenRouter:", responseText, parseError);
      throw new Error("OpenRouter returned a success status but the response was not valid JSON.");
  }
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