import { supabaseAdmin } from './supabaseAdmin';
import { Buffer } from 'buffer';

export interface SupabaseImageUploadResult {
  imageUrl: string;
  originalUrl: string;
  filename: string;
  localPath?: string; // For compatibility with existing interfaces
}

/**
 * Upload an image buffer to Supabase Storage
 */
export async function uploadImageToSupabase(
  imageBuffer: Buffer,
  entryId: number,
  contentType: string = 'image/png'
): Promise<SupabaseImageUploadResult> {
  const filename = `${entryId}.png`;
  const filePath = `images/${filename}`;
  
  console.log(`Uploading image to Supabase: ${filePath}`);
  
  try {
    // Upload to Supabase Storage bucket
    const { data, error } = await supabaseAdmin.storage
      .from('emoji-images')
      .upload(filePath, imageBuffer, {
        contentType,
        upsert: true, // Allow overwriting for regeneration
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Failed to upload to Supabase: ${error.message}`);
    }

    console.log('Upload successful:', data);

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('emoji-images')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;
    console.log('Public URL:', publicUrl);

    return {
      imageUrl: publicUrl,
      originalUrl: publicUrl, // For compatibility
      filename,
      localPath: filePath, // Virtual path for compatibility
    };
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    throw error;
  }
}

/**
 * Download image from URL and upload to Supabase Storage
 */
export async function downloadAndUploadToSupabase(
  imageUrl: string,
  entryId: number
): Promise<SupabaseImageUploadResult> {
  console.log('Downloading and uploading image from:', imageUrl);
  
  // Fetch the image
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  
  const imageBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(imageBuffer);
  
  // Upload to Supabase
  return uploadImageToSupabase(buffer, entryId, 'image/png');
}

/**
 * Create the emoji-images bucket if it doesn't exist
 */
export async function ensureEmojiImagesBucket(): Promise<void> {
  console.log('Ensuring emoji-images bucket exists...');
  
  try {
    // Try to get bucket info first
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      throw listError;
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === 'emoji-images');
    
    if (!bucketExists) {
      console.log('Creating emoji-images bucket...');
      
      const { data, error } = await supabaseAdmin.storage.createBucket('emoji-images', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg'],
        fileSizeLimit: '5MB'
      });
      
      if (error) {
        console.error('Error creating bucket:', error);
        throw new Error(`Failed to create bucket: ${error.message}`);
      }
      
      console.log('Bucket created successfully:', data);
    } else {
      console.log('Bucket already exists');
    }
  } catch (error) {
    console.error('Error ensuring bucket exists:', error);
    throw error;
  }
}