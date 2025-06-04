import { NextResponse } from 'next/server';
import { imageQueue } from '@/lib/imageQueue';

interface GenerateImageBatchRequestEntry {
  entryId: number;
  prompt: string;
  englishWord: string;
}

export async function POST(request: Request) {
  try {
    const { entries }: { entries: GenerateImageBatchRequestEntry[] } = await request.json();

    // Input validation
    if (!entries || !Array.isArray(entries)) {
      return NextResponse.json(
        { error: 'Missing or invalid "entries" array.' },
        { status: 400 }
      );
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: '"entries" array cannot be empty.' },
        { status: 400 }
      );
    }

    // Initialize counters
    let successfullyQueuedCount = 0;
    let failedToQueueCount = 0;
    const itemErrors: Array<{ entryId: number; error: string }> = [];

    // Process each entry
    for (const entry of entries) {
      // Validate each item
      if (!entry.entryId || !entry.prompt || !entry.prompt.trim() || !entry.englishWord) {
        failedToQueueCount++;
        itemErrors.push({
          entryId: entry.entryId || -1,
          error: 'Missing entryId, prompt, or englishWord.'
        });
        console.warn(`Skipping invalid entry in batch image generation: ${JSON.stringify(entry)}`);
        continue;
      }

      try {
        await imageQueue.addToQueue(entry.entryId, entry.englishWord, entry.prompt);
        successfullyQueuedCount++;
      } catch (queueError) {
        console.error(`Error adding entry ${entry.entryId} to imageQueue:`, queueError);
        failedToQueueCount++;
        itemErrors.push({
          entryId: entry.entryId,
          error: queueError instanceof Error ? queueError.message : 'Failed to add to internal queue.'
        });
      }
    }

    // Prepare response
    let responseMessage: string;
    
    if (failedToQueueCount > 0 && successfullyQueuedCount === 0) {
      responseMessage = `Failed to queue all ${failedToQueueCount} images.`;
      return NextResponse.json(
        {
          success: false,
          message: responseMessage,
          queuedCount: successfullyQueuedCount,
          errorCount: failedToQueueCount,
          errors: itemErrors
        },
        { status: 500 }
      );
    }

    responseMessage = `Successfully queued ${successfullyQueuedCount} images for generation.`;
    if (failedToQueueCount > 0) {
      responseMessage += ` Failed to queue ${failedToQueueCount} images.`;
    }

    return NextResponse.json({
      success: true,
      message: responseMessage,
      queuedCount: successfullyQueuedCount,
      errorCount: failedToQueueCount,
      errors: itemErrors.length > 0 ? itemErrors : undefined
    });

  } catch (error) {
    console.error('Batch Generate Images API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process batch image generation request.' },
      { status: 500 }
    );
  }
}