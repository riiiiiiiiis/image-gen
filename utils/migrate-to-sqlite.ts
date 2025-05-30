#!/usr/bin/env node

/**
 * Migration utility to transfer data from localStorage to SQLite database
 * Run this script to migrate existing data: npx tsx utils/migrate-to-sqlite.ts
 */

import { languageCardRepository } from '../lib/db/repository';
import { WordEntry } from '../types';
import fs from 'fs';
import path from 'path';

// Mock localStorage for Node.js environment
const STORAGE_FILE = path.join(process.cwd(), '.localStorage-backup.json');

interface LocalStorageData {
  state: {
    entries: WordEntry[];
  };
}

async function loadFromLocalStorage(): Promise<WordEntry[]> {
  console.log('🔍 Looking for localStorage data...');
  
  // In a real browser environment, this would read from actual localStorage
  // For the migration script, we'll need to export the data first
  console.log(`
To migrate your data:

1. Open your application in the browser
2. Open the browser console (F12)
3. Run this command to export your data:

const data = localStorage.getItem('language-card-storage');
if (data) {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'language-cards-export.json';
  a.click();
  URL.revokeObjectURL(url);
  console.log('Data exported! Check your downloads folder.');
} else {
  console.log('No data found in localStorage');
}

4. Place the downloaded 'language-cards-export.json' file in the project root
5. Run this migration script again
  `);
  
  // Check if export file exists
  const exportFile = path.join(process.cwd(), 'language-cards-export.json');
  if (fs.existsSync(exportFile)) {
    console.log('✅ Found export file: language-cards-export.json');
    const data = JSON.parse(fs.readFileSync(exportFile, 'utf-8'));
    
    // Parse the localStorage format
    const parsedData: LocalStorageData = JSON.parse(data);
    
    if (parsedData.state && Array.isArray(parsedData.state.entries)) {
      return parsedData.state.entries;
    }
  }
  
  return [];
}

async function migrateToSQLite() {
  try {
    console.log('🚀 Starting migration from localStorage to SQLite...\n');
    
    // Load data from localStorage export
    const entries = await loadFromLocalStorage();
    
    if (entries.length === 0) {
      console.log('❌ No data found to migrate.');
      return;
    }
    
    console.log(`📊 Found ${entries.length} entries to migrate\n`);
    
    // Check if database already has data
    const existingEntries = await languageCardRepository.findAll();
    if (existingEntries.length > 0) {
      console.log(`⚠️  Database already contains ${existingEntries.length} entries.`);
      console.log('Do you want to continue? This will merge the data.');
      // In a real scenario, you'd want to prompt for confirmation
    }
    
    // Migrate entries in batches
    const BATCH_SIZE = 100;
    let migrated = 0;
    
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      
      try {
        await languageCardRepository.bulkUpsert(batch);
        migrated += batch.length;
        
        const progress = Math.round((migrated / entries.length) * 100);
        console.log(`Progress: ${progress}% (${migrated}/${entries.length} entries)`);
      } catch (error) {
        console.error(`❌ Error migrating batch ${i / BATCH_SIZE + 1}:`, error);
      }
    }
    
    console.log(`\n✅ Migration completed! ${migrated} entries migrated to SQLite.`);
    
    // Verify migration
    const dbEntries = await languageCardRepository.findAll();
    console.log(`📊 Database now contains ${dbEntries.length} total entries.`);
    
    // Create backup of localStorage data
    const backupFile = path.join(process.cwd(), `localStorage-backup-${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify({ entries }, null, 2));
    console.log(`💾 Backup saved to: ${backupFile}`);
    
    console.log('\n🎉 Migration successful! You can now use the application with SQLite database.');
    console.log('The localStorage data will remain as fallback until you clear it manually.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateToSQLite().catch(console.error);