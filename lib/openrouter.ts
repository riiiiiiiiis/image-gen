export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-preview-05-20';

interface OpenRouterMessage {
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
): Promise<any> {
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

export function handleOpenRouterError(error: any) {
  console.error('OpenRouter API Error:', error);
  
  if (error.message?.includes('Invalid API key') || error.message?.includes('Unauthorized')) {
    return {
      message: 'Invalid API key. Please check your OPENROUTER_API_KEY.',
      status: 401
    };
  }
  
  if (error.message?.includes('Rate limit')) {
    return {
      message: 'Rate limit exceeded. Please try again later.',
      status: 429
    };
  }
  
  if (error.message?.includes('Model not found')) {
    return {
      message: 'Model not available. Please check the model name.',
      status: 404
    };
  }
  
  return {
    message: error.message || 'Failed to call OpenRouter API',
    status: 500
  };
}