import { put } from '@vercel/blob';
import { Buffer } from 'buffer';

// Option 1: If you can get a File object (e.g., from FormData)
export async function uploadFileToBlob(fileName: string, fileContent: File): Promise<string> {
  const blob = await put(fileName, fileContent, {
    access: 'public',
  });
  return blob.url;
}

// Option 2: If you have a Buffer (e.g., after fetching from Replicate)
export async function uploadBufferToBlob(fileName: string, fileBuffer: Buffer, contentType: string): Promise<string> {
  const blob = await put(fileName, fileBuffer, {
    access: 'public',
    contentType: contentType, // e.g., 'image/png'
  });
  return blob.url;
}