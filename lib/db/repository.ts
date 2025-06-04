import { getDatabase } from './database';
import { WordEntryTable } from './schema';
import { WordEntry } from '@/types';

export class LanguageCardRepository {
  private get db() {
    return getDatabase();
  }

  async create(entry: Omit<WordEntry, 'imageStatus' | 'promptStatus'>): Promise<WordEntry> {
    const result = await this.db
      .insertInto('word_entries')
      .values({
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToWordEntry(result);
  }

  async update(id: number, updates: Partial<WordEntry>): Promise<WordEntry | null> {
    const dbUpdates: Partial<WordEntryTable> = {
      updated_at: new Date().toISOString(),
    };

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
      // Ensure explicit NULL if word_type is undefined or null from sanitized object
      dbUpdates.categorization_transformation_needed = cat.transformation_needed ? 1 : 0;
      dbUpdates.categorization_transformation_suggestion = cat.transformation_suggestion;
      dbUpdates.categorization_confidence = cat.confidence;
    }
    if (updates.categorizationStatus !== undefined) dbUpdates.categorization_status = updates.categorizationStatus;

    const result = await this.db
      .updateTable('word_entries')
      .set(dbUpdates)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    return result ? this.mapToWordEntry(result) : null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .deleteFrom('word_entries')
      .where('id', '=', id)
      .execute();

    return result.length > 0;
  }

  async findById(id: number): Promise<WordEntry | null> {
    const result = await this.db
      .selectFrom('word_entries')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return result ? this.mapToWordEntry(result) : null;
  }

  async findAll(): Promise<WordEntry[]> {
    const results = await this.db
      .selectFrom('word_entries')
      .selectAll()
      .orderBy('id', 'asc')
      .execute();

    return results.map(this.mapToWordEntry);
  }

  async upsert(entry: WordEntry): Promise<WordEntry> {
    const existing = await this.findById(entry.id);
    
    if (existing) {
      return await this.update(entry.id, entry) || existing;
    } else {
      return await this.create(entry);
    }
  }

  async bulkUpsert(entries: WordEntry[]): Promise<WordEntry[]> {
    const results: WordEntry[] = [];
    
    // Use a transaction for better performance
    await this.db.transaction().execute(async (trx) => {
      for (const entry of entries) {
        const existing = await trx
          .selectFrom('word_entries')
          .selectAll()
          .where('id', '=', entry.id)
          .executeTakeFirst();

        let result: WordEntryTable;
        
        if (existing) {
          result = await trx
            .updateTable('word_entries')
            .set({
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
              updated_at: new Date().toISOString(),
            })
            .where('id', '=', entry.id)
            .returningAll()
            .executeTakeFirstOrThrow();
        } else {
          result = await trx
            .insertInto('word_entries')
            .values({
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
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .returningAll()
            .executeTakeFirstOrThrow();
        }
        
        results.push(this.mapToWordEntry(result));
      }
    });
    
    return results;
  }

  private mapToWordEntry(row: WordEntryTable): WordEntry {
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
        transformation_needed: row.categorization_transformation_needed === 1,
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