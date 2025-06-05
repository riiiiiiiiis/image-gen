import Replicate from 'replicate';
import { NextRequest, NextResponse } from 'next/server';
import { getReplicateModel, createReplicateInput } from '@/lib/replicateConfig';
import { handleApiRequest, validateRequestBody } from '@/lib/apiUtils';
import { saveImageFromUrl } from '@/lib/imageUtils';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function POST(request: NextRequest) {
  return handleApiRequest(request, async (_req, body: { prompt: string; entryId: number; englishWord: string }) => {
    const validation = validateRequestBody(body, ['prompt', 'entryId', 'englishWord']);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { prompt, entryId } = body;

    let output;
    try {
      output = await replicate.run(
        getReplicateModel(),
        {
          input: createReplicateInput(prompt),
        }
      );
    } catch (error: any) {
      console.error('Replicate API error:', error);
      
      // Handle specific Replicate API errors
      if (error.message?.includes('Invalid token') || error.message?.includes('Unauthorized')) {
        return NextResponse.json(
          { error: 'Invalid API token. Please check your REPLICATE_API_TOKEN in .env.local' },
          { status: 401 }
        );
      }
      
      if (error.message?.includes('rate limit')) {
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
      const fileOutput = output[0] as any;
      const urlResult = fileOutput.url ? fileOutput.url() : fileOutput.toString();
      imageUrl = urlResult.toString(); // Convert URL object to string
      console.log('Extracted imageUrl from FileOutput:', imageUrl);
    } else if (output && typeof output === 'object' && 'url' in output) {
      // Handle case where it might be a single FileOutput object
      const urlResult = (output as any).url();
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

    // Download and save the image locally
    try {
      const result = await saveImageFromUrl(imageUrl, entryId);
      const generatedAt = new Date().toISOString();
      
      return NextResponse.json({ 
        imageUrl: result.localImageUrl, // Return local path with cache-buster for the app to use
        originalUrl: result.originalUrl, // Keep original URL as backup
        localPath: result.localPath,
        filename: result.filename,
        status: 'completed',
        generatedAt: generatedAt, // Add timestamp for sorting
      });
    } catch (downloadError) {
      console.error('Error downloading/saving image:', downloadError);
      // If download fails, still return the original URL
      return NextResponse.json({ 
        imageUrl,
        status: 'completed',
        downloadError: 'Failed to save image locally, using remote URL',
      });
    }
  });
}