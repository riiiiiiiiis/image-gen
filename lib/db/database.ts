import { createPool } from '@vercel/postgres';
import { Kysely, PostgresDialect } from 'kysely';
import { Database as DatabaseType, DB } from './schema';
// Migration imports removed - will be handled externally for Vercel deployment

let db: DB | null = null;

export function getDatabase(): DB {
  if (!db) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    const pool = createPool({
      connectionString: process.env.DATABASE_URL,
    });
    
    db = new Kysely<DatabaseType>({
      dialect: new PostgresDialect({
        pool,
      }),
    });
    
    // Note: For Vercel deployment, migrations should be run externally
    // using npx kysely migrate or similar command
  }
  
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.destroy();
    db = null;
  }
}