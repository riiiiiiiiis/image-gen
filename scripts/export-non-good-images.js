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
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const OUTPUT_DIR = path.join(__dirname, '..', 'non-good-images-export');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');

function createDirectories() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
}

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
          fs.unlink(filepath, () => {}); // Delete the file on error
          reject(err);
        });
      } else {
        reject(new Error(`Failed to download image. Status code: ${response.statusCode}`));
      }
    });
    
    request.on('error', (err) => {
      reject(err);
    });
    
    request.setTimeout(30000, () => {
      request.abort();
      reject(new Error('Download timeout'));
    });
  });
}


async function downloadWithConcurrency(downloadTasks, concurrency = 5) {
  const results = [];
  let index = 0;
  
  async function downloadNext() {
    if (index >= downloadTasks.length) return;
    
    const currentIndex = index++;
    const task = downloadTasks[currentIndex];
    
    try {
      await downloadImage(task.url, task.filepath);
      console.log(`✅ Downloaded ${currentIndex + 1}/${downloadTasks.length}: ${task.filename} (${task.qa_score || 'unrated'})`);
      results.push({ success: true, task });
    } catch (error) {
      console.error(`❌ Failed ${currentIndex + 1}/${downloadTasks.length}: ${task.filename} - ${error.message}`);
      results.push({ success: false, task, error });
    }
    
    // Download next task
    await downloadNext();
  }
  
  // Start concurrent downloads
  const workers = Array(Math.min(concurrency, downloadTasks.length))
    .fill()
    .map(() => downloadNext());
  
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log('🚀 Starting export of non-good images...');
  
  // Create output directories
  createDirectories();
  console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  
  // Query database for non-good images (including unrated)
  console.log('🔍 Querying database for non-good images (including unrated)...');
  const { data: entries, error } = await supabase
    .from('word_entries')
    .select('id, original_text, translation_text, image_url, qa_score')
    .or('qa_score.neq.good,qa_score.is.null')
    .not('image_url', 'is', null)
    .limit(5000);
  
  if (error) {
    console.error('❌ Database query failed:', error);
    process.exit(1);
  }
  
  if (!entries || entries.length === 0) {
    console.log('ℹ️ No non-good images found in database');
    return;
  }
  
  console.log(`📊 Found ${entries.length} non-good images to export`);
  
  // Count by qa_score
  const scoreCounts = entries.reduce((acc, entry) => {
    const score = entry.qa_score || 'unrated';
    acc[score] = (acc[score] || 0) + 1;
    return acc;
  }, {});
  
  console.log('📈 Breakdown by qa_score:');
  Object.entries(scoreCounts).forEach(([score, count]) => {
    console.log(`   ${score}: ${count}`);
  });
  
  // Prepare download tasks
  const downloadTasks = entries.map((entry) => {
    const filename = `${entry.id}.png`;
    const filepath = path.join(IMAGES_DIR, filename);
    
    return {
      id: entry.id,
      url: entry.image_url,
      filename,
      filepath,
      original: entry.original_text,
      translation: entry.translation_text,
      qa_score: entry.qa_score
    };
  });
  
  // Start downloads
  console.log('⬇️ Starting downloads (5 concurrent)...');
  const results = await downloadWithConcurrency(downloadTasks, 5);
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log('\n📈 Export Summary:');
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📁 Images saved to: ${IMAGES_DIR}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed downloads:');
    results
      .filter(r => !r.success)
      .forEach(r => console.log(`   ${r.task.filename}: ${r.error.message}`));
  }
  
  console.log('\n🎉 Export completed!');
}

main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});