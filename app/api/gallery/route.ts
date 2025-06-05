import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { handleApiRequest } from '@/lib/apiUtils';
import { GALLERY_JSON_PATH, IMAGES_DIR_PATH } from '@/lib/paths';

export async function GET(request: NextRequest) {
  return handleApiRequest(request, async () => {
    // Read gallery JSON
    let galleryData;
    if (fs.existsSync(GALLERY_JSON_PATH)) {
      const fileContent = fs.readFileSync(GALLERY_JSON_PATH, 'utf8');
      galleryData = JSON.parse(fileContent);
    } else {
      // Auto-generate from existing images
      galleryData = await generateGalleryFromImages();
    }

    return NextResponse.json(galleryData);
  }, { parseBody: false });
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

  // Save generated data
  fs.writeFileSync(GALLERY_JSON_PATH, JSON.stringify(galleryData, null, 2));
  return galleryData;
}