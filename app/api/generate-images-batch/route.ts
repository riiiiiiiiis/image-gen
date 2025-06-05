import { NextRequest, NextResponse } from 'next/server';
import { imageQueue } from '@/lib/imageQueue';
import { handleApiRequest, validateRequestArray } from '@/lib/apiUtils';

interface GenerateImageBatchRequestEntry {
  entryId: number;
  prompt: string;
  englishWord: string;
}

export async function POST(request: NextRequest) {
  // @ts-expect-error - Need to use any for handleApiRequest compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handleApiRequest(request, async (_req, body: any) => {
    const typedBody = body as { entries: GenerateImageBatchRequestEntry[] };
    // Input validation
    const validation = validateRequestArray(typedBody.entries, 'entries');
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { entries } = typedBody;

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

  });
}