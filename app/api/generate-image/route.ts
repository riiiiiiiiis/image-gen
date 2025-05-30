import Replicate from 'replicate';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getReplicateModel, createReplicateInput } from '@/lib/replicateConfig';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function POST(request: Request) {
  try {
    const { prompt, entryId, englishWord } = await request.json();

    if (!prompt || !entryId || !englishWord) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const output = await replicate.run(
      getReplicateModel(),
      {
        input: createReplicateInput(prompt),
      }
    );

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
      console.log('Downloading image from:', imageUrl);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
      const imageBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(imageBuffer);
      
      // Create images directory if it doesn't exist
      const imagesDir = path.join(process.cwd(), 'public', 'images');
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      
      // Use entry ID as filename - simple and unique
      const filename = `${entryId}.png`;
      const filepath = path.join(imagesDir, filename);
      
      // Save the file
      fs.writeFileSync(filepath, buffer);
      console.log('Image saved to:', filepath);
      
      // Return both the original URL and the local path with cache-busting timestamp
      const timestamp = Date.now();
      const localImageUrl = `/images/${filename}?t=${timestamp}`;
      const generatedAt = new Date().toISOString();
      
      return NextResponse.json({ 
        imageUrl: localImageUrl, // Return local path with cache-buster for the app to use
        originalUrl: imageUrl,    // Keep original URL as backup
        localPath: filepath,
        filename: filename,
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
  } catch (error: any) {
    console.error('Error generating image:', error);
    
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
    
    return NextResponse.json(
      { error: error.message || 'Failed to generate image' },
      { status: 500 }
    );
  }
}