import { NextRequest, NextResponse } from 'next/server';
import { imageQueue, QueueItem, NotifyCompletionResult } from '@/lib/imageQueue';
import { handleApiRequest, validateRequestBody } from '@/lib/apiUtils';

// In-memory storage for completion callbacks
const completionCallbacks = new Map<string, (result: NotifyCompletionResult) => void>();
const errorCallbacks = new Map<string, (error: string) => void>();

// Set up notification handlers on the queue instance
(imageQueue as unknown as { notifyCompletion: (item: QueueItem, result: NotifyCompletionResult) => void }).notifyCompletion = function(item: QueueItem, result: NotifyCompletionResult) {
  const callback = completionCallbacks.get(item.id);
  if (callback) {
    callback(result);
    completionCallbacks.delete(item.id);
  }
};

(imageQueue as unknown as { notifyError: (item: QueueItem, error: string) => void }).notifyError = function(item: QueueItem, error: string) {
  const errorCallback = errorCallbacks.get(item.id);
  if (errorCallback) {
    errorCallback(error);
    errorCallbacks.delete(item.id);
  }
};

export async function POST(request: NextRequest) {
  // @ts-expect-error - Complex return type that doesn't fit generic constraints
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handleApiRequest(request, async (_req, body: any) => {
    const typedBody = body as { action: string; [key: string]: unknown };
    const validation = validateRequestBody(typedBody, ['action']);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { action, ...data } = typedBody;

    switch (action) {
      case 'add':
        return handleAddToQueue(data as { entryId: number; englishWord: string; prompt: string; [key: string]: unknown });
      case 'status':
        return handleGetStatus();
      case 'items':
        return handleGetItems();
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  });
}

async function handleAddToQueue(data: { entryId: number; englishWord: string; prompt: string; [key: string]: unknown }) {
  const { entryId, englishWord, prompt } = data;

  console.log(`API: Adding to queue - entryId: ${entryId}, word: ${englishWord}`);

  if (!entryId || !englishWord || !prompt) {
    console.log('API: Missing required fields:', { entryId, englishWord, prompt: !!prompt });
    return NextResponse.json(
      { error: 'Missing required fields: entryId, englishWord, prompt' },
      { status: 400 }
    );
  }

  try {
    // Add to queue
    console.log(`API: Adding to imageQueue...`);
    const queueId = await imageQueue.addToQueue(entryId, englishWord, prompt);
    console.log(`API: Added to queue with ID: ${queueId}`);

    // Create a promise that resolves when the image is generated
    const resultPromise = new Promise<NotifyCompletionResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        completionCallbacks.delete(queueId);
        errorCallbacks.delete(queueId);
        reject(new Error('Generation timeout'));
      }, 300000); // 5 minute timeout

      completionCallbacks.set(queueId, (result) => {
        clearTimeout(timeout);
        resolve(result);
      });

      errorCallbacks.set(queueId, (error) => {
        clearTimeout(timeout);
        reject(new Error(error));
      });
    });

    // Wait for completion
    const result = await resultPromise;

    return NextResponse.json({
      queueId,
      status: 'completed',
      ...result,
    });

  } catch (error: unknown) {
    console.error('Error adding to queue:', error);
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : String(error)) || 'Failed to generate image' },
      { status: 500 }
    );
  }
}

async function handleGetStatus() {
  const status = imageQueue.getQueueStatus();
  return NextResponse.json(status);
}

async function handleGetItems() {
  const items = imageQueue.getQueueItems();
  return NextResponse.json({ items });
}