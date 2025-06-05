import { supabaseAdmin } from '../supabaseAdmin';
import { WordEntry } from '@/types';

export class LanguageCardRepository {

  async create(entry: Omit<WordEntry, 'imageStatus' | 'promptStatus'>): Promise<WordEntry> {
    const dbEntry = {
      id: entry.id,
      original_text: entry.original_text,
      translation_text: entry.translation_text,
      level_id: entry.level_id,
      transcription: entry.transcription,
      prompt: entry.prompt || null,
      image_url: entry.imageUrl || null,
      image_status: 'none',
      prompt_status: 'none',
      categorization_status: 'none',
      replicate_id: entry.replicateId || null,
      qa_score: entry.qaScore || null,
      image_generated_at: entry.imageGeneratedAt || null,
      categorization_primary_category: entry.categorization?.primary_category || null,
      categorization_image_suitability: entry.categorization?.image_suitability || null,
      categorization_word_type: entry.categorization?.word_type || null,
      categorization_transformation_needed: entry.categorization?.transformation_needed || false,
      categorization_transformation_suggestion: entry.categorization?.transformation_suggestion || null,
      categorization_confidence: entry.categorization?.confidence || null,
    };
    
    const { data, error } = await supabaseAdmin
      .from('word_entries')
      .insert(dbEntry)
      .select()
      .single();
      
    if (error) throw error;
    return this.mapToWordEntry(data);
  }

  async update(id: number, updates: Partial<WordEntry>): Promise<WordEntry | null> {
    const dbUpdates: any = {};

    if (updates.original_text !== undefined) dbUpdates.original_text = updates.original_text;
    if (updates.translation_text !== undefined) dbUpdates.translation_text = updates.translation_text;
    if (updates.level_id !== undefined) dbUpdates.level_id = updates.level_id;
    if (updates.transcription !== undefined) dbUpdates.transcription = updates.transcription;
    if (updates.prompt !== undefined) dbUpdates.prompt = updates.prompt || null;
    if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl || null;
    if (updates.imageStatus !== undefined) dbUpdates.image_status = updates.imageStatus;
    if (updates.promptStatus !== undefined) dbUpdates.prompt_status = updates.promptStatus;
    if (updates.replicateId !== undefined) dbUpdates.replicate_id = updates.replicateId || null;
    if (updates.qaScore !== undefined) dbUpdates.qa_score = updates.qaScore || null;
    if (updates.imageGeneratedAt !== undefined) dbUpdates.image_generated_at = updates.imageGeneratedAt || null;
    
    // Handle categorization updates
    if (updates.categorization !== undefined) {
      const cat = updates.categorization;
      dbUpdates.categorization_primary_category = cat.primary_category;
      dbUpdates.categorization_image_suitability = cat.image_suitability;
      dbUpdates.categorization_word_type = (cat.word_type === undefined || cat.word_type === null) ? null : cat.word_type;
      dbUpdates.categorization_transformation_needed = cat.transformation_needed;
      dbUpdates.categorization_transformation_suggestion = cat.transformation_suggestion;
      dbUpdates.categorization_confidence = cat.confidence;
    }
    if (updates.categorizationStatus !== undefined) dbUpdates.categorization_status = updates.categorizationStatus;

    const { data, error } = await supabaseAdmin
      .from('word_entries')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw error;
    }
    
    return data ? this.mapToWordEntry(data) : null;
  }

  async delete(id: number): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('word_entries')
      .delete()
      .eq('id', id);
      
    return !error;
  }

  async findById(id: number): Promise<WordEntry | null> {
    const { data, error } = await supabaseAdmin
      .from('word_entries')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw error;
    }
    
    return this.mapToWordEntry(data);
  }

  async findAll(): Promise<WordEntry[]> {
    const { data, error } = await supabaseAdmin
      .from('word_entries')
      .select('*')
      .order('id', { ascending: true });
      
    if (error) throw error;
    
    return data.map(row => this.mapToWordEntry(row));
  }

  async upsert(entry: WordEntry): Promise<WordEntry> {
    const dbEntry = {
      id: entry.id,
      original_text: entry.original_text,
      translation_text: entry.translation_text,
      level_id: entry.level_id,
      transcription: entry.transcription,
      prompt: entry.prompt || null,
      image_url: entry.imageUrl || null,
      image_status: entry.imageStatus,
      prompt_status: entry.promptStatus,
      categorization_status: entry.categorizationStatus || 'none',
      replicate_id: entry.replicateId || null,
      qa_score: entry.qaScore || null,
      image_generated_at: entry.imageGeneratedAt || null,
      categorization_primary_category: entry.categorization?.primary_category || null,
      categorization_image_suitability: entry.categorization?.image_suitability || null,
      categorization_word_type: entry.categorization?.word_type || null,
      categorization_transformation_needed: entry.categorization?.transformation_needed || false,
      categorization_transformation_suggestion: entry.categorization?.transformation_suggestion || null,
      categorization_confidence: entry.categorization?.confidence || null,
    };
    
    const { data, error } = await supabaseAdmin
      .from('word_entries')
      .upsert(dbEntry, { onConflict: 'id' })
      .select()
      .single();
      
    if (error) throw error;
    return this.mapToWordEntry(data);
  }

  async bulkUpsert(entries: WordEntry[]): Promise<WordEntry[]> {
    const dbEntries = entries.map(entry => ({
      id: entry.id,
      original_text: entry.original_text,
      translation_text: entry.translation_text,
      level_id: entry.level_id,
      transcription: entry.transcription,
      prompt: entry.prompt || null,
      image_url: entry.imageUrl || null,
      image_status: entry.imageStatus,
      prompt_status: entry.promptStatus,
      categorization_status: entry.categorizationStatus || 'none',
      replicate_id: entry.replicateId || null,
      qa_score: entry.qaScore || null,
      image_generated_at: entry.imageGeneratedAt || null,
      categorization_primary_category: entry.categorization?.primary_category || null,
      categorization_image_suitability: entry.categorization?.image_suitability || null,
      categorization_word_type: entry.categorization?.word_type || null,
      categorization_transformation_needed: entry.categorization?.transformation_needed || false,
      categorization_transformation_suggestion: entry.categorization?.transformation_suggestion || null,
      categorization_confidence: entry.categorization?.confidence || null,
    }));
    
    const { data, error } = await supabaseAdmin
      .from('word_entries')
      .upsert(dbEntries, { onConflict: 'id' })
      .select();
      
    if (error) throw error;
    
    return data.map(row => this.mapToWordEntry(row));
  }

  private mapToWordEntry(row: any): WordEntry {
    const entry: WordEntry = {
      id: row.id,
      original_text: row.original_text,
      translation_text: row.translation_text,
      level_id: row.level_id,
      transcription: row.transcription,
      prompt: row.prompt || undefined,
      imageUrl: row.image_url || undefined,
      imageStatus: row.image_status,
      promptStatus: row.prompt_status,
      replicateId: row.replicate_id || undefined,
      qaScore: row.qa_score,
      imageGeneratedAt: row.image_generated_at || undefined,
    };
    
    // Map categorization if present
    if (row.categorization_primary_category) {
      entry.categorization = {
        primary_category: row.categorization_primary_category,
        image_suitability: row.categorization_image_suitability!,
        word_type: row.categorization_word_type,
        transformation_needed: row.categorization_transformation_needed === true,
        transformation_suggestion: row.categorization_transformation_suggestion || '',
        confidence: row.categorization_confidence || 0,
      };
    }
    
    entry.categorizationStatus = row.categorization_status || 'none';
    
    return entry;
  }
}

// Export singleton instance
export const languageCardRepository = new LanguageCardRepository();