export interface CategorizationResult {
  primary_category: 'CONCRETE-VISUAL' | 'ABSTRACT-SYMBOLIC' | 'ACTION-VISUAL' | 'STATE-METAPHORICAL';
  image_suitability: 'HIGH' | 'MEDIUM' | 'LOW';
  word_type: 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase';
  transformation_needed: boolean;
  transformation_suggestion: string;
  confidence: number;
}

export interface WordEntry {
  id: number;
  original_text: string;
  translation_text: string;
  level_id: number;
  transcription: string;
  prompt?: string;
  imageUrl?: string;
  imageStatus: 'none' | 'queued' | 'processing' | 'completed' | 'error';
  promptStatus: 'none' | 'generating' | 'completed' | 'error';
  replicateId?: string;
  qaScore?: 'good' | 'bad' | null;
  imageGeneratedAt?: string; // ISO timestamp when image was generated
  categorization?: CategorizationResult;
  categorizationStatus?: 'none' | 'processing' | 'completed' | 'error';
}

export interface AppState {
  entries: WordEntry[];
  currentPage: number;
  itemsPerPage: number;
  searchQuery: string;
  levelFilter: number | null;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  activeTab: 'table' | 'gallery';
}

export interface JSONImportData {
  id: number;
  original_text: string;
  translation_text: string;
  level_id: number;
  transcription: string;
}