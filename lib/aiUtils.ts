export interface AiErrorDetail {
  message: string;
  status: number;
}

export interface AiServiceErrorConfig {
  serviceName: string;
  apiKeyEnvVar: string;
  apiKeyErrorSubstrings: string[];
  rateLimitErrorSubstrings: string[];
  modelNotFoundErrorSubstrings: string[];
}

// Predefined configurations for common AI services
export const AI_SERVICE_CONFIGS = {
  gemini: {
    serviceName: 'Gemini',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    apiKeyErrorSubstrings: ['API_KEY_INVALID', 'Invalid API key'],
    rateLimitErrorSubstrings: ['RATE_LIMIT_EXCEEDED', 'quota'],
    modelNotFoundErrorSubstrings: ['not found', '404']
  },
  openrouter: {
    serviceName: 'OpenRouter',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    apiKeyErrorSubstrings: ['Invalid API key', 'Unauthorized'],
    rateLimitErrorSubstrings: ['Rate limit'],
    modelNotFoundErrorSubstrings: ['Model not found']
  }
} as const;

export function handleAiServiceError(
  error: unknown,
  config: AiServiceErrorConfig
): AiErrorDetail {
  console.error(`${config.serviceName} API Error:`, error);
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Check for API key errors
  if (config.apiKeyErrorSubstrings.some(substring => errorMessage.includes(substring))) {
    return {
      message: `Invalid API key. Please check your ${config.apiKeyEnvVar} in .env.local`,
      status: 401
    };
  }
  
  // Check for rate limit errors
  if (config.rateLimitErrorSubstrings.some(substring => errorMessage.includes(substring))) {
    return {
      message: `Rate limit exceeded for ${config.serviceName}. Please try again later.`,
      status: 429
    };
  }
  
  // Check for model not found errors
  if (config.modelNotFoundErrorSubstrings.some(substring => errorMessage.includes(substring))) {
    return {
      message: `${config.serviceName} model not available. Please check the model configuration.`,
      status: 404
    };
  }
  
  // Default error
  return {
    message: errorMessage || `Failed to call ${config.serviceName} API.`,
    status: 500
  };
}