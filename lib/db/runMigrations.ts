import { getDatabase } from './database';
import { sql } from 'kysely';
import { up as addCategorizationMigration } from './migrations/002_add_categorization';

export async function runMigrations() {
  const db = getDatabase();
  
  try {
    // Check if categorization columns exist
    const columns = await sql<{ name: string }>`
      PRAGMA table_info(word_entries)
    `.execute(db);
    
    const hasCategorizationColumns = columns.rows.some(
      col => col.name.startsWith('categorization_')
    );
    
    if (!hasCategorizationColumns) {
      console.log('Running categorization migration...');
      await addCategorizationMigration(db);
      console.log('Categorization migration completed.');
    }
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}