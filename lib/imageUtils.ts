import fs from 'fs';
import path from 'path';
import { IMAGES_DIR_PATH } from './paths';
import { uploadImageToSupabase, ensureEmojiImagesBucket } from './supabaseImageStorage';

export interface ImageSaveOptions {
  resize?: {
    width: number;
    height: number;
    fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    position?: string;
  };
  storage?: 'local' | 'supabase'; // Storage destination choice
}

export interface ImageSaveResult {
  localImageUrl: string;
  originalUrl: string;
  localPath: string;
  filename: string;
}

export async function saveImageFromUrl(
  imageUrl: string,
  entryId: number,
  options?: ImageSaveOptions
): Promise<ImageSaveResult> {
  console.log('Downloading image from:', imageUrl);
  
  // Fetch the image
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  
  const imageBuffer = await response.arrayBuffer();
  let buffer = Buffer.from(imageBuffer);
  
  // Skip resizing for now to reduce deployment size
  if (options?.resize) {
    console.log(`Image resizing requested but disabled for deployment size optimization`);
  }
  
  const filename = `${entryId}.png`;
  
  // Choose storage destination
  if (options?.storage === 'supabase') {
    // Upload to Supabase Storage
    console.log('Uploading to Supabase Storage...');
    await ensureEmojiImagesBucket();
    
    const uploadResult = await uploadImageToSupabase(buffer, entryId, 'image/png');
    
    return {
      localImageUrl: uploadResult.imageUrl, // Supabase public URL
      originalUrl: imageUrl,
      localPath: uploadResult.localPath || `images/${filename}`,
      filename: uploadResult.filename
    };
  } else {
    // Default: Save to local filesystem
    if (!fs.existsSync(IMAGES_DIR_PATH)) {
      fs.mkdirSync(IMAGES_DIR_PATH, { recursive: true });
    }
    
    const filepath = path.join(IMAGES_DIR_PATH, filename);
    
    // Save the file
    fs.writeFileSync(filepath, buffer);
    console.log('Image saved to:', filepath);
    
    // Return both the original URL and the local path with cache-busting timestamp
    const timestamp = Date.now();
    const localImageUrl = `/images/${filename}?t=${timestamp}`;
    
    return {
      localImageUrl,
      originalUrl: imageUrl,
      localPath: filepath,
      filename
    };
  }
}