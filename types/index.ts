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