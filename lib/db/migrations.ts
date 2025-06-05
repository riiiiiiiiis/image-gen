import { Kysely, sql } from 'kysely';
import { Database } from './schema';

export async function createTables(db: Kysely<Database>) {
  // Check if tables already exist
  const tables = await sql<{ name: string }>`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='word_entries'
  `.execute(db);
  
  if (tables.rows.length > 0) {
    return; // Tables already exist
  }
  
  // Create word_entries table
  await db.schema
    .createTable('word_entries')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .addColumn('original_text', 'text', (col) => col.notNull())
    .addColumn('translation_text', 'text', (col) => col.notNull())
    .addColumn('level_id', 'integer', (col) => col.notNull())
    .addColumn('transcription', 'text', (col) => col.notNull())
    .addColumn('prompt', 'text')
    .addColumn('image_url', 'text')
    .addColumn('image_status', 'text', (col) => 
      col.notNull().defaultTo('none')
        .check(sql`image_status IN ('none', 'queued', 'processing', 'completed', 'error')`)
    )
    .addColumn('prompt_status', 'text', (col) => 
      col.notNull().defaultTo('none')
        .check(sql`prompt_status IN ('none', 'generating', 'completed', 'error')`)
    )
    .addColumn('replicate_id', 'text')
    .addColumn('qa_score', 'text', (col) =>
      col.check(sql`qa_score IN ('good', 'bad') OR qa_score IS NULL`)
    )
    .addColumn('image_generated_at', 'text')
    .addColumn('created_at', 'text', (col) => 
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn('updated_at', 'text', (col) => 
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();
  
  // Create indexes for performance
  await db.schema
    .createIndex('idx_word_entries_level_id')
    .on('word_entries')
    .column('level_id')
    .execute();
  
  await db.schema
    .createIndex('idx_word_entries_image_status')
    .on('word_entries')
    .column('image_status')
    .execute();
  
  await db.schema
    .createIndex('idx_word_entries_prompt_status')
    .on('word_entries')
    .column('prompt_status')
    .execute();
}