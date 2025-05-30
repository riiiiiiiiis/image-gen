import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const GALLERY_PATH = path.join(process.cwd(), 'data', 'gallery.json');
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images');

export async function GET() {
  try {
    // Read gallery JSON
    let galleryData;
    if (fs.existsSync(GALLERY_PATH)) {
      const fileContent = fs.readFileSync(GALLERY_PATH, 'utf8');
      galleryData = JSON.parse(fileContent);
    } else {
      // Auto-generate from existing images
      galleryData = await generateGalleryFromImages();
    }

    return NextResponse.json(galleryData);
  } catch (error) {
    console.error('Error reading gallery:', error);
    return NextResponse.json({ error: 'Failed to load gallery' }, { status: 500 });
  }
}

async function generateGalleryFromImages() {
  const imageFiles = fs.readdirSync(IMAGES_DIR)
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

  // Save generated data
  fs.writeFileSync(GALLERY_PATH, JSON.stringify(galleryData, null, 2));
  return galleryData;
}