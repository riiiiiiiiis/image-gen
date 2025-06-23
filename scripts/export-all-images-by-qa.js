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

const OUTPUT_DIR = path.join(__dirname, '..', 'images-export-by-qa');

function createDirectories() {
  // Create main output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Create subdirectories for each qa_score
  const subdirs = ['good', 'bad', 'unrated'];
  subdirs.forEach(subdir => {
    const dirPath = path.join(OUTPUT_DIR, subdir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
}

function getQAFolder(qa_score) {
  if (qa_score === 'good') return 'good';
  if (qa_score === 'bad') return 'bad';
  return 'unrated'; // null or undefined qa_score
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    // Skip if file already exists
    if (fs.existsSync(filepath)) {
      resolve({ skipped: true });
      return;
    }
    
    const client = url.startsWith('https:') ? https : http;
    
    const request = client.get(url, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(filepath);
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          resolve({ skipped: false });
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
  let skippedCount = 0;
  
  async function downloadNext() {
    if (index >= downloadTasks.length) return;
    
    const currentIndex = index++;
    const task = downloadTasks[currentIndex];
    
    try {
      const result = await downloadImage(task.url, task.filepath);
      if (result.skipped) {
        skippedCount++;
        console.log(`⏭️  Skipped ${currentIndex + 1}/${downloadTasks.length}: ${task.filename} (already exists)`);
      } else {
        console.log(`✅ Downloaded ${currentIndex + 1}/${downloadTasks.length}: ${task.filename} → ${task.folder}/`);
      }
      results.push({ success: true, task, skipped: result.skipped });
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
  return { results, skippedCount };
}

async function main() {
  console.log('🚀 Starting export of all images organized by QA score...');
  
  // Create output directories
  createDirectories();
  console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  console.log('📂 Subdirectories: good/, bad/, unrated/');
  
  // Query database for all images
  console.log('🔍 Querying database for all images...');
  const { data: entries, error } = await supabase
    .from('word_entries')
    .select('id, original_text, translation_text, image_url, qa_score')
    .not('image_url', 'is', null)
    .limit(5000);
  
  if (error) {
    console.error('❌ Database query failed:', error);
    process.exit(1);
  }
  
  if (!entries || entries.length === 0) {
    console.log('ℹ️ No images found in database');
    return;
  }
  
  console.log(`📊 Found ${entries.length} total images to export`);
  
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
    const folder = getQAFolder(entry.qa_score);
    const filename = `${entry.id}.png`;
    const filepath = path.join(OUTPUT_DIR, folder, filename);
    
    return {
      id: entry.id,
      url: entry.image_url,
      filename,
      filepath,
      folder,
      original: entry.original_text,
      translation: entry.translation_text,
      qa_score: entry.qa_score
    };
  });
  
  // Start downloads
  console.log('⬇️ Starting downloads (5 concurrent)...');
  const { results, skippedCount } = await downloadWithConcurrency(downloadTasks, 5);
  
  // Summary
  const successful = results.filter(r => r.success && !r.skipped).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log('\n📈 Export Summary:');
  console.log(`✅ Successful downloads: ${successful}`);
  console.log(`⏭️  Skipped (already exist): ${skippedCount}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📁 Images saved to: ${OUTPUT_DIR}`);
  console.log('   └── good/    (good quality images)');
  console.log('   └── bad/     (bad quality images)');
  console.log('   └── unrated/ (unrated images)');
  
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