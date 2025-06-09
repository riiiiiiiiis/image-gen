import { WordEntry, CategorizationResult } from '@/types';

// Generic API response type
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

// Request payload types
export interface GeneratePromptPayload {
  entryId: number;
  english: string;
  russian: string;
  transcription: string;
}

export interface QueueImagePayload {
  action: 'add';
  entryId: number;
  englishWord: string;
  prompt: string;
}

export interface GeneratePromptsBatchPayload {
  entries: Array<{
    id: number;
    english: string;
    russian: string;
    transcription: string;
  }>;
}

export interface CategorizeVocabularyPayload {
  entries: Array<{
    id: number;
    original_text: string;
    translation_text: string;
    level_id: number;
  }>;
}

export interface RegenerateImagePayload {
  entryId: number;
  prompt: string;
}

export interface LanguageCardsPayload {
  word: string;
}

export interface BatchGenerateImagesPayload {
  entries: Array<{
    entryId: number;
    prompt: string;
    englishWord: string;
  }>;
}

// Response types
export interface GeneratePromptResponse {
  prompt: string;
}

export interface QueueImageResponse {
  status: string;
  imageUrl?: string;
  generatedAt?: string;
}

export interface GeneratePromptsBatchResponse {
  prompts: Array<{
    id: number;
    prompt: string;
  }>;
}

export interface CategorizeVocabularyResponse {
  results: Array<{
    id: number;
    categorization: CategorizationResult;
  }>;
  errors: Array<{
    id: number;
    error: string;
  }>;
}

export interface RegenerateImageResponse {
  success: boolean;
  imageUrl?: string;
  generatedAt?: string;
  error?: string;
}

export interface LanguageCardsResponse {
  cards: WordEntry[];
  totalWords: number;
}

export interface BatchGenerateImagesResponse {
  success: boolean;
  message: string;
  queuedCount: number;
  errorCount: number;
  errors?: Array<{
    entryId: number;
    error: string;
  }>;
}

// Generic API call utility
async function apiCall<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
  } = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body } = options;

  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    const status = response.status;

    if (!response.ok) {
      // Try to parse error message from response
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        error: errorData.error || `HTTP ${status}`,
        status,
      };
    }

    const data = await response.json();
    return {
      data,
      status,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Network error',
      status: 0,
    };
  }
}

// Service functions
export async function generatePromptService(
  payload: GeneratePromptPayload
): Promise<ApiResponse<GeneratePromptResponse>> {
  return apiCall<GeneratePromptResponse>('/api/generate-prompt', {
    method: 'POST',
    body: payload,
  });
}

export async function queueImageService(
  payload: QueueImagePayload
): Promise<ApiResponse<QueueImageResponse>> {
  return apiCall<QueueImageResponse>('/api/queue-image', {
    method: 'POST',
    body: payload,
  });
}

export async function generatePromptsBatchService(
  payload: GeneratePromptsBatchPayload
): Promise<ApiResponse<GeneratePromptsBatchResponse>> {
  return apiCall<GeneratePromptsBatchResponse>('/api/generate-prompts-batch', {
    method: 'POST',
    body: payload,
  });
}

export async function categorizeVocabularyService(
  payload: CategorizeVocabularyPayload
): Promise<ApiResponse<CategorizeVocabularyResponse>> {
  return apiCall<CategorizeVocabularyResponse>('/api/categorize-vocabulary', {
    method: 'POST',
    body: payload,
  });
}

export async function regenerateImageService(
  payload: RegenerateImagePayload
): Promise<ApiResponse<RegenerateImageResponse>> {
  return apiCall<RegenerateImageResponse>('/api/generate-image', {
    method: 'POST',
    body: payload,
  });
}

export async function fetchLanguageCardsService(
  payload: LanguageCardsPayload
): Promise<ApiResponse<LanguageCardsResponse>> {
  return apiCall<LanguageCardsResponse>(`/api/language-cards?word=${encodeURIComponent(payload.word)}`, {
    method: 'GET',
  });
}

export async function batchGenerateImagesService(
  payload: BatchGenerateImagesPayload
): Promise<ApiResponse<BatchGenerateImagesResponse>> {
  return apiCall<BatchGenerateImagesResponse>('/api/generate-images-batch', {
    method: 'POST',
    body: payload,
  });
}