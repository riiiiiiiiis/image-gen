import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { handleApiRequest } from '@/lib/apiUtils';
import { GALLERY_JSON_PATH, IMAGES_DIR_PATH } from '@/lib/paths';
import { languageCardRepository } from '@/lib/db/repository';
import { WordEntry } from '@/types';

export async function GET(request: NextRequest) {
  return handleApiRequest(request, async () => {
    // Try to get images from database first (preferred for Supabase)
    const galleryData = await generateGalleryFromDatabase();

    // Fallback to local file scanning and JSON if needed
    if (galleryData.images.length === 0) {
      let fallbackData;
      if (fs.existsSync(GALLERY_JSON_PATH)) {
        const fileContent = fs.readFileSync(GALLERY_JSON_PATH, 'utf8');
        fallbackData = JSON.parse(fileContent);
      } else {
        fallbackData = await generateGalleryFromImages();
      }
      return NextResponse.json(fallbackData);
    }

    return NextResponse.json(galleryData);
  }, { parseBody: false });
}

async function generateGalleryFromDatabase() {
  try {
    // Get all entries from database and filter those with images
    const allEntries = await languageCardRepository.findAll();
    const entriesWithImages = allEntries.filter(entry => 
      entry.imageUrl && entry.imageStatus === 'completed'
    ).slice(0, 1000); // Reasonable limit for gallery
    
    const images = entriesWithImages.map((entry: WordEntry) => ({
      id: entry.id,
      filename: `${entry.id}.png`,
      path: entry.imageUrl, // This will be either Supabase URL or local path
      word: entry.original_text,
      translation: entry.translation_text,
      prompt: entry.prompt,
      created_at: entry.imageGeneratedAt || entry.createdAt
    }));
    
    return {
      images,
      metadata: {
        total_count: images.length,
        last_updated: new Date().toISOString(),
        version: "2.0",
        source: "database"
      }
    };
  } catch (error) {
    console.error('Error generating gallery from database:', error);
    return {
      images: [],
      metadata: {
        total_count: 0,
        last_updated: new Date().toISOString(),
        version: "2.0",
        source: "database_error",
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

async function generateGalleryFromImages() {
  const imageFiles = fs.readdirSync(IMAGES_DIR_PATH)
    .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
    .map(filename => {
      const nameWithoutExt = path.parse(filename).name;
      // Only include files with numeric IDs
      if (isNaN(Number(nameWithoutExt))) {
        return null;
      }
      return {
        id: Number(nameWithoutExt),
        filename,
        path: `/images/${nameWithoutExt}.png`,
        word: null,
        translation: null,
        prompt: null,
        created_at: new Date().toISOString()
      };
    })
    .filter(Boolean); // Remove null entries

  const galleryData = {
    images: imageFiles,
    metadata: {
      total_count: imageFiles.length,
      last_updated: new Date().toISOString(),
      version: "1.0"
    }
  };

  // Note: On Vercel, we can't write to the filesystem, so we return the generated data
  // without saving it. For persistent storage, consider using your Supabase database.
  return galleryData;
}