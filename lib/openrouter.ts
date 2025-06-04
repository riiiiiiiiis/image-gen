// Shared types and interfaces for OpenRouter
// This file can be imported by both client and server

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface BatchPromptEntry {
  id: number;
  english: string;
  russian: string;
  transcription: string;
}

// Re-export server-only functions for backward compatibility
// These will throw errors if imported client-side
export { 
  callOpenRouter,
  handleOpenRouterError,
  formatOpenRouterBatchPromptMessages,
  OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL,
  OPENROUTER_MODEL,
  BATCH_PROMPT_GENERATION_INSTRUCTIONS
} from './openrouter.server';