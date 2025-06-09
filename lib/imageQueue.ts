import Replicate from 'replicate';
import { getReplicateModel, createReplicateInput } from './replicateConfig';
import { languageCardRepository } from './db/repository';
import { uploadImageToSupabase, ensureEmojiImagesBucket } from './supabaseImageStorage';

if (!process.env.REPLICATE_API_TOKEN) {
  console.error('REPLICATE_API_TOKEN is not set in environment variables');
  throw new Error('REPLICATE_API_TOKEN is required but not set');
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

interface ReplicateOutputItem {
  url?: () => { toString: () => string };
  toString: () => string;
}

interface NotifyCompletionResult {
  imageUrl: string;
  originalUrl: string;
  generatedAt: string;
}

interface QueueItem {
  id: string;
  entryId: number;
  englishWord: string;
  prompt: string;
  predictionId?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  retries: number;
  createdAt: Date;
}

class ImageGenerationQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private maxRetries = 3;
  private concurrencyLimit = 8; // Based on research for optimal performance

  // Add item to queue
  async addToQueue(entryId: number, englishWord: string, prompt: string): Promise<string> {
    // Check if this entry is already in queue
    const existingItem = this.queue.find(item => item.entryId === entryId);
    if (existingItem) {
      console.log(`Entry ${entryId} (${englishWord}) already in queue with status: ${existingItem.status}`);
      return existingItem.id;
    }

    const queueId = `queue-${Date.now()}-${entryId}`;
    const item: QueueItem = {
      id: queueId,
      entryId,
      englishWord,
      prompt,
      status: 'pending',
      retries: 0,
      createdAt: new Date(),
    };

    this.queue.push(item);
    console.log(`Added to queue: ${englishWord} (${queueId}) - Total queue: ${this.queue.length}`);
    
    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }

    return queueId;
  }

  // Start processing queue
  private async startProcessing() {
    if (this.processing) {
      console.log('Processing already running, skipping...');
      return;
    }
    
    this.processing = true;
    console.log(`Starting image queue processing... Total items: ${this.queue.length}`);

    while (this.queue.length > 0) {
      // Get all pending items
      const pendingItems = this.queue.filter(item => item.status === 'pending');
      console.log(`Queue status: Total=${this.queue.length}, Pending=${pendingItems.length}`);
      
      if (pendingItems.length === 0) {
        // No pending items, wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // Create a batch of workers up to the concurrency limit
      const batch = pendingItems.slice(0, this.concurrencyLimit);
      const workers: Promise<void>[] = [];
      
      console.log(`Processing batch of ${batch.length} items concurrently...`);
      
      // Start processing each item in the batch
      for (const item of batch) {
        // Mark as processing immediately to prevent duplicate processing
        item.status = 'processing';
        console.log(`Starting processing: ${item.englishWord} (${item.id})`);
        
        // Create worker promise and add to array
        workers.push(this.processItem(item));
      }
      
      // Wait for all workers in the batch to complete
      await Promise.allSettled(workers);
      
      // Small delay between batches to act as a rate limiter
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.processing = false;
    console.log('Queue processing finished - no more items');
  }

  // Process individual item
  private async processItem(item: QueueItem) {
    while (item.retries < this.maxRetries) {
      try {
        console.log(`Processing: ${item.englishWord} (${item.id}) - Attempt ${item.retries + 1}`);

        // Create prediction (async) using centralized config
        const prediction = await replicate.predictions.create({
          version: getReplicateModel(),
          input: createReplicateInput(item.prompt),
        });

        item.predictionId = prediction.id;
        console.log(`Created prediction: ${prediction.id} for ${item.englishWord}`);

        // Wait for completion
        const result = await replicate.wait(prediction);
        
        if (result.status === 'succeeded' && result.output) {
          await this.handleSuccess(item, result.output as ReplicateOutputItem[]);
          return; // Success - exit the retry loop
        } else {
          throw new Error(`Prediction failed: ${result.error || 'Unknown error'}`);
        }

      } catch (error) {
        console.error(`Attempt ${item.retries + 1} failed for ${item.englishWord}:`, error);
        item.retries++;
        
        if (item.retries < this.maxRetries) {
          console.log(`Retrying ${item.englishWord} (attempt ${item.retries + 1}/${this.maxRetries}) after delay`);
          // Keep status as 'processing' during retries
          // Add delay before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 5000 * item.retries));
        } else {
          console.error(`Max retries reached for ${item.englishWord} (${item.id})`);
          item.status = 'error';
          
          // Update database on final failure
          try {
            await languageCardRepository.update(item.entryId, {
              imageStatus: 'error',
              replicateId: item.predictionId,
            });
            console.log(`[DB] Successfully updated entry ID ${item.entryId} status to 'error'.`);
          } catch (dbError) {
            console.error(`[DB] CRITICAL: Failed to update database to 'error' status for entry ID ${item.entryId}.`, dbError);
          }

          // Notify error
          this.notifyError(item, (error as Error).message || 'Generation failed');
          
          // Remove from queue
          this.removeFromQueue(item.id);
          return; // Exit retry loop
        }
      }
    }
  }

  // Handle successful generation
  private async handleSuccess(item: QueueItem, output: ReplicateOutputItem[]) {
    try {
      console.log(`Success: ${item.englishWord} (${item.id})`);
      
      // Get image URL from output
      let imageUrl: string;
      if (Array.isArray(output) && output.length > 0) {
        const fileOutput = output[0];
        imageUrl = fileOutput.url ? fileOutput.url().toString() : fileOutput.toString();
      } else {
        throw new Error('Invalid output format');
      }

      // Download and upload image with resizing to Supabase Storage
      const uploadResult = await this.downloadAndUploadToSupabase(imageUrl, item.entryId);
      
      item.status = 'completed';
      
      // Update the database with the new image URL and status
      const generatedAt = new Date().toISOString();
      try {
        await languageCardRepository.update(item.entryId, {
          imageUrl: uploadResult.imageUrl,
          imageStatus: 'completed',
          replicateId: item.predictionId,
          imageGeneratedAt: generatedAt,
        });
        console.log(`[DB] Successfully updated entry ID ${item.entryId} with new image.`);
      } catch (dbError) {
        console.error(`[DB] CRITICAL: Failed to update database for entry ID ${item.entryId} after successful image generation and upload.`, dbError);
      }

      // Notify completion via callback or event
      this.notifyCompletion(item, {
        imageUrl: uploadResult.imageUrl,
        originalUrl: uploadResult.originalUrl,
        generatedAt: generatedAt,
      });

      // Remove from queue
      this.removeFromQueue(item.id);

    } catch (error) {
      console.error(`Error processing success for ${item.englishWord}:`, error);
      throw error; // Re-throw to be handled by processItem
    }
  }


  // Download and upload image to Supabase Storage with resizing
  private async downloadAndUploadToSupabase(imageUrl: string, entryId: number) {
    console.log('Downloading and uploading image from:', imageUrl);
    
    // Ensure bucket exists
    await ensureEmojiImagesBucket();
    
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const imageBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(imageBuffer);
    
    // Skip resizing for now to reduce deployment size
    // Images will be stored as-is from Replicate
    console.log(`Uploading image ${entryId} without resizing...`);
    
    // Upload to Supabase Storage
    const uploadResult = await uploadImageToSupabase(buffer, entryId, 'image/png');
    
    return {
      imageUrl: uploadResult.imageUrl,
      originalUrl: imageUrl,
      filename: uploadResult.filename
    };
  }

  // Remove item from queue
  private removeFromQueue(queueId: string) {
    const index = this.queue.findIndex(item => item.id === queueId);
    if (index > -1) {
      const item = this.queue[index];
      this.queue.splice(index, 1);
      console.log(`Removed from queue: ${item.englishWord} (${queueId}) - Remaining: ${this.queue.length}`);
    } else {
      console.log(`Item not found in queue for removal: ${queueId}`);
    }
  }

  // Get queue status
  getQueueStatus() {
    const status = {
      total: this.queue.length,
      pending: this.queue.filter(item => item.status === 'pending').length,
      processing: this.queue.filter(item => item.status === 'processing').length,
      completed: this.queue.filter(item => item.status === 'completed').length,
      errors: this.queue.filter(item => item.status === 'error').length,
      isProcessing: this.processing,
    };
    
    return status;
  }

  // Get queue items
  getQueueItems() {
    return this.queue.map(item => ({
      id: item.id,
      entryId: item.entryId,
      englishWord: item.englishWord,
      status: item.status,
      retries: item.retries,
      createdAt: item.createdAt,
      predictionId: item.predictionId,
    }));
  }

  // Callback methods (to be overridden)
  protected notifyCompletion(item: QueueItem, _result: NotifyCompletionResult) {
    // Override this method to handle completion
    console.log(`✅ Completed: ${item.englishWord}`);
  }

  protected notifyError(item: QueueItem, error: string) {
    // Override this method to handle errors
    console.log(`❌ Error: ${item.englishWord} - ${error}`);
  }

  protected notifyProgress(item: QueueItem, status: string) {
    // Override this method to handle progress updates
    console.log(`🔄 Progress: ${item.englishWord} - ${status}`);
  }
}

// Export singleton instance
export const imageQueue = new ImageGenerationQueue();
export type { QueueItem };