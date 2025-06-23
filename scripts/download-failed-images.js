#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const OUTPUT_DIR = path.join(__dirname, '..', 'good-images-export');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');

// Failed image IDs
const FAILED_IDS = [8846, 8012, 8428, 8020, 8499];

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    const request = client.get(url, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(filepath);
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        
        fileStream.on('error', (err) => {
          fs.unlink(filepath, () => {});
          reject(err);
        });
      } else {
        reject(new Error(`Failed to download image. Status code: ${response.statusCode}`));
      }
    });
    
    request.on('error', (err) => {
      reject(err);
    });
    
    // Increase timeout to 60 seconds for these problematic images
    request.setTimeout(60000, () => {
      request.abort();
      reject(new Error('Download timeout'));
    });
  });
}

async function main() {
  console.log('🚀 Downloading failed images...');
  console.log(`📋 IDs to download: ${FAILED_IDS.join(', ')}`);
  
  // Query database for these specific images
  const { data: entries, error } = await supabase
    .from('word_entries')
    .select('id, original_text, translation_text, image_url')
    .in('id', FAILED_IDS);
  
  if (error) {
    console.error('❌ Database query failed:', error);
    process.exit(1);
  }
  
  if (!entries || entries.length === 0) {
    console.log('ℹ️ No entries found for these IDs');
    return;
  }
  
  console.log(`📊 Found ${entries.length} entries in database`);
  
  // Download each image
  for (const entry of entries) {
    const filename = `${entry.id}.png`;
    const filepath = path.join(IMAGES_DIR, filename);
    
    console.log(`⬇️ Downloading ${filename}...`);
    
    try {
      await downloadImage(entry.image_url, filepath);
      console.log(`✅ Successfully downloaded ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to download ${filename}: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Finished!');
}

main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});