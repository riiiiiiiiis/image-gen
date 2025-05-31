import { Kysely } from 'kysely';

export interface WordEntryTable {
  id: number;
  original_text: string;
  translation_text: string;
  level_id: number;
  transcription: string;
  prompt: string | null;
  image_url: string | null;
  image_status: 'none' | 'queued' | 'processing' | 'completed' | 'error';
  prompt_status: 'none' | 'generating' | 'completed' | 'error';
  replicate_id: string | null;
  qa_score: 'good' | 'bad' | null;
  image_generated_at: string | null;
  categorization_primary_category: 'CONCRETE-VISUAL' | 'ABSTRACT-SYMBOLIC' | 'ACTION-VISUAL' | 'STATE-METAPHORICAL' | null;
  categorization_image_suitability: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  categorization_word_type: 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase' | null;
  categorization_transformation_needed: boolean | null;
  categorization_transformation_suggestion: string | null;
  categorization_confidence: number | null;
  categorization_status: 'none' | 'processing' | 'completed' | 'error';
  created_at: string;
  updated_at: string;
}

export interface Database {
  word_entries: WordEntryTable;
}

export type DB = Kysely<Database>;