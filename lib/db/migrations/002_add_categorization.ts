import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>) {
  // Add categorization columns to word_entries table
  await db.schema
    .alterTable('word_entries')
    .addColumn('categorization_primary_category', 'text', (col) =>
      col.check(sql`categorization_primary_category IN ('CONCRETE-VISUAL', 'ABSTRACT-SYMBOLIC', 'ACTION-VISUAL', 'STATE-METAPHORICAL') OR categorization_primary_category IS NULL`)
    )
    .addColumn('categorization_image_suitability', 'text', (col) =>
      col.check(sql`categorization_image_suitability IN ('HIGH', 'MEDIUM', 'LOW') OR categorization_image_suitability IS NULL`)
    )
    .addColumn('categorization_word_type', 'text', (col) =>
      col.check(sql`categorization_word_type IN ('noun', 'verb', 'adjective', 'adverb', 'phrase') OR categorization_word_type IS NULL`)
    )
    .addColumn('categorization_transformation_needed', 'integer') // SQLite boolean
    .addColumn('categorization_transformation_suggestion', 'text')
    .addColumn('categorization_confidence', 'real')
    .addColumn('categorization_status', 'text', (col) =>
      col.notNull().defaultTo('none')
        .check(sql`categorization_status IN ('none', 'processing', 'completed', 'error')`)
    )
    .execute();

  // Create index for categorization status
  await db.schema
    .createIndex('idx_word_entries_categorization_status')
    .on('word_entries')
    .column('categorization_status')
    .execute();
}

export async function down(db: Kysely<any>) {
  // Drop the index
  await db.schema
    .dropIndex('idx_word_entries_categorization_status')
    .execute();

  // SQLite doesn't support dropping columns, would need to recreate table
  // For development, it's easier to just reset the database if needed
}