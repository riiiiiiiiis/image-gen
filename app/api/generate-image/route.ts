import Replicate from 'replicate';
import { NextRequest, NextResponse } from 'next/server';
import { getReplicateModel, createReplicateInput } from '@/lib/replicateConfig';
import { handleApiRequest, validateRequestBody } from '@/lib/apiUtils';
import { uploadBufferToBlob } from '@/lib/vercelBlobUpload';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function POST(request: NextRequest) {
  // @ts-expect-error - Complex return type that doesn't fit generic constraints
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handleApiRequest(request, async (_req, body: any) => {
    const typedBody = body as { prompt: string; entryId: number; englishWord: string };
    const validation = validateRequestBody(typedBody, ['prompt', 'entryId', 'englishWord']);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { prompt, entryId } = typedBody;

    let output;
    try {
      output = await replicate.run(
        getReplicateModel(),
        {
          input: createReplicateInput(prompt),
        }
      );
    } catch (error: unknown) {
      console.error('Replicate API error:', error);
      
      // Handle specific Replicate API errors
      if ((error instanceof Error ? error.message : String(error))?.includes('Invalid token') || (error instanceof Error ? error.message : String(error))?.includes('Unauthorized')) {
        return NextResponse.json(
          { error: 'Invalid API token. Please check your REPLICATE_API_TOKEN in .env.local' },
          { status: 401 }
        );
      }
      
      if ((error instanceof Error ? error.message : String(error))?.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
      
      throw error; // Re-throw to let handleApiRequest handle it
    }

    console.log('Raw output from replicate.run:', output);
    console.log('Output type:', typeof output);
    console.log('Is array?', Array.isArray(output));

    // The output from replicate.run() is typically an array of FileOutput objects
    // For SDXL-emoji with num_outputs: 1, it should be an array with one FileOutput
    let imageUrl: string;
    
    if (Array.isArray(output) && output.length > 0) {
      // Get the first FileOutput object and call .url() to get the URL
      const fileOutput: { url?: () => { toString(): string }; toString: () => string } = output[0];
      const urlResult = fileOutput.url ? fileOutput.url() : fileOutput.toString();
      imageUrl = urlResult.toString(); // Convert URL object to string
      console.log('Extracted imageUrl from FileOutput:', imageUrl);
    } else if (output && typeof output === 'object' && 'url' in output) {
      // Handle case where it might be a single FileOutput object
      const urlResult = (output as { url: () => { toString(): string } }).url();
      imageUrl = urlResult.toString(); // Convert URL object to string
      console.log('Extracted imageUrl from single FileOutput:', imageUrl);
    } else if (typeof output === 'string') {
      // Handle case where it might already be a URL string
      imageUrl = output;
      console.log('Output was already a string URL:', imageUrl);
    } else {
      console.error('Unexpected output format:', output);
      throw new Error('Unexpected output format from Replicate');
    }
    
    // Validate that we got a valid URL
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      console.error('Invalid imageUrl received:', imageUrl);
      return NextResponse.json(
        { error: 'Failed to get a valid image URL' },
        { status: 500 }
      );
    }

    // Upload the image to Vercel Blob
    try {
      // 1. Fetch the image content from the Replicate URL
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image from Replicate: ${imageResponse.statusText}`);
      }
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const contentType = imageResponse.headers.get('content-type') || 'image/png'; // Get content type

      // 2. Define a filename for Vercel Blob
      const blobFileName = `img/${entryId}.png`; // Or include a timestamp for cache-busting if needed at this level

      // 3. Upload to Vercel Blob using the new helper
      const blobUrl = await uploadBufferToBlob(blobFileName, imageBuffer, contentType);

      const generatedAt = new Date().toISOString();

      return NextResponse.json({
        imageUrl: blobUrl, // This is now the Vercel Blob URL
        originalUrl: imageUrl, // Still useful to keep the Replicate URL if needed
        status: 'completed',
        generatedAt: generatedAt,
      });
    } catch (uploadError) {
      console.error('Error uploading image to Vercel Blob:', uploadError);
      // If upload fails, still return the original URL
      return NextResponse.json({ 
        imageUrl,
        status: 'completed',
        uploadError: 'Failed to upload image to Vercel Blob, using remote URL',
      });
    }
  });
}