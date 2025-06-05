import { NextRequest, NextResponse } from 'next/server';
import { imageQueue } from '@/lib/imageQueue';
import { handleApiRequest, validateRequestBody } from '@/lib/apiUtils';

// In-memory storage for completion callbacks
const completionCallbacks = new Map<string, (result: any) => void>();
const errorCallbacks = new Map<string, (error: string) => void>();

// Set up notification handlers on the queue instance
(imageQueue as any).notifyCompletion = function(item: any, result: any) {
  const callback = completionCallbacks.get(item.id);
  if (callback) {
    callback(result);
    completionCallbacks.delete(item.id);
  }
};

(imageQueue as any).notifyError = function(item: any, error: string) {
  const errorCallback = errorCallbacks.get(item.id);
  if (errorCallback) {
    errorCallback(error);
    errorCallbacks.delete(item.id);
  }
};

export async function POST(request: NextRequest) {
  return handleApiRequest(request, async (_req, body: { action: string; [key: string]: any }) => {
    const validation = validateRequestBody(body, ['action']);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { action, ...data } = body;

    switch (action) {
      case 'add':
        return handleAddToQueue(data);
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

async function handleAddToQueue(data: any) {
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
    const resultPromise = new Promise<any>((resolve, reject) => {
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

  } catch (error: any) {
    console.error('Error adding to queue:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate image' },
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