import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Database as DatabaseType, DB } from './schema';
import { createTables } from './migrations';
import { runMigrations } from './runMigrations';
import { DATABASE_FILE_PATH } from '../paths';

let db: DB | null = null;

export function getDatabase(): DB {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || DATABASE_FILE_PATH;
    
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    
    db = new Kysely<DatabaseType>({
      dialect: new SqliteDialect({
        database: sqlite,
      }),
    });
    
    // Initialize tables if they don't exist
    createTables(db);
    
    // Run migrations
    runMigrations();
  }
  
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.destroy();
    db = null;
  }
}