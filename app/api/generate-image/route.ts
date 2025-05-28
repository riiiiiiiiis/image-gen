import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function POST(request: Request) {
  try {
    const { prompt, entryId } = await request.json();

    if (!prompt || !entryId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const output = await replicate.run(
      "fofr/sdxl-emoji:dee76b5afde21b0f01ed7925f0665b7e879c50ee718c5f78a9d38e04d523cc5e",
      {
        input: {
          prompt: `A TOK emoji of ${prompt}`,
          negative_prompt: "blurry, bad quality, distorted, deformed",
          width: 1024,
          height: 1024,
          num_outputs: 1,
          num_inference_steps: 50,
          guidance_scale: 7.5,
          scheduler: "K_EULER",
          lora_scale: 0.6,
          refine: "no_refiner",
          apply_watermark: false,
          disable_safety_checker: false,
        },
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
      const fileOutput = output[0];
      const urlResult = fileOutput.url ? fileOutput.url() : fileOutput.toString();
      imageUrl = urlResult.toString(); // Convert URL object to string
      console.log('Extracted imageUrl from FileOutput:', imageUrl);
    } else if (output && typeof output === 'object' && 'url' in output) {
      // Handle case where it might be a single FileOutput object
      const urlResult = output.url();
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

    return NextResponse.json({ 
      imageUrl,
      status: 'completed',
    });
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