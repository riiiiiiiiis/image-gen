import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { IMAGES_DIR_PATH } from './paths';

export interface ImageSaveOptions {
  resize?: {
    width: number;
    height: number;
    fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    position?: string;
  };
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
  
  // Apply resizing if requested
  if (options?.resize) {
    try {
      const { width, height, fit, position = 'center' } = options.resize;
      console.log(`Resizing image ${entryId} to ${width}x${height}...`);
      
      buffer = await sharp(buffer)
        .resize(width, height, {
          fit,
          position: position as any
        })
        .png() // Ensure PNG output format
        .toBuffer();
      
      console.log(`Image ${entryId} successfully resized to ${width}x${height}.`);
    } catch (resizeError) {
      console.error(`Error resizing image ${entryId}:`, resizeError);
      throw new Error(
        `Failed to resize image ${entryId}: ${
          resizeError instanceof Error ? resizeError.message : String(resizeError)
        }`
      );
    }
  }
  
  // Create images directory if it doesn't exist
  if (!fs.existsSync(IMAGES_DIR_PATH)) {
    fs.mkdirSync(IMAGES_DIR_PATH, { recursive: true });
  }
  
  // Use entry ID as filename - simple and unique
  const filename = `${entryId}.png`;
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