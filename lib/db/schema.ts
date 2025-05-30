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
  created_at: string;
  updated_at: string;
}

export interface Database {
  word_entries: WordEntryTable;
}

export type DB = Kysely<Database>;